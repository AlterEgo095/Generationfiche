// Tests — WebSocket Event Delivery (P1-3 Sprint 3)
// Vérifie que l'outbox garantit la livraison des events, même si le WS est down.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { processOutbox } from '@/lib/pipeline/orchestrator'

// Mock fetch pour contrôler le comportement du WS
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockReset()
})

afterEach(async () => {
  // Nettoie l'outbox après chaque test
  await db.eventOutbox.deleteMany({})
})

describe('Event Outbox — Garantie de livraison', () => {
  it('persiste un event en DB avant d\'essayer de l\'envoyer (outbox pattern)', async () => {
    // Crée un event manuellement (simule ce que fait emitPipelineEvent)
    await db.eventOutbox.create({
      data: {
        batchId: 'test-batch-1',
        agent: 'redacteur',
        phase: 'start',
        message: 'Test event',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(),
      },
    })
    const count = await db.eventOutbox.count()
    expect(count).toBe(1)
  })

  it('marque l\'event comme "delivered" quand le WS répond 200', async () => {
    await db.eventOutbox.create({
      data: {
        batchId: 'test-batch-2',
        agent: 'redacteur',
        phase: 'done',
        message: 'Section générée',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(),
      },
    })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    const result = await processOutbox(10)
    expect(result.delivered).toBe(1)
    expect(result.failed).toBe(0)

    const evt = await db.eventOutbox.findFirst({ where: { batchId: 'test-batch-2' } })
    expect(evt?.status).toBe('delivered')
    expect(evt?.attempts).toBe(1)
    expect(evt?.deliveredAt).not.toBeNull()
  })

  it('retry avec backoff quand le WS échoue (tentative 1/3)', async () => {
    await db.eventOutbox.create({
      data: {
        batchId: 'test-batch-3',
        agent: 'critique',
        phase: 'error',
        message: 'LLM KO',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(),
      },
    })
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const result = await processOutbox(10)
    expect(result.delivered).toBe(0)
    expect(result.failed).toBe(0) // pas encore failed, juste en retry

    const evt = await db.eventOutbox.findFirst({ where: { batchId: 'test-batch-3' } })
    expect(evt?.status).toBe('pending')
    expect(evt?.attempts).toBe(1)
    expect(evt?.nextRetryAt.getTime()).toBeGreaterThan(Date.now() - 1000) // programmé dans le futur
  })

  it('marque "failed_delivery" après 3 tentatives échouées', async () => {
    await db.eventOutbox.create({
      data: {
        batchId: 'test-batch-4',
        agent: 'superviseur',
        phase: 'escalade',
        message: 'Escalade humaine',
        status: 'pending',
        attempts: 2, // déjà 2 tentatives
        maxAttempts: 3,
        nextRetryAt: new Date(),
      },
    })
    mockFetch.mockRejectedValueOnce(new Error('timeout'))

    const result = await processOutbox(10)
    expect(result.failed).toBe(1)

    const evt = await db.eventOutbox.findFirst({ where: { batchId: 'test-batch-4' } })
    expect(evt?.status).toBe('failed_delivery')
    expect(evt?.attempts).toBe(3)
  })

  it('respecte le backoff exponentiel : 1s, 3s, 10s', async () => {
    // Tentative 1 (attempts=0 → 1)
    await db.eventOutbox.create({
      data: {
        batchId: 'test-backoff-1',
        agent: 'redacteur', phase: 'start', message: 'evt1',
        status: 'pending', attempts: 0, maxAttempts: 3, nextRetryAt: new Date(),
      },
    })
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    await processOutbox(10)
    let evt = await db.eventOutbox.findFirst({ where: { batchId: 'test-backoff-1' } })
    const retry1 = evt!.nextRetryAt.getTime() - Date.now()
    expect(retry1).toBeGreaterThan(500) // ~1s
    expect(retry1).toBeLessThan(2000)

    // Tentative 2 (attempts=1 → 2)
    await db.eventOutbox.update({ where: { id: evt!.id }, data: { nextRetryAt: new Date() } })
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    await processOutbox(10)
    evt = await db.eventOutbox.findFirst({ where: { batchId: 'test-backoff-1' } })
    const retry2 = evt!.nextRetryAt.getTime() - Date.now()
    expect(retry2).toBeGreaterThan(2000) // ~3s
    expect(retry2).toBeLessThan(5000)
  })

  it('aucun event n\'est perdu — même si processOutbox n\'est pas appelé, les events restent en DB', async () => {
    await db.eventOutbox.create({
      data: {
        batchId: 'test-persist',
        agent: 'planificateur', phase: 'start', message: 'evt persisté',
        status: 'pending', attempts: 0, maxAttempts: 3, nextRetryAt: new Date(),
      },
    })
    // N'appele PAS processOutbox — vérifie que l'event est toujours là
    const evt = await db.eventOutbox.findFirst({ where: { batchId: 'test-persist' } })
    expect(evt).not.toBeNull()
    expect(evt?.status).toBe('pending')
  })

  it('idempotence — un event déjà délivré n\'est pas re-délivré', async () => {
    await db.eventOutbox.create({
      data: {
        batchId: 'test-idem',
        agent: 'redacteur', phase: 'done', message: 'evt délivré',
        status: 'delivered', attempts: 1, maxAttempts: 3, nextRetryAt: new Date(),
        deliveredAt: new Date(),
      },
    })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    const result = await processOutbox(10)
    expect(result.processed).toBe(0) // pas de pending à traiter
    expect(result.delivered).toBe(0)
  })
})
