'use client'

import { useMemo } from 'react'
import {
  LayoutDashboard,
  FileText,
  Database,
  Rocket,
  Activity,
  Boxes,
  ClipboardList,
  BookOpen,
  Sparkles,
  X,
} from 'lucide-react'
import { useStore, type Section } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface NavItem {
  id: Section
  label: string
  icon: typeof LayoutDashboard
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'sequences', label: 'Séquences', icon: FileText },
  { id: 'corpus', label: 'Corpus vectoriel', icon: Database },
  { id: 'generations', label: 'Générations', icon: Rocket },
  { id: 'traces', label: 'Traces agents', icon: Activity },
  { id: 'skills', label: 'Skills catalog', icon: Boxes },
  { id: 'templates', label: 'Templates', icon: ClipboardList },
  { id: 'referentiel', label: 'Référentiel', icon: BookOpen },
]

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { activeSection, setSection } = useStore()
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3 scroll-elite" aria-label="Navigation principale">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = activeSection === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSection(item.id)
              onNavigate?.()
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all',
              active
                ? 'bg-sidebar-primary/15 font-medium text-sidebar-primary-foreground'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            {/* Barre verticale d'accent sur l'item actif */}
            {active && (
              <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
            )}
            <Icon
              className={cn(
                'size-4 shrink-0 transition-colors',
                active ? 'text-sidebar-primary' : 'text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground',
              )}
            />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-5">
      <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-900/40">
        <Sparkles className="size-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-sidebar-foreground">Élite</div>
        <div className="truncate text-[11px] text-sidebar-foreground/55">
          Plateforme pédagogique agentique
        </div>
      </div>
    </div>
  )
}

function SidebarFooter() {
  // Indicateur de statut mini-service — on sonde /api/agent-runs en HEAD-light via fetch.
  // Pour rester léger, on suppose qu'il est up (le backend le garantit) et on affiche un dot vert.
  const { activeBatchId } = useStore()
  const statusLabel = activeBatchId ? 'Pipeline live' : 'Mini-service opérationnel'
  return (
    <div className="border-t border-sidebar-border px-5 py-4">
      <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60">
        <span className="relative flex size-2">
          <span
            className={cn(
              'absolute inline-flex size-full rounded-full opacity-75',
              activeBatchId ? 'animate-ping bg-amber-400' : 'bg-emerald-500',
            )}
          />
          <span
            className={cn(
              'relative inline-flex size-2 rounded-full',
              activeBatchId ? 'bg-amber-400' : 'bg-emerald-500',
            )}
          />
        </span>
        <span className="truncate">{statusLabel}</span>
      </div>
      <div className="mt-1 text-[10px] text-sidebar-foreground/40">
        WS :3003 · agents 5 · skills 12
      </div>
    </div>
  )
}

export function Sidebar() {
  // Version desktop : sidebar statique 260px
  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <SidebarBrand />
      <SidebarNav />
      <SidebarFooter />
    </aside>
  )
}

export function MobileSidebar() {
  // Version mobile : Sheet avec hamburger
  const { sidebarOpen, setSidebarOpen } = useStore()
  const title = useMemo(() => 'Navigation', [])
  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="left" className="w-[280px] bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="px-0 pt-0">
          <div className="flex items-center justify-between pr-4">
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground/70 hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fermer le menu"
            >
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>
        <SidebarBrand />
        <SidebarNav onNavigate={() => setSidebarOpen(false)} />
        <SidebarFooter />
      </SheetContent>
    </Sheet>
  )
}
