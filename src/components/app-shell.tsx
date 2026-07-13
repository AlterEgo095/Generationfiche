'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sidebar, MobileSidebar } from '@/components/sections/sidebar'
import { TopBar } from '@/components/sections/topbar'
import { useStore } from '@/lib/store'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { setSidebarOpen } = useStore()
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1">
        <Sidebar />
        <MobileSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />

          {/* Mobile hamburger — flottant au-dessus du topbar */}
          <Button
            variant="outline"
            size="icon"
            aria-label="Ouvrir le menu"
            className="fixed left-3 top-3 z-40 size-9 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-4" />
          </Button>

          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8" role="main">
            {children}
          </main>

          <Footer />
        </div>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer
      className="mt-auto border-t border-border bg-muted/30 px-4 py-4 md:px-8"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col items-start justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">Élite v2</span>
          <span>·</span>
          <span>Plateforme pédagogique agentique</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            Agents autonomes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-teal-500" />
            Critique 2 couches
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="inline-block size-1.5 rounded-full bg-amber-500" />
            WebSocket :3003
          </span>
        </div>
      </div>
    </footer>
  )
}
