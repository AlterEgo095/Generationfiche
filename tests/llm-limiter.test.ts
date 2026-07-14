// Tests — LLM Rate Limiter (P4-2 Sprint 4)
// Vérifie : concurrence limitée, retry avec backoff, circuit breaker.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LLMRateLimiter } from '@/lib/llm-limiter'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LLMRateLimiter', () => {
  it('exécute une fonction avec succès', async () => {
    const limiter = new LLMRateLimiter(3)
    const fn = vi.fn().mockResolvedValue('result')
    const result = await limiter.execute(fn)
    expect(result).toBe('result')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('limite la concurrence à maxConcurrent', async () => {
    const limiter = new LLMRateLimiter(2)
    let active = 0
    let maxActive = 0
    const fn = vi.fn().mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 50))
      active--
      return 'ok'
    })

    const promises = Array.from({ length: 10 }, () => limiter.execute(fn))
    await Promise.all(promises)

    expect(maxActive).toBeLessThanOrEqual(2)
    expect(fn).toHaveBeenCalledTimes(10)
  })

  it('retry avec backoff sur erreur (max 3 retries)', async () => {
    const limiter = new LLMRateLimiter(1)
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('success on 3rd try')

    const result = await limiter.execute(fn, 3)
    expect(result).toBe('success on 3rd try')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('lance l\'erreur après épuisement des retries', async () => {
    const limiter = new LLMRateLimiter(1)
    const fn = vi.fn().mockRejectedValue(new Error('always fail'))

    await expect(limiter.execute(fn, 2)).rejects.toThrow('always fail')
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('circuit breaker s\'ouvre après 3 erreurs consécutives', async () => {
    const limiter = new LLMRateLimiter(1)
    const failFn = vi.fn().mockRejectedValue(new Error('fail'))

    // 3 erreurs consécutives
    await limiter.execute(failFn, 0).catch(() => {})
    await limiter.execute(failFn, 0).catch(() => {})
    await limiter.execute(failFn, 0).catch(() => {})

    // Le circuit devrait être OPEN
    const status = limiter.getStatus()
    expect(status.state).toBe('OPEN')
    expect(status.consecutiveErrors).toBeGreaterThanOrEqual(3)

    // La 4e tentative doit échouer immédiatement avec "Circuit breaker OPEN"
    const goodFn = vi.fn().mockResolvedValue('should not reach')
    await expect(limiter.execute(goodFn, 0)).rejects.toThrow(/Circuit breaker OPEN/)
    expect(goodFn).not.toHaveBeenCalled()
  })

  it('reset() remet le circuit breaker à CLOSED', async () => {
    const limiter = new LLMRateLimiter(1)
    const failFn = vi.fn().mockRejectedValue(new Error('fail'))

    await limiter.execute(failFn, 0).catch(() => {})
    await limiter.execute(failFn, 0).catch(() => {})
    await limiter.execute(failFn, 0).catch(() => {})
    expect(limiter.getStatus().state).toBe('OPEN')

    limiter.reset()
    expect(limiter.getStatus().state).toBe('CLOSED')
    expect(limiter.getStatus().consecutiveErrors).toBe(0)
  })

  it('0 dépassement de concurrence même avec 20 appels simultanés', async () => {
    const limiter = new LLMRateLimiter(3)
    let active = 0
    let maxObserved = 0

    const fn = vi.fn().mockImplementation(async () => {
      active++
      maxObserved = Math.max(maxObserved, active)
      await new Promise((r) => setTimeout(r, 20))
      active--
      return 'ok'
    })

    const promises = Array.from({ length: 20 }, () => limiter.execute(fn))
    await Promise.all(promises)

    expect(maxObserved).toBeLessThanOrEqual(3)
    expect(fn).toHaveBeenCalledTimes(20)
  })

  it('0 perte de requête — toutes les requêtes aboutissent', async () => {
    const limiter = new LLMRateLimiter(2)
    const fn = vi.fn().mockImplementation(async (i: number) => `result-${i}`)

    const promises = Array.from({ length: 10 }, (_, i) => limiter.execute(() => fn(i)))
    const results = await Promise.all(promises)

    expect(results.length).toBe(10)
    results.forEach((r, i) => {
      expect(r).toBe(`result-${i}`)
    })
  })
})
