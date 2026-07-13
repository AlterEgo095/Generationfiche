'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Boxes,
  Brain,
  PenLine,
  ShieldCheck,
  Rocket,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Scale,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useState } from 'react'
import { fetchSkills } from '@/lib/api'
import { AGENT_LABELS, agentColor } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { LoadingState, ErrorState } from './states'
import type { AgentName, SkillDescriptor } from '@/lib/types'

const AGENT_ORDER: { agent: AgentName; icon: typeof Brain; description: string }[] = [
  { agent: 'planificateur', icon: Brain, description: 'Décompose la demande en batch planifié et vérifie les prérequis.' },
  { agent: 'knowledge_compiler', icon: Boxes, description: 'Compile le GenerationContext figé : exemples, références de style, règles.' },
  { agent: 'redacteur', icon: PenLine, description: 'Génère le couple (contenu, méthode) pour chaque section du template.' },
  { agent: 'critique', icon: ShieldCheck, description: 'Critique à 2 couches : structurelle (TS) puis pédagogique (LLM).' },
  { agent: 'superviseur', icon: Rocket, description: 'Rend la fiche finale, exporte, commite le batch avec escalade.' },
]

export function SkillsSection() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills,
    staleTime: 60_000,
  })

  if (isLoading) return <LoadingState message="Chargement du catalogue…" />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Erreur'} onRetry={() => refetch()} />

  const skills = data?.items ?? []
  const grouped = groupByAgent(skills)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {AGENT_ORDER.map(({ agent, icon: Icon, description }) => {
        const agentSkills = grouped[agent] ?? []
        if (agentSkills.length === 0) return null
        // Trouver les skills versionnés (v1 + v2) et les non-versionnés
        const versioned = findVersionedPairs(agentSkills)
        const nonVersioned = agentSkills.filter((s) => !versioned.some((pair) => pair.includes(s)))

        return (
          <section key={agent} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={cn('flex size-8 items-center justify-center rounded-lg', agentColor(agent).bg, agentColor(agent).text)}>
                <Icon className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{AGENT_LABELS[agent]}</h2>
                <p className="text-[11px] text-muted-foreground">{description}</p>
              </div>
              <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">
                {agentSkills.length} skill{agentSkills.length > 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="grid gap-3">
              {/* Versioned: side-by-side VS */}
              {versioned.map((pair) => (
                <VersionedSkillCard key={pair[0].nom} pair={pair} />
              ))}
              {/* Non-versioned: simple cards */}
              {nonVersioned.map((s) => (
                <SimpleSkillCard key={s.id} skill={s} />
              ))}
            </div>
          </section>
        )
      })}
    </motion.div>
  )
}

function groupByAgent(skills: SkillDescriptor[]): Record<string, SkillDescriptor[]> {
  const out: Record<string, SkillDescriptor[]> = {}
  for (const s of skills) {
    if (!out[s.agent]) out[s.agent] = []
    out[s.agent].push(s)
  }
  return out
}

function findVersionedPairs(skills: SkillDescriptor[]): SkillDescriptor[][] {
  const byNom: Record<string, SkillDescriptor[]> = {}
  for (const s of skills) {
    if (!byNom[s.nom]) byNom[s.nom] = []
    byNom[s.nom].push(s)
  }
  return Object.values(byNom).filter((arr) => arr.length > 1)
}

function SimpleSkillCard({ skill }: { skill: SkillDescriptor }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between gap-2 text-left">
              <CardTitle className="flex items-center gap-2 text-sm">
                {open ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                <span className="font-mono">{skill.nom}</span>
                <Badge variant="outline" className="font-mono text-[10px] border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {skill.version}
                </Badge>
                {skill.active && (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[9px] uppercase text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Active
                  </Badge>
                )}
              </CardTitle>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{skill.description}</p>
          <p className="mt-1.5 text-xs italic text-foreground/70">« {skill.critique} »</p>
          {open && (
            <CollapsibleContent className="mt-3">
              {skill.parametres.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun paramètre configurable.</p>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Paramètres</div>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1 text-left">Clé</th>
                          <th className="px-2 py-1 text-left">Type</th>
                          <th className="px-2 py-1 text-left">Défaut</th>
                          <th className="px-2 py-1 text-left">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skill.parametres.map((p) => (
                          <tr key={p.cle} className="border-t border-border">
                            <td className="px-2 py-1 font-mono text-emerald-700 dark:text-emerald-300">{p.cle}</td>
                            <td className="px-2 py-1 font-mono text-amber-700 dark:text-amber-300">{p.type}</td>
                            <td className="px-2 py-1 font-mono text-foreground/80">{p.defaut}</td>
                            <td className="px-2 py-1 text-muted-foreground">{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  )
}

function VersionedSkillCard({ pair }: { pair: SkillDescriptor[] }) {
  const sorted = [...pair].sort((a, b) => a.version.localeCompare(b.version))
  const v1 = sorted.find((s) => s.version === 'v1')
  const v2 = sorted.find((s) => s.version === 'v2')
  if (!v1 || !v2) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Scale className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-mono">{v1.nom}</span>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">{pair.length} versions</Badge>
        </CardTitle>
        <CardDescription className="text-xs">Comparaison A/B — sélectionnez la version depuis le Lanceur de génération.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <VersionCard skill={v1} />
          {/* VS divider */}
          <div className="hidden items-center justify-center sm:flex">
            <div className="absolute flex size-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-emerald-400 bg-background text-xs font-bold text-emerald-600 dark:text-emerald-400" style={{ position: 'relative', left: '-50%' }}>
              VS
            </div>
          </div>
          <VersionCard skill={v2} />
        </div>
      </CardContent>
    </Card>
  )
}

function VersionCard({ skill }: { skill: SkillDescriptor }) {
  return (
    <div className="relative rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">{skill.version}</span>
        {skill.active && (
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[9px] uppercase text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="size-2.5 mr-0.5" /> Active
          </Badge>
        )}
      </div>
      <p className="mt-1.5 text-xs text-foreground/85">{skill.description}</p>
      <div className="mt-2 rounded-md bg-amber-50/60 p-1.5 text-[11px] italic text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
        {skill.critique}
      </div>
      {skill.parametres.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {skill.parametres.map((p) => (
            <span key={p.cle} className="rounded border border-border bg-muted/40 px-1 py-0.5 font-mono text-[10px]">
              {p.cle}={p.defaut}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
