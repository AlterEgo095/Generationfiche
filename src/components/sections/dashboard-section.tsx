'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Activity,
  FileCheck2,
  Database,
  History,
  TrendingUp,
  ArrowRight,
  Layers,
  ShieldCheck,
  GraduationCap,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentBadge, DecisionBadge, NiveauBadge, SkillVersionBadge, StatutBadge, RunStatutDot } from '@/components/ui/status-badge'
import { fetchDashboard } from '@/lib/api'
import { useStore } from '@/lib/store'
import { formatDuration, timeAgo } from '@/lib/ui'
import { LoadingState, ErrorState } from './states'
import type { DashboardData, StatutSequence } from '@/lib/types'

const STATUTS: StatutSequence[] = ['validee', 'en_cours', 'planifiee', 'en_attente', 'echec']
const STATUT_DONUT_COLORS: Record<StatutSequence, string> = {
  validee: '#10b981',
  en_cours: '#14b8a6',
  planifiee: '#0ea5e9',
  en_attente: '#94a3b8',
  echec: '#f43f5e',
}

export function DashboardSection() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  if (isLoading) return <LoadingState message="Chargement du tableau de bord…" />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Erreur inconnue'} onRetry={() => refetch()} />
  if (!data) return null

  return <DashboardContent data={data} />
}

function DashboardContent({ data }: { data: DashboardData }) {
  const { setSection, setGenerationPreset } = useStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={FileCheck2}
          label="Séquences"
          value={data.counts.sequences}
          gradient="from-emerald-500 to-teal-600"
          footer={
            <div className="flex flex-wrap gap-1">
              {STATUTS.filter((s) => data.byStatut[s] > 0).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <span className="size-1.5 rounded-full" style={{ background: STATUT_DONUT_COLORS[s] }} />
                  {data.byStatut[s]}
                </span>
              ))}
            </div>
          }
        />
        <KpiCard
          icon={CheckCircle2}
          label="Livrables validés"
          value={data.counts.livrables}
          gradient="from-teal-500 to-emerald-600"
          footer={
            <div className="text-[11px] text-muted-foreground">
              {data.funnel.generees > 0
                ? `${Math.round((data.funnel.validees / Math.max(1, data.funnel.generees)) * 100)}% du funnel`
                : 'Aucune génération'}
            </div>
          }
        />
        <KpiCard
          icon={Database}
          label="Corpus vectoriel"
          value={data.counts.corpus}
          gradient="from-amber-500 to-orange-600"
          footer={<div className="text-[11px] text-muted-foreground">8 notions · référentiel v1</div>}
        />
        <KpiCard
          icon={Activity}
          label="Traces agents (24h)"
          value={data.counts.agentRuns}
          gradient="from-violet-500 to-fuchsia-600"
          footer={<div className="text-[11px] text-muted-foreground">5 agents autonomes</div>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pipeline funnel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
              Funnel de validation
            </CardTitle>
            <CardDescription>Conversion des générations à travers les couches du pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <FunnelBars funnel={data.funnel} />
          </CardContent>
        </Card>

        {/* Séquences par statut (donut custom) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4 text-teal-600 dark:text-teal-400" />
              Séquences par statut
            </CardTitle>
            <CardDescription>Répartition courante</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutStatut byStatut={data.byStatut} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent runs */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-emerald-600 dark:text-emerald-400" />
              Runs agents récents
            </CardTitle>
            <CardDescription>10 dernières exécutions AgentRun</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto scroll-elite -mx-2">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">Agent</th>
                    <th className="px-2 py-2 text-left font-medium">Skill</th>
                    <th className="px-2 py-2 text-left font-medium">Décision</th>
                    <th className="px-2 py-2 text-right font-medium">Durée</th>
                    <th className="px-2 py-2 text-left font-medium">Quand</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentRuns.slice(0, 10).map((run) => (
                    <tr key={run.id} className="border-t border-border/50 hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <RunStatutDot value={run.statut} />
                          <AgentBadge value={run.agent} />
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        {run.skill ? <SkillVersionBadge value={run.skill} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-2"><DecisionBadge value={run.decision} /></td>
                      <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground">
                        {formatDuration(run.durationMs)}
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{timeAgo(run.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent livrables */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              Livrables récents
            </CardTitle>
            <CardDescription>Validés par la critique 2 couches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid max-h-96 gap-2 overflow-y-auto scroll-elite">
              {data.recentLivrables.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">Aucun livrable validé pour le moment.</div>
              )}
              {data.recentLivrables.map((liv) => (
                <button
                  key={liv.id}
                  type="button"
                  onClick={() => {
                    setGenerationPreset({ sequenceId: liv.sequenceId })
                    setSection('sequences')
                  }}
                  className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-emerald-300 hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{liv.sequence.titre}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <NiveauBadge value={liv.sequence.niveau} />
                      <SkillVersionBadge value={liv.skillVersion} />
                      {liv.valide && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle2 className="size-3" /> Validé
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  gradient,
  footer,
}: {
  icon: typeof Activity
  label: string
  value: number
  gradient: string
  footer?: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 py-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-white shadow-md`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-2xl font-semibold text-foreground">{value}</div>
          {footer && <div className="mt-1">{footer}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

// Funnel horizontal custom (pas de recharts pour ce composant — densité dashboard)
function FunnelBars({ funnel }: { funnel: DashboardData['funnel'] }) {
  const stages: { label: string; value: number; color: string }[] = [
    { label: 'Générées', value: funnel.generees, color: 'bg-sky-500' },
    { label: 'Structurel OK', value: funnel.structurel_ok, color: 'bg-teal-500' },
    { label: 'Pédagogique OK', value: funnel.pedagogique_ok, color: 'bg-emerald-500' },
    { label: 'Validées', value: funnel.validees, color: 'bg-emerald-600' },
  ]
  const max = Math.max(1, ...stages.map((s) => s.value))
  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const pct = max > 0 ? (stage.value / max) * 100 : 0
        const convPct = i === 0 || funnel.generees === 0 ? null : Math.round((stage.value / funnel.generees) * 100)
        return (
          <div key={stage.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{stage.label}</span>
              <span className="text-muted-foreground">
                {stage.value}
                {convPct !== null && <span className="ml-2 text-[10px]">({convPct}%)</span>}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                className={`h-full rounded-full ${stage.color}`}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Donut "Séquences par statut" — SVG inline (léger, pas besoin de recharts pour un simple donut)
function DonutStatut({ byStatut }: { byStatut: Record<StatutSequence, number> }) {
  const total = STATUTS.reduce((sum, s) => sum + (byStatut[s] || 0), 0)
  const radius = 60
  const circ = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="18" className="text-muted/40" />
        {total > 0 &&
          STATUTS.map((s) => {
            const v = byStatut[s] || 0
            if (v === 0) return null
            const len = (v / total) * circ
            const seg = (
              <motion.circle
                key={s}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={STATUT_DONUT_COLORS[s]}
                strokeWidth="18"
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              />
            )
            offset += len
            return seg
          })}
        {/* Centre */}
        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="rotate-90 fill-foreground text-2xl font-semibold"
          style={{ transform: 'rotate(90deg)', transformOrigin: '80px 80px' }}
        >
          {total}
        </text>
        <text
          x="80"
          y="94"
          textAnchor="middle"
          className="rotate-90 fill-muted-foreground text-[10px]"
          style={{ transform: 'rotate(90deg)', transformOrigin: '80px 80px' }}
        >
          séquences
        </text>
      </svg>
      <div className="flex-1 space-y-1.5">
        {STATUTS.map((s) => (
          <div key={s} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: STATUT_DONUT_COLORS[s] }} />
              <span className="capitalize text-foreground">
                {s.replace('_', ' ')}
              </span>
            </span>
            <span className="font-mono text-muted-foreground">{byStatut[s] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
