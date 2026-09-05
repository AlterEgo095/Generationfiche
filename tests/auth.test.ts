// R-01 / Sprint S1-a — Tests du module d'authentification (F-06)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createSessionToken,
  verifySessionToken,
  getSessionFromRequest,
  requireApiUser,
  decideAccess,
  roleAtLeast,
  checkCredentials,
  isRole,
  ApiAuthError,
  loginRateLimit,
  resetLoginRateLimit,
  SESSION_COOKIE,
  listUsers,
} from '@/lib/auth'

describe('auth — tokens de session (HMAC-SHA256)', () => {
  it('T1 roundtrip : token créé puis vérifié → session identique', async () => {
    const token = await createSessionToken({ username: 'admin', role: 'admin' })
    const session = await verifySessionToken(token)
    expect(session).not.toBeNull()
    expect(session!.username).toBe('admin')
    expect(session!.role).toBe('admin')
    expect(session!.exp).toBeGreaterThan(session!.iat)
  })

  it('T2 payload altéré → signature invalide → null', async () => {
    const token = await createSessionToken({ username: 'admin', role: 'admin' })
    const [body, sig] = token.split('.')
    // Décodage réel du payload, altération de l'identité, ré-encodage
    const json = Buffer.from(body, 'base64url').toString('utf8')
    const forgedJson = json.replaceAll('admin', 'geger')
    const forged = Buffer.from(forgedJson).toString('base64url')
    expect(forged).not.toBe(body) // le payload a bien changé
    expect(await verifySessionToken(`${forged}.${sig}`)).toBeNull()
  })

  it('T3 signature altérée → null', async () => {
    const token = await createSessionToken({ username: 'editor', role: 'editor' })
    const [body, sig] = token.split('.')
    const fakeSig = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA')
    expect(await verifySessionToken(`${body}.${fakeSig}`)).toBeNull()
  })

  it('T4 token expiré (TTL négatif) → null', async () => {
    const token = await createSessionToken({ username: 'editor', role: 'editor' }, -10)
    expect(await verifySessionToken(token)).toBeNull()
  })

  it('T5 token malformé (pas de séparateur) → null', async () => {
    expect(await verifySessionToken('garbage-sans-point')).toBeNull()
  })
})

describe('auth — rôles hiérarchiques', () => {
  it('T6 hiérarchie editor < validator < admin', () => {
    expect(roleAtLeast('editor', 'editor')).toBe(true)
    expect(roleAtLeast('editor', 'validator')).toBe(false)
    expect(roleAtLeast('validator', 'editor')).toBe(true)
    expect(roleAtLeast('validator', 'validator')).toBe(true)
    expect(roleAtLeast('validator', 'admin')).toBe(false)
    expect(roleAtLeast('admin', 'validator')).toBe(true)
    expect(roleAtLeast('admin', 'admin')).toBe(true)
  })

  it('T7 isRole rejette les rôles inconnus', () => {
    expect(isRole('admin')).toBe(true)
    expect(isRole('superuser')).toBe(false)
    expect(isRole('')).toBe(false)
  })
})

describe('auth — matrice d\'accès decideAccess', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('T8 routes d\'auth exemptées', () => {
    for (const p of ['/api/auth/login', '/api/auth/logout', '/api/auth/me']) {
      expect(decideAccess(p, 'POST').authRequired).toBe(false)
      expect(decideAccess(p, 'GET').authRequired).toBe(false)
    }
  })

  it('T9 GET/HEAD → editor (tout utilisateur authentifié)', () => {
    expect(decideAccess('/api/corpus', 'GET').minRole).toBe('editor')
    expect(decideAccess('/api/corpus', 'HEAD').minRole).toBe('editor')
  })

  it('T10 DELETE → admin', () => {
    expect(decideAccess('/api/corpus/abc', 'DELETE').minRole).toBe('admin')
  })

  it('T11 POST/PATCH/PUT → editor minimum', () => {
    expect(decideAccess('/api/corpus', 'POST').minRole).toBe('editor')
    expect(decideAccess('/api/corpus/abc', 'PATCH').minRole).toBe('editor')
    expect(decideAccess('/api/pipeline/generate', 'POST').minRole).toBe('editor')
  })

  it('T12 AUTH_ENABLED=false → aucune auth (rollback)', () => {
    vi.stubEnv('AUTH_ENABLED', 'false')
    expect(decideAccess('/api/corpus', 'POST').authRequired).toBe(false)
    expect(decideAccess('/api/auth/login', 'POST').authRequired).toBe(false)
  })
})

describe('auth — extraction de session (cookie + Bearer)', () => {
  it('T13 Authorization: Bearer reconnu', async () => {
    const token = await createSessionToken({ username: 'validator', role: 'validator' })
    const req = new Request('http://localhost/api/corpus', {
      headers: { authorization: `Bearer ${token}` },
    })
    const session = await getSessionFromRequest(req)
    expect(session?.username).toBe('validator')
  })

  it('T14 cookie gf_session reconnu', async () => {
    const token = await createSessionToken({ username: 'editor', role: 'editor' })
    const req = new Request('http://localhost/api/corpus', {
      headers: { cookie: `other=1; ${SESSION_COOKIE}=${token}; x=2` },
    })
    expect(session_ok(await getSessionFromRequest(req), 'editor')).toBe(true)
  })

  function session_ok(s: Awaited<ReturnType<typeof getSessionFromRequest>>, u: string): boolean {
    return s !== null && s.username === u
  }

  it('T15 requête anonyme → null', async () => {
    const req = new Request('http://localhost/api/corpus')
    expect(await getSessionFromRequest(req)).toBeNull()
  })

  it('T16 requireApiUser : anonyme → 401, rôle insuffisant → 403, OK sinon', async () => {
    const anon = new Request('http://localhost/api/corpus')
    await expect(requireApiUser(anon)).rejects.toMatchObject({ status: 401 })

    const editorToken = await createSessionToken({ username: 'ed', role: 'editor' })
    const editorReq = new Request('http://localhost/api/corpus', {
      headers: { authorization: `Bearer ${editorToken}` },
    })
    await expect(requireApiUser(editorReq, { minRole: 'admin' })).rejects.toMatchObject({ status: 403 })

    const adminToken = await createSessionToken({ username: 'ad', role: 'admin' })
    const adminReq = new Request('http://localhost/api/corpus', {
      headers: { authorization: `Bearer ${adminToken}` },
    })
    const session = await requireApiUser(adminReq, { minRole: 'admin' })
    expect(session.username).toBe('ad')
  })

  it('T17 ApiAuthError porte un statut 401/403', () => {
    expect(new ApiAuthError('x', 401).status).toBe(401)
    expect(new ApiAuthError('x', 403).status).toBe(403)
  })
})

describe('auth — credentials + anti-bruteforce', () => {
  it('T18 checkCredentials : utilisateur par défaut OK, mauvais mdp KO, inconnu KO', () => {
    // Le défaut sandbox liste admin/validator/editor — voir listUsers()
    const users = listUsers()
    expect(users.length).toBeGreaterThanOrEqual(3)
    const sample = users[0]
    expect(checkCredentials(sample.username, sample.password)).toMatchObject({
      username: sample.username,
      role: sample.role,
    })
    expect(checkCredentials(sample.username, 'mot-de-passe-faux')).toBeNull()
    expect(checkCredentials('intrus', 'x')).toBeNull()
  })

  it('T19 loginRateLimit : 5 tentatives OK puis blocage', () => {
    const key = `test-${Math.random()}`
    resetLoginRateLimit(key)
    for (let i = 0; i < 5; i++) {
      expect(loginRateLimit(key).allowed).toBe(true)
    }
    const blocked = loginRateLimit(key)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })
})
