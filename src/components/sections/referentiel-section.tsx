'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BookOpen,
  GitBranch,
  Calendar,
  Settings2,
  Network,
  ArrowRight,
  Target,
  Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { JsonViewer } from '@/components/ui/json-viewer'
import { NiveauBadge } from '@/components/ui/status-badge'
import { fetchReferentiel } from '@/lib/api'
import { cn } from '@/lib/utils'
import { LoadingState, ErrorState, EmptyState } from './states'
import type { Notion, Progression, Regle } from '@/lib/types'

export function ReferentielSection() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['referentiel'],
    queryFn: fetchReferentiel,
    staleTime: 60_000,
  })

  if (isLoading) return <LoadingState message="Chargement du référentiel…" />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Erreur'} onRetry={() => refetch()} />
  if (!data) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Tabs defaultValue="notions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="notions" className="text-xs">Notions</TabsTrigger>
          <TabsTrigger value="prerequis" className="text-xs">Prérequis</TabsTrigger>
          <TabsTrigger value="progressions" className="text-xs">Progressions</TabsTrigger>
          <TabsTrigger value="regles" className="text-xs">Règles</TabsTrigger>
        </TabsList>

        <TabsContent value="notions" className="mt-4">
          <NotionsTab notions={data.notions} />
        </TabsContent>
        <TabsContent value="prerequis" className="mt-4">
          <PrerequisTab notions={data.notions} />
        </TabsContent>
        <TabsContent value="progressions" className="mt-4">
          <ProgressionsTab progressions={data.progressions} />
        </TabsContent>
        <TabsContent value="regles" className="mt-4">
          <ReglesTab regles={data.regles} />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

// ============================================================
// NOTIONS
// ============================================================
function NotionsTab({ notions }: { notions: Notion[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {notions.map((n) => (
        <Card key={n.id} className="transition-all hover:border-emerald-300">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">{n.nom}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <NiveauBadge value={n.niveau} />
                  <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    <Layers className="size-2.5" /> {n.chapitre}
                  </Badge>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{n.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {n.competences.map((c, i) => (
                <span key={i} className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                  {c}
                </span>
              ))}
            </div>
            {n.objectifs.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                {n.objectifs.map((o, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <Target className="mt-0.5 size-2.5 shrink-0 text-emerald-500" />
                    {o}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
              <span className="text-[10px] text-muted-foreground">
                {(n.prerequisPour ?? []).length} prérequis
              </span>
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                className="text-[11px] text-emerald-700 hover:underline dark:text-emerald-400"
              >
                {expandedId === n.id ? 'Masquer' : 'Voir prérequis'}
              </button>
            </div>
            {expandedId === n.id && (n.prerequisPour ?? []).length > 0 && (
              <div className="mt-2 space-y-1.5 rounded-md border border-border bg-muted/20 p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Prérequis</div>
                {(n.prerequisPour ?? []).map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 text-[11px]">
                    <ArrowRight className="size-2.5 text-slate-400" />
                    <span className="text-foreground/80">{p.prerequis.nom}</span>
                    <span className="text-muted-foreground">({p.prerequis.niveau})</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-auto text-[9px] uppercase',
                        p.obligation === 'obligatoire'
                          ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
                      )}
                    >
                      {p.obligation}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {expandedId === n.id && (n.prerequisPour ?? []).length === 0 && (
              <div className="mt-2 rounded-md border border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
                Aucun prérequis déclaré pour cette notion.
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================================
// PRÉREQUIS — graphe simple notion ← prérequis
// ============================================================
function PrerequisTab({ notions }: { notions: Notion[] }) {
  const notionById = useMemo(() => Object.fromEntries(notions.map((n) => [n.id, n])), [notions])
  const withPrerequis = notions.filter((n) => (n.prerequisPour ?? []).length > 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="size-4 text-teal-600 dark:text-teal-400" />
          Graphe des prérequis
        </CardTitle>
        <CardDescription>
          Pour chaque notion, les prérequis obligatoires (rose) et recommandés (ambre).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {withPrerequis.length === 0 ? (
          <EmptyState icon={GitBranch} title="Aucun prérequis déclaré" description="Le graphe est vide." />
        ) : (
          <div className="space-y-3">
            {withPrerequis.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm font-semibold">{n.nom}</span>
                  <NiveauBadge value={n.niveau} />
                  <span className="text-xs text-muted-foreground">← a besoin de</span>
                </div>
                <div className="ml-5 space-y-1.5">
                  {(n.prerequisPour ?? []).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-md border border-l-4 border-border bg-muted/20 px-2 py-1.5 text-xs"
                      style={{
                        borderLeftColor: p.obligation === 'obligatoire' ? '#f43f5e' : '#f59e0b',
                      }}
                    >
                      <ArrowRight className="size-3 text-slate-400" />
                      <span className="font-medium">{p.prerequis.nom}</span>
                      <span className="text-[10px] text-muted-foreground">({p.prerequis.niveau})</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'ml-auto text-[9px] uppercase',
                          p.obligation === 'obligatoire'
                            ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
                        )}
                      >
                        {p.obligation}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// PROGRESSIONS — table triable par semaine
// ============================================================
function ProgressionsTab({ progressions }: { progressions: Progression[] }) {
  const sorted = useMemo(() => [...progressions].sort((a, b) => a.semaine - b.semaine), [progressions])
  const niveaux = useMemo(() => Array.from(new Set(sorted.map((p) => p.niveau))).sort(), [sorted])
  const [filterNiveau, setFilterNiveau] = useState<string>('')
  const visible = filterNiveau ? sorted.filter((p) => p.niveau === filterNiveau) : sorted
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="size-4 text-emerald-600 dark:text-emerald-400" />
          Progressions annuelles
        </CardTitle>
        <CardDescription>Triées par semaine (ordre chronologique du programme).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrer :</span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFilterNiveau('')}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                !filterNiveau ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-border hover:border-emerald-300',
              )}
            >
              Tous
            </button>
            {niveaux.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFilterNiveau(n)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                  filterNiveau === n ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-border hover:border-emerald-300',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Semaine</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Chapitre</TableHead>
                <TableHead>Notion</TableHead>
                <TableHead className="text-right">Durée min.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">S{p.semaine}</TableCell>
                  <TableCell><NiveauBadge value={p.niveau} /></TableCell>
                  <TableCell className="text-xs">{p.chapitre}</TableCell>
                  <TableCell className="text-sm font-medium">{p.notion.nom}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{p.dureeMin} min</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// RÈGLES — groupées par niveau
// ============================================================
function ReglesTab({ regles }: { regles: Regle[] }) {
  const byNiveau = useMemo(() => {
    const out: Record<string, Regle[]> = {}
    for (const r of regles) {
      if (!out[r.niveau]) out[r.niveau] = []
      out[r.niveau].push(r)
    }
    return out
  }, [regles])

  return (
    <div className="space-y-3">
      {Object.entries(byNiveau).sort().map(([niveau, rules]) => (
        <Card key={niveau}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings2 className="size-4 text-violet-600 dark:text-violet-400" />
              Niveau <NiveauBadge value={niveau} />
              <Badge variant="outline" className="ml-1 text-[10px] text-muted-foreground">{rules.length} règles</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clé</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs text-emerald-700 dark:text-emerald-400">{r.cle}</TableCell>
                      <TableCell className="text-xs">
                        {typeof r.valeur === 'string' ? (
                          <span className="text-foreground/85">{r.valeur}</span>
                        ) : (
                          <JsonViewer value={r.valeur} />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={r.active} disabled aria-label="Règle active (lecture seule)" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
