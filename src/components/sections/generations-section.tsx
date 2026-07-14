'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Rocket,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Zap,
  Radio,
  ListChecks,
  ArrowRight,
  Wand2,
  FileText,
  BookOpen,
  Layout,
  Download,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AgentBadge, PhaseBadge, NiveauBadge } from '@/components/ui/status-badge'
import { usePipelineEvents } from '@/hooks/use-pipeline-events'
import { fetchBatch, fetchSequences, generatePipeline } from '@/lib/api'
import { useStore, type TemplateStyle } from '@/lib/store'
import { agentLabel, formatDuration, formatTime, phaseColor } from '@/lib/ui'
import { cn } from '@/lib/utils'
import { LoadingState, ErrorState, EmptyState } from './states'
import type { AgentName, PipelineEvent } from '@/lib/types'

const STAGES: { agent: AgentName; label: string }[] = [
  { agent: 'planificateur', label: 'Planificateur' },
  { agent: 'knowledge_compiler', label: 'Knowledge Compiler' },
  { agent: 'redacteur', label: 'Rédacteur' },
  { agent: 'critique', label: 'Critique' },
  { agent: 'superviseur', label: 'Superviseur' },
]

const QUICK_PICKS = [
  'Géométrie 4e',
  'Toutes les notions 5e',
  'notion_thales',
]

interface SequenceState {
  sequence_id: string
  sequence_titre: string
  stages: Record<AgentName, 'pending' | 'running' | 'done' | 'error' | 'escalade'>
  progress: number
  outcome?: 'validee' | 'echec' | 'escalade'
  livrable_id?: string
  lastEvent?: string
}

function makeInitialSequenceState(seqId: string, titre: string): SequenceState {
  return {
    sequence_id: seqId,
    sequence_titre: titre,
    stages: {
      planificateur: 'pending',
      knowledge_compiler: 'pending',
      redacteur: 'pending',
      critique: 'pending',
      superviseur: 'pending',
    },
    progress: 0,
  }
}

export function GenerationsSection() {
  // Mode + paramètres du launcher
  const [mode, setMode] = useState<'single' | 'batch'>('batch')
  const [sequenceId, setSequenceId] = useState<string>('')
  const [demande, setDemande] = useState('')
  const [skillVersion, setSkillVersion] = useState<'v1' | 'v2'>('v1')
  const [validateVersion, setValidateVersion] = useState<'v1' | 'v2'>('v1')

  // Batch actif
  const [activeBatch, setActiveBatch] = useState<{
    batch_id: string
    items: { sequence_id: string; sequence_titre: string; semaine: number; priorite: number; prerequis_couverts: boolean; ready: boolean }[]
    started_at: string
  } | null>(null)

  const { generationPreset, setGenerationPreset, setActiveBatchId } = useStore()

  // Charger les séquences pour le mode single
  const { data: seqData } = useQuery({
    queryKey: ['sequences', {}],
    queryFn: () => fetchSequences(),
    staleTime: 60_000,
  })

  // Si preset fourni (depuis détail séquence), préselectionner.
  // Pattern légitime d'effet "appliquer puis clearer une commande externe"
  // (le preset vient d'un autre composant via Zustand).
  useEffect(() => {
    if (generationPreset?.sequenceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('single')
      setSequenceId(generationPreset.sequenceId)
      setGenerationPreset(null)
    }
  }, [generationPreset, setGenerationPreset])

  // État local des séquences en cours
  const [seqStates, setSeqStates] = useState<Record<string, SequenceState>>({})

  // Reset local quand le batch change — synchronisation de l'état local avec le batch actif.
  useEffect(() => {
    if (!activeBatch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeqStates({})
      setActiveBatchId(null)
      return
    }
    const init: Record<string, SequenceState> = {}
    activeBatch.items.forEach((it) => {
      init[it.sequence_id] = makeInitialSequenceState(it.sequence_id, it.sequence_titre)
    })
    setSeqStates(init)
    setActiveBatchId(activeBatch.batch_id)
  }, [activeBatch, setActiveBatchId])

  // Hook WebSocket — s'abonne au batch actif
  const onEvent = useCallback((ev: PipelineEvent) => {
    if (!ev.sequence_id) return
    setSeqStates((prev) => {
      const cur = prev[ev.sequence_id]
      if (!cur) return prev
      const next = { ...cur, stages: { ...cur.stages }, lastEvent: ev.message }
      const agent = ev.agent as AgentName
      if (agent in next.stages) {
        if (ev.phase === 'start' || ev.phase === 'progress') next.stages[agent] = 'running'
        else if (ev.phase === 'done') next.stages[agent] = 'done'
        else if (ev.phase === 'error') next.stages[agent] = 'error'
        else if (ev.phase === 'escalade') next.stages[agent] = 'escalade'
        else if (ev.phase === 'retry') next.stages[agent] = 'running'
      }
      // Progress global
      const doneCount = Object.values(next.stages).filter((s) => s === 'done').length
      next.progress = Math.round((doneCount / STAGES.length) * 100)
      // Outcome
      if (ev.phase === 'done' && agent === 'superviseur') {
        next.outcome = 'validee'
        if (ev.payload && typeof ev.payload === 'object' && 'livrable_id' in ev.payload) {
          next.livrable_id = String(ev.payload.livrable_id)
        }
      }
      if (ev.phase === 'escalade') next.outcome = 'escalade'
      if (ev.phase === 'error' && agent === 'superviseur') next.outcome = 'echec'
      return { ...prev, [ev.sequence_id]: next }
    })
  }, [])
  const { connected, events } = usePipelineEvents({
    batchId: activeBatch?.batch_id ?? null,
    onEvent,
  })

  // Mutation lancer pipeline
  const launchMutation = useMutation({
    mutationFn: () =>
      generatePipeline({
        mode,
        sequenceId: mode === 'single' ? sequenceId : undefined,
        demande: mode === 'batch' ? demande : undefined,
        skillVersion,
        validateVersion,
      }),
    onSuccess: (resp) => {
      setActiveBatch({
        batch_id: resp.batch_id,
        items: resp.items.map((it) => ({
          sequence_id: it.sequence_id,
          sequence_titre: it.sequence_titre,
          semaine: it.semaine,
          priorite: it.priorite,
          prerequis_couverts: it.prerequis_couverts,
          ready: it.ready,
        })),
        started_at: resp.started_at,
      })
      toast.success(`Batch lancé — ${resp.items.length} séquence(s). Suivi live en cours.`)
    },
    onError: (e) => toast.error(`Échec du lancement: ${e instanceof Error ? e.message : 'inconnue'}`),
  })

  // Mutation refetch batch pour révéler livrable_id final
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!activeBatch) return
    // Quand tous les sequences ont un outcome, on refresh GET /api/pipeline/batch/[id]
    const allDone = Object.values(seqStates).every((s) => s.outcome)
    if (allDone && Object.keys(seqStates).length > 0) {
      queryClient.invalidateQueries({ queryKey: ['batch', activeBatch.batch_id] })
    }
  }, [seqStates, activeBatch, queryClient])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Launcher */}
      <Card className="border-emerald-200/60 dark:border-emerald-900/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="size-4 text-emerald-600 dark:text-emerald-400" />
            Lanceur de génération
          </CardTitle>
          <CardDescription>
            Déclenche le pipeline 5 étapes : Planificateur → Knowledge Compiler → Rédacteur → Critique 2 couches → Superviseur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as 'single' | 'batch')}
              variant="outline"
              className="inline-flex"
            >
              <ToggleGroupItem value="single" className="text-xs">
                <Sparkles className="size-3.5 mr-1.5" /> Séquence unique
              </ToggleGroupItem>
              <ToggleGroupItem value="batch" className="text-xs">
                <ListChecks className="size-3.5 mr-1.5" /> Lot (batch)
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Single: select sequence */}
          {mode === 'single' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Séquence à générer</Label>
              <Select value={sequenceId} onValueChange={setSequenceId}>
                <SelectTrigger><SelectValue placeholder="Choisir une séquence…" /></SelectTrigger>
                <SelectContent>
                  {(seqData?.items ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.titre} (Sem.{s.semaine})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Batch: textarea + quick picks */}
          {mode === 'batch' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Demande en langage naturel</Label>
              <Textarea
                value={demande}
                onChange={(e) => setDemande(e.target.value)}
                rows={2}
                placeholder="ex. Géométrie 4e, Toutes les notions 5e, notion_thales, niveau:4e…"
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PICKS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDemande(p)}
                    className="rounded-full border border-emerald-300/60 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Skill versions */}
          <div className="grid gap-3 sm:grid-cols-2">
            <VersionPicker
              label="Skill rédacteur"
              value={skillVersion}
              onChange={setSkillVersion}
              v1Description="Sobre, exemples canoniaques — référence A/B."
              v2Description="Engageant, exemples vie courante, méthode en verbes d'action."
            />
            <VersionPicker
              label="Skill validation pédagogique"
              value={validateVersion}
              onChange={setValidateVersion}
              v1Description="3 dimensions /4 — clarté, progression, pertinence."
              v2Description="Ajoute l'adéquation au contexte_classe si présent."
            />
          </div>

          {/* Template visuel d'export */}
          <TemplatePicker />

          <div className="flex justify-end">
            <Button
              onClick={() => launchMutation.mutate()}
              disabled={
                launchMutation.isPending ||
                (mode === 'single' && !sequenceId) ||
                (mode === 'batch' && !demande.trim())
              }
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {launchMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              Lancer la génération
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plan du batch (post-lancement) */}
      {activeBatch && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <ListChecks className="size-4 text-teal-600 dark:text-teal-400" />
                Plan du batch
              </span>
              <Badge className="gap-1.5 border-emerald-300 bg-emerald-50 font-mono text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {activeBatch.batch_id}
              </Badge>
            </CardTitle>
            <CardDescription>
              {activeBatch.items.length} séquence(s) · démarré à {formatTime(activeBatch.started_at)} ·
              <span className={cn('ml-1 inline-flex items-center gap-1', connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                <Radio className={cn('size-3', connected && 'animate-elite-pulse')} />
                {connected ? 'WS connecté' : 'WS en attente…'}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeBatch.items.map((it) => (
                <div key={it.sequence_id} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="truncate text-xs font-medium">{it.sequence_titre}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    <span>Sem. {it.semaine}</span>
                    <span>·</span>
                    <span>Prio {it.priorite}</span>
                    {it.prerequis_couverts && (
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[9px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        prérequis couverts
                      </Badge>
                    )}
                    {it.ready && (
                      <Badge variant="outline" className="border-teal-300 bg-teal-50 text-[9px] text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
                        ready
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vue live : séquences (gauche) + event stream (droite) */}
      {!activeBatch && (
        <EmptyState
          icon={Wand2}
          title="Aucune génération en cours"
          description="Configurez le launcher ci-dessus puis cliquez sur « Lancer la génération ». Le pipeline 5 étapes se déroulera en direct."
        />
      )}
      {activeBatch && (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Séquences en cours */}
          <div className="space-y-3 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Séquences en pipeline</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveBatch(null)}
                className="text-xs text-muted-foreground"
              >
                Terminer le suivi
              </Button>
            </div>
            <div className="grid gap-3">
              {Object.values(seqStates).map((s) => (
                <SequencePipelineCard key={s.sequence_id} state={s} />
              ))}
            </div>
          </div>

          {/* Event stream */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Radio className={cn('size-4', connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
                  Flux d'événements
                  <Badge variant="outline" className="ml-auto text-[10px]">{events.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <EventStream events={events} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function VersionPicker({
  label,
  value,
  onChange,
  v1Description,
  v2Description,
}: {
  label: string
  value: 'v1' | 'v2'
  onChange: (v: 'v1' | 'v2') => void
  v1Description: string
  v2Description: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('v1')}
          className={cn(
            'rounded-lg border p-2.5 text-left transition-all',
            value === 'v1'
              ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-300 dark:border-emerald-500 dark:bg-emerald-950/30'
              : 'border-border hover:border-emerald-300',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">v1</span>
            {value === 'v1' && <CheckCircle2 className="size-3.5 text-emerald-600" />}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{v1Description}</p>
        </button>
        <button
          type="button"
          onClick={() => onChange('v2')}
          className={cn(
            'rounded-lg border p-2.5 text-left transition-all',
            value === 'v2'
              ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-300 dark:border-emerald-500 dark:bg-emerald-950/30'
              : 'border-border hover:border-emerald-300',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">v2</span>
            {value === 'v2' && <CheckCircle2 className="size-3.5 text-emerald-600" />}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{v2Description}</p>
        </button>
      </div>
    </div>
  )
}

// ============================================================
// TemplatePicker — sélection du template visuel d'export
// 3 templates : Congolais BGP, Fiche Sésame, Moderne
// ============================================================
const TEMPLATE_OPTIONS: Array<{
  id: TemplateStyle
  nom: string
  description: string
  icone: typeof FileText
  couleur: string
  bgColor: string
  borderColor: string
  apercu: { label: string; couleur: string }[]
}> = [
  {
    id: 'congolais-bgp',
    nom: 'Congolais BGP',
    description: 'Modèle officiel congolais — 2 pages recto-verso, tableau 2 colonnes, en-tête FICHE N°/BRANCHE.',
    icone: FileText,
    couleur: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50/60 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-500 ring-emerald-300 dark:border-emerald-500',
    apercu: [
      { label: 'I. Intro', couleur: 'bg-emerald-500' },
      { label: 'II. Dév.', couleur: 'bg-emerald-400' },
      { label: 'III. Synth.', couleur: 'bg-emerald-300' },
      { label: 'IV. App.', couleur: 'bg-emerald-400' },
      { label: 'V. Auto-éval', couleur: 'bg-emerald-500' },
    ],
  },
  {
    id: 'sesame-francais',
    nom: 'Fiche Sésame',
    description: 'Cours de français — 5 phases pédagogiques (Découverte, Compréhension, Structuration, Application, Évaluation).',
    icone: BookOpen,
    couleur: 'text-violet-700 dark:text-violet-400',
    bgColor: 'bg-violet-50/60 dark:bg-violet-950/30',
    borderColor: 'border-violet-500 ring-violet-300 dark:border-violet-500',
    apercu: [
      { label: 'Découverte', couleur: 'bg-violet-500' },
      { label: 'Compréhension', couleur: 'bg-violet-400' },
      { label: 'Structuration', couleur: 'bg-violet-300' },
      { label: 'Application', couleur: 'bg-violet-400' },
      { label: 'Évaluation', couleur: 'bg-violet-500' },
    ],
  },
  {
    id: 'moderne',
    nom: 'Moderne Premium',
    description: 'Design épuré premium — tags colorés, blocs structurés, typographie soignée.',
    icone: Layout,
    couleur: 'text-sky-700 dark:text-sky-400',
    bgColor: 'bg-sky-50/60 dark:bg-sky-950/30',
    borderColor: 'border-sky-500 ring-sky-300 dark:border-sky-500',
    apercu: [
      { label: 'Objectifs', couleur: 'bg-sky-500' },
      { label: 'Déroulement', couleur: 'bg-sky-400' },
      { label: 'Activités', couleur: 'bg-sky-300' },
      { label: 'Évaluation', couleur: 'bg-sky-400' },
    ],
  },
]

function TemplatePicker() {
  const { selectedTemplateStyle, setSelectedTemplateStyle } = useStore()

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">
        Template visuel d'export
        <span className="ml-2 text-[10px] text-muted-foreground/70">(appliqué au PDF généré)</span>
      </Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {TEMPLATE_OPTIONS.map((tpl) => {
          const Icon = tpl.icone
          const isSelected = selectedTemplateStyle === tpl.id
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelectedTemplateStyle(tpl.id)}
              className={cn(
                'rounded-lg border p-3 text-left transition-all',
                isSelected
                  ? cn(tpl.borderColor, tpl.bgColor, 'ring-1')
                  : 'border-border hover:border-muted-foreground/40',
              )}
            >
              {/* Icône + nom */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('size-4', tpl.couleur)} />
                  <span className={cn('text-xs font-semibold', tpl.couleur)}>{tpl.nom}</span>
                </div>
                {isSelected && <CheckCircle2 className={cn('size-3.5', tpl.couleur)} />}
              </div>

              {/* Aperçu visuel mini */}
              <div className="mt-2 flex gap-0.5">
                {tpl.apercu.map((a, i) => (
                  <div
                    key={i}
                    className={cn('h-6 flex-1 rounded-sm', a.couleur, 'flex items-center justify-center')}
                    title={a.label}
                  >
                    <span className="text-[7px] font-bold text-white opacity-80">{a.label.slice(0, 4)}</span>
                  </div>
                ))}
              </div>

              {/* Description */}
              <p className="mt-2 text-[10px] leading-tight text-muted-foreground">{tpl.description}</p>

              {/* Badge 2 pages */}
              <div className="mt-1.5 flex items-center gap-1">
                <Badge variant="outline" className="border-muted-foreground/20 text-[9px] text-muted-foreground">
                  2 pages recto-verso
                </Badge>
                <Badge variant="outline" className="border-muted-foreground/20 text-[9px] text-muted-foreground">
                  QR traçabilité
                </Badge>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// DownloadPDFButton — télécharge le livrable en PDF selon le template choisi
// ============================================================
function DownloadPDFButton({ livrableId }: { livrableId: string }) {
  const { selectedTemplateStyle } = useStore()
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      // 1. Récupérer le livrable + son contexte
      const livResp = await fetch(`/api/livrables/${livrableId}`)
      if (!livResp.ok) throw new Error('Livrable introuvable')
      const liv = await livResp.json()

      // 2. Récupérer le GenerationContext
      const gcResp = await fetch(`/api/sequences/${liv.sequenceId}`)
      if (!gcResp.ok) throw new Error('Séquence introuvable')
      const seq = await gcResp.json()
      const gc = seq.generationContext ? JSON.parse(seq.generationContext.payloadJson) : {}

      // 3. Construire la fiche data pour l'export multi-template
      const contenu = typeof liv.contenuJson === 'string' ? JSON.parse(liv.contenuJson) : liv.contenuJson
      const sections = contenu.sections || []
      const getSection = (id: string) => sections.find((s: any) => s.section_id === id)?.contenu || ''

      const ficheData = {
        fiche_numero: liv.id.slice(-4).toUpperCase(),
        branche: gc.notions?.[0]?.chapitre || 'Mathématiques',
        sujet_revision: gc.notions?.[0]?.niveau || '',
        sujet_jour: seq.titre || liv.sequenceId,
        objectifs: getSection('objectifs'),
        competences: gc.notions?.[0]?.competences || [],
        materiel: gc.contexte_classe?.materiel?.join(', ') || 'Tableau, craies',
        ref_bgp: 'Élite v2 — BGP',
        introduction: {
          rappel: getSection('prerequis'),
          motivation: 'Voir déroulement',
          annonce: seq.titre || '',
        },
        developpement: getSection('deroulement'),
        synthese: getSection('evaluation') || contenu.markdown?.slice(0, 200),
        application: [getSection('activites')].filter(Boolean),
        auto_evaluation: [getSection('prolongement')].filter(Boolean),
        evaluation: getSection('evaluation'),
        sequence_id: liv.sequenceId,
      }

      // 4. Appeler l'API export-multi
      const resp = await fetch('/api/export-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiche: ficheData, templateStyle: selectedTemplateStyle, format: 'pdf' }),
      })
      if (!resp.ok) throw new Error('Export échec')

      // 5. Télécharger le fichier
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fiche_${selectedTemplateStyle}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`PDF téléchargé — template: ${selectedTemplateStyle}`)
    } catch (e) {
      toast.error(`Échec téléchargement: ${e instanceof Error ? e.message : 'erreur'}`)
    } finally {
      setDownloading(false)
    }
  }

  const tplLabel = selectedTemplateStyle === 'congolais-bgp' ? 'Congolais' : selectedTemplateStyle === 'sesame-francais' ? 'Sésame' : 'Moderne'

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleDownload}
      disabled={downloading}
      className="h-7 text-xs"
    >
      {downloading ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
      PDF ({tplLabel})
    </Button>
  )
}

function SequencePipelineCard({ state }: { state: SequenceState }) {
  const { setSection, setGenerationPreset } = useStore()
  return (
    <motion.div layout>
      <Card className={cn(
        'transition-colors',
        state.outcome === 'validee' && 'border-emerald-300 dark:border-emerald-700',
        state.outcome === 'echec' && 'border-rose-300 dark:border-rose-800',
        state.outcome === 'escalade' && 'border-amber-300 dark:border-amber-800',
      )}>
        <CardContent className="py-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold">{state.sequence_titre}</h4>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                {state.lastEvent ?? 'En attente de démarrage…'}
              </p>
            </div>
            <AnimatePresence mode="wait">
              {state.outcome === 'validee' && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <CheckCircle2 className="size-3" /> Validé
                </motion.span>
              )}
              {state.outcome === 'echec' && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <XCircle className="size-3" /> Échec
                </motion.span>
              )}
              {state.outcome === 'escalade' && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <AlertTriangle className="size-3" /> Escalade
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Stage pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STAGES.map((stage) => {
              const st = state.stages[stage.agent]
              return (
                <StagePill key={stage.agent} label={stage.label} state={st} />
              )
            })}
          </div>

          {/* Progress */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Progression</span>
              <span className="font-mono">{state.progress}%</span>
            </div>
            <Progress value={state.progress} className="h-1.5" />
          </div>

          {/* Action quand outcome validee */}
          {state.outcome === 'validee' && state.livrable_id && (
            <div className="mt-3 flex justify-end gap-2">
              <DownloadPDFButton livrableId={state.livrable_id} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setGenerationPreset({ sequenceId: state.sequence_id })
                  setSection('sequences')
                }}
                className="h-7 text-xs text-emerald-700 dark:text-emerald-300"
              >
                Voir le livrable <ArrowRight className="size-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function StagePill({ label, state }: { label: string; state: 'pending' | 'running' | 'done' | 'error' | 'escalade' }) {
  const config = {
    pending: { icon: null, color: 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500' },
    running: { icon: <Loader2 className="size-2.5 animate-spin" />, color: 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300' },
    done: { icon: <CheckCircle2 className="size-2.5" />, color: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
    error: { icon: <XCircle className="size-2.5" />, color: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300' },
    escalade: { icon: <AlertTriangle className="size-2.5" />, color: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  }[state]

  return (
    <motion.span
      layout
      initial={{ opacity: 0.4, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        config.color,
      )}
    >
      {config.icon}
      {label}
    </motion.span>
  )
}

function EventStream({ events }: { events: PipelineEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [events.length])

  if (events.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground">
        <Zap className="mb-1 size-4 text-muted-foreground/50" />
        En attente d'événements…
      </div>
    )
  }
  return (
    <div
      ref={scrollRef}
      className="max-h-96 space-y-1 overflow-y-auto scroll-elite font-mono text-[11px]"
      role="log"
      aria-live="polite"
      aria-label="Flux d'événements du pipeline"
    >
      {events.map((ev, i) => {
        const c = phaseColor(ev.phase)
        return (
          <motion.div
            key={`${ev.timestamp}-${i}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-2 rounded px-1.5 py-1 hover:bg-muted/40"
          >
            <span className="shrink-0 text-muted-foreground">{formatTime(ev.timestamp)}</span>
            <span className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase', c.bg, c.text)}>
              {ev.phase}
            </span>
            <span className="shrink-0 text-teal-600 dark:text-teal-400">
              {agentLabel(ev.agent)}
            </span>
            <span className="min-w-0 flex-1 text-foreground/80">{ev.message}</span>
          </motion.div>
        )
      })}
    </div>
  )
}
