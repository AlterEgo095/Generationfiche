'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Sparkles, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useStore, SECTION_META } from '@/lib/store'
import { AuthBadge } from '@/components/auth-badge'
import { cn } from '@/lib/utils'

// Etat "monté" via useSyncExternalStore — évite le pattern setState-in-effect.
// Sur le serveur, retourne false ; sur le client, true après hydratation.
const subscribeNoop = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function TopBar() {
  const { activeSection, activeBatchId } = useStore()
  const meta = SECTION_META[activeSection]
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribeNoop, clientSnapshot, serverSnapshot)

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 glass-elite md:px-6"
      role="banner"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{meta.title}</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{meta.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Live batch indicator */}
        {activeBatchId && (
          <Badge
            className="gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            title={`Batch en cours: ${activeBatchId}`}
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wide">Pipeline live</span>
            <Activity className="size-3" />
          </Badge>
        )}

        {/* Auth (R-01 : session 3 rôles) */}
        <AuthBadge />

        {/* Theme toggle */}
        <Button
          variant="outline"
          size="icon"
          aria-label="Basculer le thème"
          title="Basculer le thème clair/sombre"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn('size-9 rounded-lg')}
        >
          {mounted && theme === 'dark' ? (
            <Sun className="size-4 text-amber-400" />
          ) : (
            <Moon className="size-4 text-slate-600" />
          )}
        </Button>

        {/* Brand chip on desktop */}
        <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-300/50 bg-emerald-50 px-2.5 py-1 dark:border-emerald-700/40 dark:bg-emerald-950/30 lg:flex">
          <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Élite v2</span>
        </div>
      </div>
    </header>
  )
}
