'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { History, Filter, ChevronDown, ChevronRight, Clock, Gauge, AlertOctagon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AgentBadge, DecisionBadge, RunStatutDot, SkillVersionBadge } from '@/components/ui/status-badge'
import { JsonViewer } from '@/components/ui/json-viewer'
import { fetchAgentRuns } from '@/lib/api'
import { useStore } from '@/lib/store'
import { AGENT_LABELS, formatDuration, timeAgo } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { LoadingState, ErrorState, EmptyState } from './states'
import type { AgentName, AgentRun, Decision } from '@/lib/types'

const AGENTS: AgentName[] = ['planificateur', 'knowledge_compiler', 'redacteur', 'critique', 'superviseur']

export function TracesSection() {
  const [agent, setAgent] = useState<string>('')
  const [batchId, setBatchId] = useState<string>('')
  const [sequenceId, setSequenceId] = useState<string>('')
  const [decision, setDecision] = useState<string>('')
  const [statut, setStatut] = useState<string>('')
  const [visibleCount, setVisibleCount] = useState(20)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['agent-runs', { agent, batchId, sequenceId, decision, statut }],
    queryFn: () =>
      fetchAgentRuns({
        agent: agent || undefined,
        batchId: batchId || undefined,
        sequenceId: sequenceId || undefined,
        decision: decision || undefined,
        statut: statut || undefined,
        limit: 100,
      }),
    staleTime: 15_000,
  })

  const runs = data?.items ?? []
  const stats = useMemo(() => computeStats(runs), [runs])
  const visibleRuns = runs.slice(0, visibleCount)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={History} label="Total runs" value={stats.total} color="emerald" />
        <StatCard icon={Gauge} label="Durée moyenne" value={stats.total > 0 ? formatDuration(stats.avgDuration) : '—'} color="teal" />
        <StatCard icon={AlertOctagon} label="Taux d'erreur" value={`${stats.errorRate}%`} color={stats.errorRate > 0 ? 'rose' : 'emerald'} />
        <StatCard icon={Clock} label="Runs récents (24h)" value={stats.recent24h} color="violet" />
      </div>

      {/* By-agent chips */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Par agent :</span>
            {AGENTS.map((a) => {
              const count = stats.byAgent[a] ?? 0
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAgent(agent === a ? '' : a)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                    agent === a
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-border bg-card hover:border-emerald-300',
                  )}
                >
                  <AgentBadge value={a} />
                  <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="size-4" /> Filtres
        </div>
        <Select value={agent} onValueChange={(v) => setAgent(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-[180px]" aria-label="Agent"><SelectValue placeholder="Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous agents</SelectItem>
            {AGENTS.map((a) => (
              <SelectItem key={a} value={a}>{AGENT_LABELS[a]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={decision} onValueChange={(v) => setDecision(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="Décision"><SelectValue placeholder="Décision" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes décisions</SelectItem>
            <SelectItem value="continue">Continue</SelectItem>
            <SelectItem value="retry">Retry</SelectItem>
            <SelectItem value="fail">Échec</SelectItem>
            <SelectItem value="escalade_humaine">Escalade</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statut} onValueChange={(v) => setStatut(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="Statut"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          placeholder="batch_id…"
          className="h-9 w-[200px] font-mono text-xs"
        />
        <Input
          value={sequenceId}
          onChange={(e) => setSequenceId(e.target.value)}
          placeholder="sequence_id…"
          className="h-9 w-[200px] font-mono text-xs"
        />
        <div className="ml-auto text-xs text-muted-foreground">{runs.length} traces</div>
      </div>

      {isLoading && <LoadingState message="Chargement des traces…" />}
      {isError && <ErrorState message={error instanceof Error ? error.message : 'Erreur'} onRetry={() => refetch()} />}
      {!isLoading && !isError && runs.length === 0 && (
        <EmptyState
          icon={History}
          title="Aucune trace"
          description="Aucun AgentRun ne correspond aux filtres. Lancez un pipeline pour générer des traces."
        />
      )}
      {!isLoading && !isError && runs.length > 0 && (
        <div className="relative space-y-2 pl-5">
          <div className="absolute bottom-2 left-1.5 top-2 w-px bg-border" />
          {visibleRuns.map((run) => (
            <TimelineRunEntry key={run.id} run={run} />
          ))}
          {visibleCount < runs.length && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((c) => c + 20)}
              className="mt-2 w-full text-xs"
            >
              Charger plus ({runs.length - visibleCount} restants)
            </Button>
          )}
        </div>
      )}
    </motion.div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof History
  label: string
  value: string | number
  color: 'emerald' | 'teal' | 'rose' | 'violet'
}) {
  const colors = {
    emerald: 'from-emerald-500 to-teal-600',
    teal: 'from-teal-500 to-emerald-600',
    rose: 'from-rose-500 to-orange-600',
    violet: 'from-violet-500 to-fuchsia-600',
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        <div className={cn('flex size-9 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow', colors[color])}>
          <Icon className="size-4" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function TimelineRunEntry({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false)
  const { setGenerationPreset, setSection } = useStore()
  return (
    <div className="relative">
      <span className="absolute -left-[14px] top-3.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
      <Card className="transition-colors hover:border-emerald-300">
        <CardContent className="py-3">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center justify-between gap-2 text-left"
            aria-expanded={expanded}
          >
            <div className="flex flex-wrap items-center gap-2">
              <RunStatutDot value={run.statut} />
              <AgentBadge value={run.agent} />
              {run.skill && <SkillVersionBadge value={run.skill} />}
              <DecisionBadge value={run.decision} />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {run.sequence_titre && <span className="hidden truncate text-xs sm:inline">{run.sequence_titre}</span>}
              <span className="font-mono">{formatDuration(run.durationMs)}</span>
              <span>{timeAgo(run.timestamp)}</span>
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </div>
          </button>

          {run.batchId && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>Batch:</span>
              <code className="rounded bg-muted px-1 py-0.5 font-mono">{run.batchId}</code>
              {run.sequenceId && (
                <button
                  type="button"
                  onClick={() => {
                    setGenerationPreset({ sequenceId: run.sequenceId })
                    setSection('sequences')
                  }}
                  className="ml-1 text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  → Voir la séquence
                </button>
              )}
            </div>
          )}

          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-3 space-y-2"
            >
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Input</div>
                <JsonViewer value={run.input} />
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Output</div>
                <JsonViewer value={run.output} />
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function computeStats(runs: AgentRun[]) {
  const total = runs.length
  const byAgent: Record<string, number> = {}
  let totalDuration = 0
  let errorCount = 0
  const now = Date.now()
  const yesterday = now - 24 * 60 * 60 * 1000
  let recent24h = 0
  for (const r of runs) {
    byAgent[r.agent] = (byAgent[r.agent] ?? 0) + 1
    totalDuration += r.durationMs
    if (r.statut === 'error' || r.decision === 'fail' || r.decision === 'escalade_humaine') errorCount++
    if (new Date(r.timestamp).getTime() >= yesterday) recent24h++
  }
  return {
    total,
    byAgent,
    avgDuration: total > 0 ? Math.round(totalDuration / total) : 0,
    errorRate: total > 0 ? Math.round((errorCount / total) * 100) : 0,
    recent24h,
  }
}
