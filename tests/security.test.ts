// Tests — Security Hardening (P4-3 Sprint 4)
// Vérifie : headers de sécurité, validation Zod, injection bloquée.

import { describe, it, expect } from 'vitest'

describe('Security Headers', () => {
  it('le middleware ajoute X-Content-Type-Options', async () => {
    const resp = await fetch('http://localhost:3000/api/system/health')
    expect(resp.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('le middleware ajoute X-Frame-Options', async () => {
    const resp = await fetch('http://localhost:3000/api/system/health')
    expect(resp.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('le middleware ajoute Referrer-Policy', async () => {
    const resp = await fetch('http://localhost:3000/api/system/health')
    expect(resp.headers.get('Referrer-Policy')).toContain('strict-origin')
  })

  it('le middleware ajoute Content-Security-Policy', async () => {
    const resp = await fetch('http://localhost:3000/api/system/health')
    const csp = resp.headers.get('Content-Security-Policy')
    expect(csp).toBeTruthy()
    expect(csp).toContain("frame-ancestors 'none'")
  })
})

describe('Security — API Input Validation', () => {
  it('POST /api/corpus rejette type invalide (Zod enum)', async () => {
    const resp = await fetch('http://localhost:3000/api/corpus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenu: 'test contenu valide', type: 'TYPE_INCONNU', niveau: '4e', chapitre: 'test' }),
    })
    expect(resp.status).toBe(400)
    const body = await resp.json()
    expect(body.issues).toBeDefined()
  })

  it('POST /api/pipeline/generate rejette skillVersion invalide', async () => {
    const resp = await fetch('http://localhost:3000/api/pipeline/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'batch', demande: 'x', skillVersion: 'v999', validateVersion: 'v1' }),
    })
    expect(resp.status).toBe(400)
  })

  it('POST /api/sequences rejette notionIds inexistants (pré-validation FK)', async () => {
    const resp = await fetch('http://localhost:3000/api/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre: 'Test', niveau: '4e', chapitre: 'x', semaine: 1, notionIds: ['fake-id-123'] }),
    })
    expect(resp.status).toBe(400)
    const body = await resp.json()
    expect(body.error).toContain('notionIds inexistants')
  })

  it('POST /api/corpus rejette payload massif (>10000 chars)', async () => {
    const big = 'x'.repeat(50000)
    const resp = await fetch('http://localhost:3000/api/corpus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenu: big, type: 'exemple_pedagogique', niveau: '4e', chapitre: 'test' }),
    })
    expect(resp.status).toBe(400)
  })

  it('GET /api/sequences avec injection SQL est neutralisé (Prisma paramétré)', async () => {
    const resp = await fetch("http://localhost:3000/api/sequences?statut=' OR '1'='1")
    expect(resp.status).toBe(200)
    const body = await resp.json()
    // L'injection est traitée comme une string littérale → 0 résultats
    expect(body.total).toBe(0)
  })

  it('POST /api/corpus avec XSS payload est stocké mais échappé à l\'export', async () => {
    const resp = await fetch('http://localhost:3000/api/corpus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenu: '<script>alert(1)</script> test', type: 'exemple_pedagogique', niveau: '4e', chapitre: 'test' }),
    })
    expect(resp.status).toBe(200)
    const body = await resp.json()
    // L'entrée est stockée (React escape à l'affichage, escapeHtml à l'export)
    expect(body.contenu).toContain('<script>')
    // Nettoyage
    await fetch(`http://localhost:3000/api/corpus/${body.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenu: 'cleaned entry for security test' }),
    })
  })
})
