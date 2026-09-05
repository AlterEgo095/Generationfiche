// ============================================================
// R-01 / Sprint S1-a — Authentification & autorisation API (F-01/F-06)
// ------------------------------------------------------------
// Ferme F-06 (zéro auth) côté API :
//  - 3 rôles hiérarchiques : editor < validator < admin
//  - Session = token signé HMAC-SHA256 (cookie httpOnly `gf_session`
//    OU header Authorization: Bearer) — TTL 12 h
//  - Matrice d'accès centralisée (décision par méthode HTTP)
//  - Middleware src/middleware.ts : bloque TOUTES les routes /api/**
//    sauf /api/auth/{login,logout,me}
//  - Feature flag AUTH_ENABLED=false → rollback instantané (comportement
//    d'origine, routes publiques) — utilisé pour régression/rollback
// Contraintes : AUCUNE dépendance Node-only (Web Crypto uniquement)
// → utilisable dans le middleware Edge ET les handlers Node/Bun.
// ============================================================

export const SESSION_COOKIE = 'gf_session'
export const SESSION_TTL_SECONDS = 12 * 3600

export type Role = 'editor' | 'validator' | 'admin'

export interface SessionUser {
  username: string
  role: Role
  iat: number
  exp: number
}

export class ApiAuthError extends Error {
  status: 401 | 403
  constructor(message: string, status: 401 | 403) {
    super(message)
    this.status = status
  }
}

const ROLE_RANK: Record<Role, number> = { editor: 1, validator: 2, admin: 3 }

export function isRole(value: string): value is Role {
  return value === 'editor' || value === 'validator' || value === 'admin'
}

export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

// ------------------------------------------------------------
// Configuration (lue dynamiquement → testable, hot-reload friendly)
// ------------------------------------------------------------

// R-01 : feature flag de rollback. Défaut ON (on ferme F-06).
export function isAuthEnabled(): boolean {
  return process.env.AUTH_ENABLED !== 'false'
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (secret && secret.length >= 16) return secret
  // Défaut sandbox/dev explicite — NE JAMAIS utiliser en production exposée.
  return 'gf-dev-insecure-secret-do-not-use-in-prod'
}

// Format AUTH_USERS : "user:role:password,user:role:password"
// Défaut sandbox (démo) si absent.
export function listUsers(): Array<{ username: string; role: Role; password: string }> {
  const raw = process.env.AUTH_USERS
  const source =
    raw && raw.trim().length > 0
      ? raw
      : 'admin:admin:admin123,validator:validator:validator123,editor:editor:editor123'
  const users: Array<{ username: string; role: Role; password: string }> = []
  for (const entry of source.split(',')) {
    const parts = entry.trim().split(':')
    if (parts.length !== 3) continue
    const [username, role, password] = parts
    if (!username || !password || !isRole(role)) continue
    users.push({ username, role, password })
  }
  return users
}

export function checkCredentials(username: string, password: string): { username: string; role: Role } | null {
  const user = listUsers().find((u) => u.username === username)
  if (!user) return null
  if (!timingSafeEqual(user.password, password)) return null
  return { username: user.username, role: user.role }
}

// Comparaison en temps quasi-constant (sans node:crypto — compat Edge).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // compare quand même pour minimiser la fuite de longueur
    let drain = 0
    for (let i = 0; i < b.length; i++) drain |= b.charCodeAt(i) ^ a.charCodeAt(i % Math.max(a.length, 1))
    return drain === 1 && false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ------------------------------------------------------------
// Token de session : base64url(payload) + '.' + base64url(HMAC-SHA256)
// ------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

async function hmacSha256(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8ToBytes(secret) as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, utf8ToBytes(payload) as unknown as ArrayBuffer)
  return bytesToBase64Url(new Uint8Array(sig))
}

export async function createSessionToken(
  user: { username: string; role: Role },
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload = { v: 1, sub: user.username, role: user.role, iat: now, exp: now + ttlSeconds }
  const body = bytesToBase64Url(utf8ToBytes(JSON.stringify(payload)))
  const sig = await hmacSha256(body, getAuthSecret())
  return `${body}.${sig}`
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = await hmacSha256(body, getAuthSecret())
  if (!timingSafeEqual(sig, expected)) return null
  try {
    const payload = JSON.parse(bytesToUtf8(base64UrlToBytes(body))) as {
      sub?: unknown
      role?: unknown
      iat?: unknown
      exp?: unknown
    }
    if (!payload || !isRole(payload.role as string) || typeof payload.sub !== 'string') return null
    const now = Math.floor(Date.now() / 1000)
    if (typeof payload.exp !== 'number' || payload.exp < now) return null
    return {
      username: payload.sub,
      role: payload.role as Role,
      iat: typeof payload.iat === 'number' ? payload.iat : 0,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

// ------------------------------------------------------------
// Extraction de session depuis une requête (cookie OU Bearer)
// ------------------------------------------------------------

function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export async function getSessionFromRequest(req: Request): Promise<SessionUser | null> {
  if (!isAuthEnabled()) return null
  const auth = req.headers.get('authorization')
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return verifySessionToken(auth.slice(7).trim())
  }
  const cookies = parseCookieHeader(req.headers.get('cookie'))
  const token = cookies[SESSION_COOKIE]
  if (token) return verifySessionToken(token)
  return null
}

// Pour les handlers (après middleware) : exige une session, optionnellement un rôle.
export async function requireApiUser(
  req: Request,
  opts: { minRole?: Role } = {},
): Promise<SessionUser> {
  const session = await getSessionFromRequest(req)
  if (!session) throw new ApiAuthError('Authentification requise', 401)
  if (opts.minRole && !roleAtLeast(session.role, opts.minRole)) {
    throw new ApiAuthError(`Rôle insuffisant (requis: ${opts.minRole})`, 403)
  }
  return session
}

// ------------------------------------------------------------
// Matrice d'accès centralisée (décision grossière par méthode).
// Les règles fines dépendant du body (ex: fiche_reference → validator)
// sont appliquées DANS les handlers via requireApiUser().
// ------------------------------------------------------------

export interface AccessDecision {
  authRequired: boolean
  minRole?: Role
  reason?: string
}

// Routes d'authentification : toujours publiques.
const AUTH_EXEMPT = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/me'])

export function decideAccess(pathname: string, method: string): AccessDecision {
  if (!isAuthEnabled()) return { authRequired: false, reason: 'AUTH_ENABLED=false' }
  if (AUTH_EXEMPT.has(pathname)) return { authRequired: false, reason: 'route-auth' }

  const upper = method.toUpperCase()
  if (upper === 'GET' || upper === 'HEAD') {
    return { authRequired: true, minRole: 'editor', reason: 'lecture réservée aux utilisateurs authentifiés' }
  }
  if (upper === 'DELETE') {
    return { authRequired: true, minRole: 'admin', reason: 'suppression réservée au rôle admin' }
  }
  return { authRequired: true, minRole: 'editor', reason: 'écriture réservée aux utilisateurs authentifiés' }
}

// ------------------------------------------------------------
// Anti-bruteforce login (en mémoire, mono-instance — F-17 documenté)
// ------------------------------------------------------------
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 5 * 60 * 1000

export function loginRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }
  entry.count += 1
  if (entry.count > MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { allowed: true }
}

export function resetLoginRateLimit(key: string): void {
  attempts.delete(key)
}
