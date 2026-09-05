// Tests — System Monitoring (P4-1 + P4-4 Sprint 4)
// Vérifie : endpoints système, health check, outbox monitoring, métriques.

import { describe, it, expect, beforeAll } from 'vitest'
import { authed, loginTestUser } from './helpers/authed'

describe('System Monitoring — Endpoints', () => {
  // R-01 : l'API exige désormais une session (ferme F-06)
  beforeAll(async () => {
    await loginTestUser()
  }, 20000)
  it('GET /api/system/health retourne status=healthy', async () => {
    const resp = await authed('/api/system/health')
    expect(resp.status).toBe(200)
    const body = await resp.json()
    expect(body.status).toBe('healthy')
    expect(body.database).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })

  it('GET /api/system/outbox retourne les stats outbox', async () => {
    const resp = await authed('/api/system/outbox')
    expect(resp.status).toBe(200)
    const body = await resp.json()
    expect(body.pending).toBeDefined()
    expect(body.failed).toBeDefined()
    expect(body.processed).toBeDefined()
    expect(body.worker_status).toBeDefined()
    expect(['healthy', 'degraded', 'overloaded']).toContain(body.worker_status)
  })

  it('GET /api/system retourne le dashboard complet', async () => {
    const resp = await authed('/api/system')
    expect(resp.status).toBe(200)
    const body = await resp.json()
    expect(body.status).toBe('ok')
    expect(body.api).toBeDefined()
    expect(body.database).toBeDefined()
    expect(body.llm_limiter).toBeDefined()
    expect(body.outbox).toBeDefined()
    expect(body.errors_24h).toBeDefined()
    expect(body.llm_limiter.max_concurrent).toBe(3)
  })

  it('GET /api/system inclut l\'état du LLM limiter', async () => {
    const resp = await authed('/api/system')
    const body = await resp.json()
    expect(body.llm_limiter.state).toMatch(/CLOSED|OPEN|HALF_OPEN/)
    expect(body.llm_limiter.active).toBeGreaterThanOrEqual(0)
    expect(body.llm_limiter.queued).toBeGreaterThanOrEqual(0)
  })

  it('GET /api/system/outbox inclut last_event (null si vide)', async () => {
    const resp = await authed('/api/system/outbox')
    const body = await resp.json()
    expect(body.last_event === null || typeof body.last_event === 'object').toBe(true)
  })

  it('POST /api/system/outbox déclenche le worker', async () => {
    const resp = await authed('/api/system/outbox', { method: 'POST' })
    expect(resp.status).toBe(200)
    const body = await resp.json()
    expect(body.ok).toBe(true)
    expect(body.processed).toBeDefined()
    expect(body.delivered).toBeDefined()
    expect(body.failed).toBeDefined()
  })

  it('health check retourne 503 si DB indisponible (simulation non possible en test, vérifie structure)', async () => {
    // Ce test vérifie que l'endpoint existe et répond
    // En conditions réelles, si la DB est down, l'endpoint retourne 503
    const resp = await authed('/api/system/health')
    expect([200, 503]).toContain(resp.status)
  })
})
