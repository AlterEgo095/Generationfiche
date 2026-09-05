'use client'

// R-01 / Sprint S1-a — Badge d'authentification (TopBar).
// Non authentifié → bouton « Connexion » + formulaire inline.
// Authentifié → badge utilisateur + rôle + bouton « Quitter ».
// Le cookie httpOnly posé par /api/auth/login est envoyé automatiquement
// par tous les fetch same-origin de l'UI (aucun autre changement requis).

import { useCallback, useEffect, useRef, useState } from 'react'
import { LogIn, LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Me {
  authenticated: boolean
  username?: string
  role?: string
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  validator: 'Validateur',
  editor: 'Éditeur',
}

export function AuthBadge() {
  const [me, setMe] = useState<Me | null>(null)
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      setMe((await res.json()) as Me)
    } catch {
      setMe({ authenticated: false })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Ferme le formulaire au clic extérieur
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const login = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `erreur ${res.status}`)
        return
      }
      setOpen(false)
      setPassword('')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    await refresh()
  }

  if (me?.authenticated) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge
          className="gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-300"
          title={`Session : ${me.username} (${me.role})`}
        >
          <ShieldCheck className="size-3" />
          <span className="max-w-[10rem] truncate font-medium">{me.username}</span>
          <span className="font-mono text-[10px] uppercase tracking-wide">
            {ROLE_LABEL[me.role ?? ''] ?? me.role}
          </span>
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Se déconnecter"
          title="Se déconnecter"
          className="size-9 rounded-lg"
          onClick={() => void logout()}
        >
          <LogOut className="size-4 text-slate-500" />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative" ref={boxRef}>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 rounded-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label="Se connecter"
      >
        <LogIn className="size-4" />
        <span className="hidden text-xs sm:inline">Connexion</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-border bg-background p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Connexion requise pour écrire/générer</p>
          <div className="flex flex-col gap-2">
            <Input
              autoFocus
              placeholder="Utilisateur"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !busy) void login()
              }}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button size="sm" className="h-8" disabled={busy || !username || !password} onClick={() => void login()}>
              {busy ? '…' : 'Se connecter'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
