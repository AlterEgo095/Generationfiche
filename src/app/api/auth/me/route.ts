// R-01 / Sprint S1-a — GET /api/auth/me
// Retourne l'état de session courant (200 même anonyme — utile à l'UI).
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ authenticated: false })
  return NextResponse.json({
    authenticated: true,
    username: session.username,
    role: session.role,
    expires_at: new Date(session.exp * 1000).toISOString(),
  })
}
