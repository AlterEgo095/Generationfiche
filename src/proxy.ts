// Proxy — P4-3 (Sprint 4) Security Hardening
// Next.js 16 renomme middleware → proxy. Ajoute les headers de sécurité.

import { NextResponse, type NextRequest } from 'next/server'

export function proxy(_req: NextRequest) {
  const response = NextResponse.next()

  // Security headers
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

export const config = {
  matcher: [
    // Applique sur toutes les routes sauf les assets statiques
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|manifest.json|sw.js|icon-).*)',
  ],
}
