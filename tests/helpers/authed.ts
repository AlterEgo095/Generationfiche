// R-01 / Sprint S1-a — Helper d'authentification pour les tests live.
// Depuis R-01, le proxy exige une session sur /api/** (ferme F-06).
// Les tests live s'authentifient en admin (compte sandbox par défaut).

export const TEST_AUTH = { cookie: '' }

export async function loginTestUser(username = 'admin', password = 'admin123'): Promise<void> {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`login test échoué (${res.status}) — serveur live requis`)
  const raw = res.headers.get('set-cookie') ?? ''
  TEST_AUTH.cookie = raw.split(';')[0]
}

// fetch authentifié contre le serveur live (cookie de session injecté)
export function authed(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (TEST_AUTH.cookie) headers.set('cookie', TEST_AUTH.cookie)
  return fetch(`http://localhost:3000${path}`, { ...init, headers })
}
