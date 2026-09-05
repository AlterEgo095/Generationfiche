// R-01 / Sprint S1-a — POST /api/auth/login
// Body : {username, password} → cookie httpOnly `gf_session` + {username, role}
// Anti-bruteforce : 5 tentatives / 5 min / username (en mémoire, mono-instance).
import { NextRequest, NextResponse } from 'next/server'
import {
  checkCredentials,
  createSessionToken,
  loginRateLimit,
  resetLoginRateLimit,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'body JSON invalide' }, { status: 400 })
  }
  const { username, password } = body
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return NextResponse.json({ error: 'username et password requis' }, { status: 400 })
  }

  const rl = loginRateLimit(username)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'trop de tentatives — réessayez plus tard' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 300) } },
    )
  }

  const user = checkCredentials(username, password)
  if (!user) {
    return NextResponse.json({ error: 'identifiants invalides' }, { status: 401 })
  }
  resetLoginRateLimit(username)

  const token = await createSessionToken(user)
  const res = NextResponse.json({ username: user.username, role: user.role })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // sandbox HTTP ; passer à true derrière HTTPS
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
  return res
}
