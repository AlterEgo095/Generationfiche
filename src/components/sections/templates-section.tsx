'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ClipboardList, FileJson, CheckCircle2, Hash, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { JsonViewer } from '@/components/ui/json-viewer'
import { cn } from '@/lib/utils'
import { fetchTemplates } from '@/lib/api'
import { LoadingState, ErrorState, EmptyState } from './states'
import type { FicheTemplate } from '@/lib/types'

export function TemplatesSection() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
    staleTime: 60_000,
  })
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)

  if (isLoading) return <LoadingState message="Chargement des templates…" />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Erreur'} onRetry={() => refetch()} />

  const templates = data?.items ?? []
  if (templates.length === 0) {
    return <EmptyState icon={ClipboardList} title="Aucun template" description="Aucun FicheTemplate n'est enregistré en base." />
  }
  const selected = templates.find((t) => t.version === selectedVersion) ?? templates[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Versions list */}
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelectedVersion(t.version)}
            className={cn(
              'rounded-lg border px-3 py-2 text-left transition-all',
              selected.version === t.version
                ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-300 dark:border-emerald-500 dark:bg-emerald-950/30'
                : 'border-border hover:border-emerald-300',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">{t.version}</span>
              {t.active && (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[9px] uppercase text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Active
                </Badge>
              )}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.nom}</div>
          </button>
        ))}
      </div>

      {/* Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-emerald-600 dark:text-emerald-400" />
            {selected.nom}
          </CardTitle>
          <CardDescription>
            Template version <span className="font-mono text-emerald-700 dark:text-emerald-400">{selected.version}</span> · {selected.structure.sections.length} sections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual structure */}
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Structure de la fiche</div>
            <div className="space-y-1.5">
              {selected.structure.sections.map((sec, i) => (
                <div
                  key={sec.id}
                  className={cn(
                    'flex items-center gap-3 rounded-md border p-2.5',
                    sec.obligatoire
                      ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/15'
                      : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30',
                  )}
                >
                  <div className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded text-[10px] font-mono font-semibold',
                    sec.obligatoire ? 'bg-emerald-600 text-white' : 'bg-slate-400 text-white',
                  )}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">{sec.id}</code>
                      <span className="text-sm text-foreground">{sec.label}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Hash className="size-2.5" /> min {sec.min_mots} mots
                      </span>
                      {sec.duree_min && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="size-2.5" /> ≥ {sec.duree_min} min
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    'text-[9px] uppercase',
                    sec.obligatoire
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
                  )}>
                    {sec.obligatoire ? 'Obligatoire' : 'Optionnel'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Contraintes */}
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Contraintes globales</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ConstraintRow label="Ton" value={selected.structure.contraintes.ton} />
              <ConstraintRow label="Format questions" value={selected.structure.contraintes.format_questions} />
            </div>
          </div>

          {/* Raw JSON */}
          <CollapsibleJson label="JSON brut" value={selected.structure} />
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ConstraintRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs text-foreground">{value}</div>
    </div>
  )
}

function CollapsibleJson({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <FileJson className="size-3.5" />
          {label}
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {open ? 'Masquer' : 'Afficher'}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-2">
        <JsonViewer value={value} defaultOpen />
      </CollapsibleContent>
    </Collapsible>
  )
}
