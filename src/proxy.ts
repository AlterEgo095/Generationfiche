// Proxy — Next.js 16 (middleware → proxy)
// 1. P4-3 (Sprint 4) Security Hardening : headers de sécurité sur toutes les réponses.
// 2. R-01 (Sprint S1-a) Autorisation API : bloque /api/** sauf /api/auth/{login,logout,me}
//    (matrice centralisée dans src/lib/auth.ts ; rollback AUTH_ENABLED=false).

import { NextResponse, type NextRequest } from 'next/server'
import { decideAccess, getSessionFromRequest, roleAtLeast, type SessionUser } from '@/lib/auth'

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none';"
  )
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return response
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── R-01 : autorisation API (les pages UI restent publiques ; les appels
  //    API du navigateur portent le cookie de session automatiquement) ──
  if (pathname.startsWith('/api')) {
    const access = decideAccess(pathname, req.method)
    if (access.authRequired) {
      const session: SessionUser | null = await getSessionFromRequest(req)
      if (!session) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: 'unauthenticated', hint: 'POST /api/auth/login {username,password} — ou Authorization: Bearer <token>' },
            { status: 401 },
          ),
        )
      }
      if (access.minRole && !roleAtLeast(session.role, access.minRole)) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: 'forbidden', required_role: access.minRole, reason: access.reason },
            { status: 403 },
          ),
        )
      }
      // Propage l'identité aux handlers (la décision fine re-vérifie via requireApiUser()).
      const headers = new Headers(req.headers)
      headers.set('x-gf-user', session.username)
      headers.set('x-gf-role', session.role)
      const response = NextResponse.next({ request: { headers } })
      return applySecurityHeaders(response)
    }
  }

  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    // Applique sur toutes les routes sauf les assets statiques
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|manifest.json|sw.js|icon-).*)',
  ],
}
