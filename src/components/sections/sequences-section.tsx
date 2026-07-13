'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star, Filter, X, Rocket, FileText, Calendar, Layers, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ReactMarkdown from 'react-markdown'
import { fetchSequences, fetchSequence } from '@/lib/api'
import { useStore } from '@/lib/store'
import { AgentBadge, DecisionBadge, NiveauBadge, RunStatutDot, SkillVersionBadge, StatutBadge } from '@/components/ui/status-badge'
import { JsonViewer } from '@/components/ui/json-viewer'
import { formatDuration, timeAgo } from '@/lib/ui'
import { SECTION_LABELS } from '@/lib/contracts'
import { LoadingState, ErrorState, EmptyState } from './states'
import type { SequenceDetail, SequenceListItem, StatutSequence } from '@/lib/types'
import { Star as StarIcon } from 'lucide-react'

const STATUTS: { value: StatutSequence; label: string }[] = [
  { value: 'validee', label: 'Validée' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'planifiee', label: 'Planifiée' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'echec', label: 'Échec' },
]

export function SequencesSection() {
  const [statut, setStatut] = useState<string>('')
  const [niveau, setNiveau] = useState<string>('')
  const [chapitre, setChapitre] = useState<string>('')
  const [search, setSearch] = useState<string>('')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sequences', { statut, niveau, chapitre }],
    queryFn: () => fetchSequences({ statut: statut || undefined, niveau: niveau || undefined, chapitre: chapitre || undefined }),
    staleTime: 30_000,
  })

  const chapitres = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.items.map((s) => s.chapitre))).sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.items
    return data.items.filter(
      (s) =>
        s.titre.toLowerCase().includes(q) ||
        s.notions.some((n) => n.nom.toLowerCase().includes(q)),
    )
  }, [data, search])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Filtres sticky */}
      <div className="sticky top-16 z-20 -mx-4 mb-2 border-b border-border bg-background/85 px-4 py-3 glass-elite md:mx-0 md:rounded-lg md:border">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="size-4" /> Filtres
          </div>
          <Select value={statut} onValueChange={(v) => setStatut(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Statut">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              {STATUTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={niveau} onValueChange={(v) => setNiveau(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9 w-[110px]" aria-label="Niveau">
              <SelectValue placeholder="Niveau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous niveaux</SelectItem>
              {['6e', '5e', '4e', '3e'].map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={chapitre} onValueChange={(v) => setChapitre(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9 w-[200px]" aria-label="Chapitre">
              <SelectValue placeholder="Chapitre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous chapitres</SelectItem>
              {chapitres.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre ou notion…"
            className="h-9 max-w-xs flex-1"
            aria-label="Recherche"
          />
          {(statut || niveau || chapitre || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatut('')
                setNiveau('')
                setChapitre('')
                setSearch('')
              }}
              className="h-9 text-muted-foreground"
            >
              <X className="size-3.5" /> Effacer
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {filtered.length} séquence{filtered.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {isLoading && <LoadingState message="Chargement des séquences…" />}
      {isError && (
        <ErrorState message={error instanceof Error ? error.message : 'Erreur'} onRetry={() => refetch()} />
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Aucune séquence trouvée"
          description="Modifiez les filtres ou lancez un pipeline dans l'onglet Générations."
        />
      )}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((seq, i) => (
            <SequenceCard key={seq.id} sequence={seq} index={i} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

function SequenceCard({ sequence, index }: { sequence: SequenceListItem; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.4) }}
      >
        <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 flex-1 text-sm font-semibold text-foreground">{sequence.titre}</h3>
              <StatutBadge value={sequence.statut} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <NiveauBadge value={sequence.niveau} />
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                {sequence.chapitre}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                <Calendar className="size-3" /> Sem. {sequence.semaine}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {sequence.notions.map((n) => (
                <span key={n.notionId} className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                  {n.nom}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-2">
              <div className="flex items-center gap-2">
                {/* Priorité en étoiles */}
                <div className="flex items-center" title={`Priorité: ${sequence.priorite}`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <StarIcon
                      key={i}
                      className={
                        i < sequence.priorite
                          ? 'size-3 fill-amber-400 text-amber-400'
                          : 'size-3 text-slate-300 dark:text-slate-700'
                      }
                    />
                  ))}
                </div>
                {sequence.livrables_count > 0 && (
                  <SkillVersionBadge value={`v${sequence.templateVersion.replace('v', '')}`} />
                )}
                {sequence.livrables_count > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {sequence.livrables_count} livrable{sequence.livrables_count > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-7 text-xs">
                Détails <ChevronRight className="size-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      <SequenceDetailDrawer sequenceId={sequence.id} open={open} onOpenChange={setOpen} />
    </>
  )
}

function SequenceDetailDrawer({
  sequenceId,
  open,
  onOpenChange,
}: {
  sequenceId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { setSection, setGenerationPreset } = useStore()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sequence', sequenceId],
    queryFn: () => fetchSequence(sequenceId),
    enabled: open,
    staleTime: 60_000,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border px-6 pt-6">
          <SheetTitle className="text-base">
            {isLoading ? <Skeleton className="h-5 w-2/3" /> : data?.titre ?? 'Séquence'}
          </SheetTitle>
          <SheetDescription className="sr-only">Détails de la séquence pédagogique</SheetDescription>
        </SheetHeader>

        {isLoading && <div className="p-6"><LoadingState /></div>}
        {isError && (
          <div className="p-6">
            <ErrorState message={error instanceof Error ? error.message : 'Erreur'} />
          </div>
        )}
        {data && (
          <div className="px-6 pb-6">
            <DetailHeader sequence={data} />
            <Tabs defaultValue="contexte" className="mt-4">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="contexte" className="text-xs">Contexte</TabsTrigger>
                <TabsTrigger value="livrable" className="text-xs">Livrable</TabsTrigger>
                <TabsTrigger value="validation" className="text-xs">Validation</TabsTrigger>
                <TabsTrigger value="traces" className="text-xs">Traces</TabsTrigger>
              </TabsList>
              <TabsContent value="contexte" className="mt-4">
                <ContexteTab sequence={data} />
              </TabsContent>
              <TabsContent value="livrable" className="mt-4">
                <LivrableTab sequence={data} />
              </TabsContent>
              <TabsContent value="validation" className="mt-4">
                <ValidationTab sequence={data} />
              </TabsContent>
              <TabsContent value="traces" className="mt-4">
                <TracesTab sequence={data} />
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex justify-end border-t border-border pt-4">
              <Button
                onClick={() => {
                  setGenerationPreset({ sequenceId: data.id })
                  onOpenChange(false)
                  setSection('generations')
                }}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Rocket className="size-4" />
                {data.livrables.length > 0 ? 'Régénérer' : 'Générer'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailHeader({ sequence }: { sequence: SequenceDetail }) {
  const contexteClasse = useMemo(() => {
    if (!sequence.contexteClasse) return null
    try {
      return typeof sequence.contexteClasse === 'string'
        ? JSON.parse(sequence.contexteClasse)
        : sequence.contexteClasse
    } catch {
      return null
    }
  }, [sequence.contexteClasse])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <NiveauBadge value={sequence.niveau} />
        <Badge variant="outline" className="border-slate-200 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <Layers className="size-3" /> {sequence.chapitre}
        </Badge>
        <Badge variant="outline" className="border-slate-200 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <Calendar className="size-3" /> Semaine {sequence.semaine}
        </Badge>
        <StatutBadge value={sequence.statut} />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          Priorité
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={
                  i < sequence.priorite
                    ? 'size-3 fill-amber-400 text-amber-400'
                    : 'size-3 text-slate-300 dark:text-slate-700'
                }
              />
            ))}
          </div>
        </div>
      </div>

      {contexteClasse && (
        <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="mb-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">Contexte classe</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(contexteClasse).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] dark:bg-card">
                <span className="text-muted-foreground">{k}:</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-300">
                  {Array.isArray(v) ? v.join(', ') : String(v)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ContexteTab({ sequence }: { sequence: SequenceDetail }) {
  if (!sequence.generationContext) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucun contexte compilé"
        description="Le Knowledge Compiler n'a pas encore produit de GenerationContext pour cette séquence. Lancez la génération pour le créer."
      />
    )
  }
  const ctx = sequence.generationContext.payload
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <InfoRow label="Template version" value={ctx.template_version} />
        <InfoRow label="Curriculum version" value={ctx.curriculum_version} />
        <InfoRow label="Compilé le" value={new Date(sequence.generationContext.compiledAt).toLocaleString('fr-FR')} />
        <InfoRow label="Notions" value={`${ctx.notions.length} mobilisée(s)`} />
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">Notions</div>
        <div className="space-y-2">
          {ctx.notions.map((n) => (
            <div key={n.notion_id} className="rounded-lg border border-border bg-muted/30 p-2.5">
              <div className="text-sm font-medium">{n.nom}</div>
              <div className="text-[11px] text-muted-foreground">{n.niveau} · {n.chapitre}</div>
              {n.competences.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {n.competences.map((c, i) => (
                    <span key={i} className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Exemples pédagogiques ({ctx.exemples_pedagogiques.length})</div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2 text-xs scroll-elite">
            {ctx.exemples_pedagogiques.length === 0 && <span className="text-muted-foreground">Aucun</span>}
            {ctx.exemples_pedagogiques.map((ex, i) => (
              <div key={i} className="border-b border-border/40 py-1 last:border-0">
                {typeof ex.score === 'number' && (
                  <span className="mr-1 font-mono text-[10px] text-amber-600">score {ex.score.toFixed(3)}</span>
                )}
                <span className="text-foreground/80">{ex.contenu.slice(0, 100)}…</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Références de style ({ctx.references_style.length})</div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2 text-xs scroll-elite">
            {ctx.references_style.length === 0 && <span className="text-muted-foreground">Aucune (exemplaire)</span>}
            {ctx.references_style.map((r, i) => (
              <div key={i} className="border-b border-border/40 py-1 last:border-0">
                <div className="font-mono text-[10px] text-emerald-600">{r.fiche_id} · {r.niveau} · {r.chapitre}</div>
                <div className="text-foreground/80">{r.extrait.slice(0, 100)}…</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">Règles appliquées</div>
        <JsonViewer value={ctx.regles} />
      </div>
    </div>
  )
}

function LivrableTab({ sequence }: { sequence: SequenceDetail }) {
  if (sequence.livrables.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucun livrable"
        description="Cette séquence n'a pas encore de fiche pédagogique générée."
      />
    )
  }
  const liv = sequence.livrables[sequence.livrables.length - 1]
  const sections = liv.contenu.sections ?? []
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SkillVersionBadge value={liv.skillVersion} />
        <span className="text-muted-foreground">Format: {liv.format}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">Créé {timeAgo(liv.createdAt)}</span>
        {liv.valide && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            Validé
          </span>
        )}
      </div>
      {sections.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <pre className="whitespace-pre-wrap text-xs text-foreground/80">{liv.contenu.markdown}</pre>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => {
            const label = s.label ?? SECTION_LABELS[s.section_id as keyof typeof SECTION_LABELS] ?? s.section_id
            return (
              <div key={s.section_id} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{s.section_id}</span>
                  <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                </div>
                <div className="prose prose-sm max-w-none text-foreground/85 dark:prose-invert">
                  <ReactMarkdown>{s.contenu}</ReactMarkdown>
                </div>
                {s.methode && (
                  <div className="mt-2 rounded-md border-l-4 border-emerald-400 bg-emerald-50/60 p-2 text-xs text-foreground/80 dark:bg-emerald-950/20">
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">Méthode — </span>
                    {s.methode}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ValidationTab({ sequence }: { sequence: SequenceDetail }) {
  if (sequence.livrables.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucune validation"
        description="Aucun livrable à valider pour cette séquence."
      />
    )
  }
  const liv = sequence.livrables[sequence.livrables.length - 1]
  if (liv.validations.length === 0) {
    return <div className="text-sm text-muted-foreground">Aucun résultat de validation enregistré.</div>
  }
  return (
    <div className="space-y-3">
      {liv.validations.map((v) => {
        const decidedBy = v.coucheDeclenchee
        return (
          <div key={v.id} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Validation à 2 couches</div>
              <SkillVersionBadge value={v.skillVersion} />
            </div>

            {/* Couche structurelle */}
            <ValidationLayer
              title="Couche structurelle"
              subtitle="TypeScript pur — sections présentes, longueurs, durées"
              pass={v.structurelPass}
              reasons={v.structurelRaisons}
              decided={decidedBy === 'structurel'}
            />
            {/* Couche pédagogique */}
            <ValidationLayer
              title="Couche pédagogique"
              subtitle="LLM — clarté, progression, pertinence, contexte classe"
              pass={v.pedagogiquePass}
              reasons={v.pedagogiqueRaisons ?? []}
              decided={decidedBy === 'pedagogique'}
              className="mt-3"
            />

            {v.sectionARegenerer && (
              <div className="mt-3 rounded-md border-l-4 border-amber-400 bg-amber-50/60 p-2 text-xs dark:bg-amber-950/20">
                <span className="font-medium text-amber-700 dark:text-amber-300">Section à régénérer :</span>{' '}
                <span className="font-mono">{v.sectionARegenerer}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ValidationLayer({
  title,
  subtitle,
  pass,
  reasons,
  decided,
  className = '',
}: {
  title: string
  subtitle: string
  pass: boolean | null
  reasons: string[]
  decided: boolean
  className?: string
}) {
  return (
    <div className={`rounded-md border border-border p-2.5 ${decided ? 'ring-1 ring-emerald-300' : ''} ${className}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {title}
            {decided && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Couche décisive
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        {pass === null ? (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">N/A</span>
        ) : pass ? (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            ✓ Pass
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            ✗ Fail
          </span>
        )}
      </div>
      {reasons.length > 0 && (
        <ul className="ml-4 list-disc space-y-0.5 text-xs text-foreground/80">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TracesTab({ sequence }: { sequence: SequenceDetail }) {
  const runs = sequence.agentRuns
  if (runs.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucune trace"
        description="Aucune exécution AgentRun pour cette séquence."
      />
    )
  }
  return (
    <div className="relative space-y-2 pl-4">
      {/* Ligne verticale */}
      <div className="absolute bottom-2 left-1 top-2 w-px bg-border" />
      {runs.map((run) => (
        <TimelineEntry key={run.id} run={run} />
      ))}
    </div>
  )
}

function TimelineEntry({ run }: { run: NonNullable<SequenceDetail['agentRuns'][number]> }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:border-emerald-300"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="absolute -left-[3px] top-3.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
            <RunStatutDot value={run.statut} />
            <AgentBadge value={run.agent} />
            {run.skill && <SkillVersionBadge value={run.skill} />}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono">{formatDuration(run.durationMs)}</span>
            <span>{timeAgo(run.timestamp)}</span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <DecisionBadge value={run.decision} />
        </div>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Input</div>
            <JsonViewer value={run.input} />
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Output</div>
            <JsonViewer value={run.output} />
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-muted/20 px-2.5 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  )
}
