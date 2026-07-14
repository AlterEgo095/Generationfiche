// Orchestrateur — Architecture Élite v2 §4
// 5 étapes :
//   1. Planificateur → resolve_batch_plan
//   2. Knowledge Compiler → compileGenerationContext (déterministe, pas d'LLM)
//   3. Rédacteur → generateAllSections (LLM)
//   4. Critique → validateStructurel (TS pur) → validatePedagogique (LLM si structurel OK)
//   5. Superviseur → renderFiche → commitBatch (retries max 2 par section, escalade)
//
// - Persiste AgentRun à chaque étape (input/output/decision/duration_ms/statut)
// - Émet PipelineEvent au mini-service WebSocket (POST http://localhost:3003/emit)
// - Délais artificiels (300-800ms) entre étapes pour UX live

import { db } from '@/lib/db'
import {
  FICHE_TEMPLATE_V1_SECTIONS,
  type FicheSectionId,
  type GenerationContext,
  type PipelineEvent,
  type SectionContent,
  type ValidationResult,
} from '@/lib/contracts'
import { resolve_batch_plan, checkPrerequisitesCovered } from './planificateur'
import { compileGenerationContext } from './knowledge-compiler'
import { generateSectionPair, generateAllSections } from './redacteur'
import { validateStructurel, validatePedagogique } from './critique'
import { renderFiche, commitBatch } from './superviseur'
import type { BatchPlan, BatchPlanItem, RenderedDocument } from '@/lib/contracts'

const PIPELINE_WS_URL = 'http://127.0.0.1:3004/emit'

// P1-3 (Sprint 3) — Outbox pattern : les events sont persistés en DB avant envoi.
// Garantie : aucun event perdu, même si le WS est down au moment de l'emit.
// Worker : retry avec backoff exponentiel (1s, 3s, 10s), max 3 tentatives.
const BACKOFF_DELAYS_MS = [1000, 3000, 10000]

// ============================================================
// emitPipelineEvent — persiste l'event en DB (outbox) puis tente l'envoi WS
// Si le WS est down, l'event reste en status="pending" et sera retry par le worker.
// ============================================================
async function emitPipelineEvent(
  batchId: string,
  evt: Omit<PipelineEvent, 'timestamp'>,
): Promise<void> {
  const payload: PipelineEvent = {
    ...evt,
    batch_id: batchId,
    timestamp: new Date().toISOString(),
  }

  // 1. Persiste dans l'outbox (garantie de non-perte)
  try {
    await db.eventOutbox.create({
      data: {
        batchId,
        sequenceId: evt.sequence_id ?? null,
        agent: evt.agent,
        skill: evt.skill ?? null,
        phase: evt.phase,
        message: evt.message,
        payload: evt.payload ? JSON.stringify(evt.payload) : null,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(),
      },
    })
  } catch (e) {
    console.error('[orchestrator] Outbox persist failed:', e instanceof Error ? e.message : e)
  }

  // 2. Tente l'envoi immédiat (best-effort, non bloquant)
  attemptDeliverEvent(payload).catch(() => { /* le worker retry plus tard */ })
}

// ============================================================
// attemptDeliverEvent — tente d'envoyer un event au WS
// ============================================================
async function attemptDeliverEvent(payload: PipelineEvent): Promise<void> {
  try {
    const resp = await fetch(PIPELINE_WS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: payload.batch_id, event: payload }),
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) throw new Error(`WS returned ${resp.status}`)
    // Marque comme délivré
    await db.eventOutbox.updateMany({
      where: { batchId: payload.batch_id, agent: payload.agent, phase: payload.phase, message: payload.message, status: 'pending' },
      data: { status: 'delivered', deliveredAt: new Date() },
    })
  } catch (e) {
    // Échec — le worker retry plus tard avec backoff
  }
}

// ============================================================
// processOutbox — worker qui délivre les events en attente
// Appelé périodiquement par le mini-service ou l'API.
// ============================================================
export async function processOutbox(limit = 20): Promise<{ processed: number; delivered: number; failed: number }> {
  const pending = await db.eventOutbox.findMany({
    where: {
      status: 'pending',
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let delivered = 0
  let failed = 0

  for (const evt of pending) {
    const attempts = evt.attempts + 1
    const payload: PipelineEvent = {
      batch_id: evt.batchId || '',
      sequence_id: evt.sequenceId ?? undefined,
      agent: evt.agent as PipelineEvent['agent'],
      skill: evt.skill ?? undefined,
      phase: evt.phase as PipelineEvent['phase'],
      message: evt.message,
      payload: evt.payload ? JSON.parse(evt.payload) : undefined,
      timestamp: evt.createdAt.toISOString(),
    }

    try {
      const resp = await fetch(PIPELINE_WS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: evt.batchId, event: payload }),
        signal: AbortSignal.timeout(3000),
      })
      if (resp.ok) {
        await db.eventOutbox.update({
          where: { id: evt.id },
          data: { status: 'delivered', attempts, deliveredAt: new Date() },
        })
        delivered++
      } else {
        throw new Error(`WS returned ${resp.status}`)
      }
    } catch {
      if (attempts >= evt.maxAttempts) {
        // Épuisement des retries — marquer comme failed_delivery
        await db.eventOutbox.update({
          where: { id: evt.id },
          data: { status: 'failed_delivery', attempts },
        })
        failed++
      } else {
        // Retry avec backoff exponentiel
        const delayMs = BACKOFF_DELAYS_MS[attempts - 1] ?? 10000
        await db.eventOutbox.update({
          where: { id: evt.id },
          data: { attempts, nextRetryAt: new Date(Date.now() + delayMs) },
        })
      }
    }
  }

  return { processed: pending.length, delivered, failed }
}

// ============================================================
// persistAgentRun — enregistre un agent_run en DB
// ============================================================
async function persistAgentRun(p: {
  sequenceId?: string | null
  batchId?: string | null
  agent: 'planificateur' | 'knowledge_compiler' | 'redacteur' | 'critique' | 'superviseur'
  skill?: string | null
  input: unknown
  output: unknown
  decision: 'continue' | 'retry' | 'fail' | 'escalade_humaine'
  durationMs: number
  statut: 'ok' | 'warning' | 'error'
}): Promise<void> {
  try {
    await db.agentRun.create({
      data: {
        sequenceId: p.sequenceId ?? null,
        batchId: p.batchId ?? null,
        agent: p.agent,
        skill: p.skill ?? null,
        input: JSON.stringify(p.input),
        output: JSON.stringify(p.output),
        decision: p.decision,
        durationMs: p.durationMs,
        statut: p.statut,
      },
    })
  } catch (e) {
    console.warn('[orchestrator] persistAgentRun failed:', e instanceof Error ? e.message : e)
  }
}

// ============================================================
// Délai artificiel pour UX live
// ============================================================
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================
// runPipeline — orchestration principale
// mode 'single' : sequenceId fourni
// mode 'batch'  : demande fournie (ex: "Géométrie 4e")
// ============================================================
export async function runPipeline(
  args:
    | { mode: 'single'; sequenceId: string; skillVersion?: 'v1' | 'v2'; validateVersion?: 'v1' | 'v2'; batchId?: string }
    | { mode: 'batch'; demande: string; skillVersion?: 'v1' | 'v2'; validateVersion?: 'v1' | 'v2'; batchId?: string },
): Promise<{ batch_id: string; items: BatchPlanItem[]; started_at: string }> {
  const skillVersion = args.skillVersion ?? 'v1'
  const validateVersion = args.validateVersion ?? 'v1'
  const started_at = new Date().toISOString()
  const forcedBatchId = args.batchId

  // -------------------------------------------------
  // 1. PLANIFICATEUR
  // -------------------------------------------------
  await emitPipelineEvent('pending', {
    agent: 'planificateur',
    skill: 'resolve_batch_plan_v1',
    phase: 'start',
    message: `Décomposition de la demande...`,
  })

  let plan: BatchPlan
  if (args.mode === 'single') {
    // Pour single : on construit un mini-plan à partir du sequenceId
    const seq = await db.sequence.findUnique({
      where: { id: args.sequenceId },
      include: { notions: { include: { notion: true } }, progression: true },
    })
    if (!seq) throw new Error(`Sequence ${args.sequenceId} not found`)
    const seqs = [seq]
    plan = await resolve_batch_plan(`sequenceId:${args.sequenceId}`, { max_par_batch: 1 })
    if (plan.items.length === 0) {
      // resolve_batch_plan n'a pas matché : on force l'inclusion
      plan = {
        batch_id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        demande: `sequenceId:${args.sequenceId}`,
        items: seqs.map((s) => ({
          sequence_id: s.id,
          sequence_titre: s.titre,
          semaine: s.semaine,
          priorite: s.priorite,
          notions: [],
          prerequis_couverts: false,
          ready: false,
        })),
        total: seqs.length,
      }
    }
  } else {
    plan = await resolve_batch_plan(args.demande)
  }

  // Si un batch_id a été forcé en amont (pour permettre fire-and-forget), on l'utilise
  if (forcedBatchId) {
    plan = { ...plan, batch_id: forcedBatchId }
  }

  await emitPipelineEvent(plan.batch_id, {
    agent: 'planificateur',
    skill: 'resolve_batch_plan_v1',
    phase: 'done',
    message: `${plan.total} séquence(s) planifiée(s)`,
    payload: { total: plan.total, items: plan.items.map((i) => ({ sequence_id: i.sequence_id, titre: i.sequence_titre, ready: i.ready })) },
    duration_ms: 0,
  })

  await persistAgentRun({
    batchId: plan.batch_id,
    agent: 'planificateur',
    skill: 'resolve_batch_plan_v1',
    input: { mode: args.mode, demande: args.mode === 'batch' ? args.demande : `sequenceId:${args.sequenceId}` },
    output: { total: plan.total, items: plan.items.map((i) => ({ sequence_id: i.sequence_id, ready: i.ready, prerequis_couverts: i.prerequis_couverts })) },
    decision: 'continue',
    durationMs: 0,
    statut: 'ok',
  })

  await delay(400)

  // -------------------------------------------------
  // Pour chaque séquence : 2 → 3 → 4 → 5
  // P1-5 (Sprint 3) : PARALLÉLISATION avec concurrence limitée (MAX_CONCURRENT_GENERATION)
  // Avant : for...of séquentiel (10 séquences = 10x le temps)
  // Après  : pool de workers parallèles (max 3 simultanés) + rate limiter LLM
  // -------------------------------------------------
  const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_GENERATION || '3', 10)
  const readyItems = plan.items.filter((item) => item.ready)
  const skippedItems = plan.items.filter((item) => !item.ready)

  // Traite les séquences ignorées (prerequis non couverts)
  for (const item of skippedItems) {
    await emitPipelineEvent(plan.batch_id, {
      sequence_id: item.sequence_id,
      agent: 'planificateur',
      skill: 'check_prerequisites_covered_v1',
      phase: 'error',
      message: `Séquence ${item.sequence_titre} ignorée (notions manquantes ou prérequis non couverts)`,
    })
    await persistAgentRun({
      sequenceId: item.sequence_id,
      batchId: plan.batch_id,
      agent: 'planificateur',
      skill: 'check_prerequisites_covered_v1',
      input: { sequence_id: item.sequence_id },
      output: { ready: false, prerequis_couverts: item.prerequis_couverts },
      decision: 'fail',
      durationMs: 0,
      statut: 'warning',
    })
  }

  // Traite les séquences prêtes en parallèle avec concurrence limitée
  let activeWorkers = 0
  let itemIndex = 0
  const processNext = async (): Promise<void> => {
    while (itemIndex < readyItems.length) {
      const idx = itemIndex++
      const item = readyItems[idx]
      try {
        await processSequence({
          batchId: plan.batch_id,
          item,
          skillVersion,
          validateVersion,
        })
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e)
        await emitPipelineEvent(plan.batch_id, {
          sequence_id: item.sequence_id,
          agent: 'superviseur',
          phase: 'error',
          message: `Échec pipeline sur ${item.sequence_titre}: ${errMsg}`,
        })
        await persistAgentRun({
          sequenceId: item.sequence_id,
          batchId: plan.batch_id,
          agent: 'superviseur',
          input: { error: errMsg },
          output: { crashed: true },
          decision: 'fail',
          durationMs: 0,
          statut: 'error',
        })
      }
    }
  }

  // Lance MAX_CONCURRENT workers en parallèle
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, readyItems.length) }, () => processNext())
  await Promise.all(workers)

  // -------------------------------------------------
  // COMMIT BATCH
  // -------------------------------------------------
  await emitPipelineEvent(plan.batch_id, {
    agent: 'superviseur',
    skill: 'commit_batch_v1',
    phase: 'progress',
    message: `Clôture du batch...`,
  })
  const commitResult = await commitBatch(plan.batch_id)
  await emitPipelineEvent(plan.batch_id, {
    agent: 'superviseur',
    skill: 'commit_batch_v1',
    phase: 'done',
    message: `Batch clôturé : ${commitResult.committed} validé(s), ${commitResult.escalated} escalade(s)`,
    payload: commitResult,
    duration_ms: 0,
  })

  return { batch_id: plan.batch_id, items: plan.items, started_at }
}

// ============================================================
// processSequence — étapes 2 → 5 pour une séquence
// ============================================================
async function processSequence(p: {
  batchId: string
  item: BatchPlanItem
  skillVersion: 'v1' | 'v2'
  validateVersion: 'v1' | 'v2'
}): Promise<void> {
  const { batchId, item, skillVersion, validateVersion } = p

  // ----- 2. KNOWLEDGE COMPILER -----
  await emitPipelineEvent(batchId, {
    sequence_id: item.sequence_id,
    agent: 'knowledge_compiler',
    skill: 'fetch_curriculum_spec_v1',
    phase: 'start',
    message: `Compilation du GenerationContext pour "${item.sequence_titre}"...`,
  })
  const kcStart = Date.now()

  const seq = await db.sequence.findUnique({
    where: { id: item.sequence_id },
    include: { notions: true },
  })
  if (!seq) throw new Error(`Sequence ${item.sequence_id} not found`)

  const ctx: GenerationContext = await compileGenerationContext({
    id: seq.id,
    titre: seq.titre,
    niveau: seq.niveau,
    chapitre: seq.chapitre,
    templateVersion: seq.templateVersion,
    curriculumVersion: seq.curriculumVersion,
    contexteClasse: seq.contexteClasse,
    notions: seq.notions.map((sn) => ({ notionId: sn.notionId })),
  })

  const kcDuration = Date.now() - kcStart
  await emitPipelineEvent(batchId, {
    sequence_id: item.sequence_id,
    agent: 'knowledge_compiler',
    skill: 'compile_context_v1',
    phase: 'done',
    message: `Contexte compilé : ${ctx.notions.length} notion(s), ${ctx.exemples_pedagogiques.length} exemple(s), ${ctx.references_style.length} référence(s)`,
    payload: {
      notions: ctx.notions.length,
      exemples: ctx.exemples_pedagogiques.length,
      references: ctx.references_style.length,
      contexte_classe: !!ctx.contexte_classe,
    },
    duration_ms: kcDuration,
  })

  await persistAgentRun({
    sequenceId: item.sequence_id,
    batchId,
    agent: 'knowledge_compiler',
    skill: 'compile_context_v1',
    input: { sequence_id: item.sequence_id, notionIds: seq.notions.map((n) => n.notionId) },
    output: {
      notions: ctx.notions.length,
      exemples: ctx.exemples_pedagogiques.length,
      references: ctx.references_style.length,
      contexte_classe: !!ctx.contexte_classe,
    },
    decision: 'continue',
    durationMs: kcDuration,
    statut: 'ok',
  })

  // Marque la séquence en_cours
  await db.sequence.update({ where: { id: item.sequence_id }, data: { statut: 'en_cours' } })

  await delay(600)

  // ----- 3 + 4 + 5 : rédaction / critique / superviseur avec retries -----
  const maxRetriesPerSection = 2
  await generateValidateRender({
    batchId,
    sequenceId: item.sequence_id,
    sequenceTitre: item.sequence_titre,
    ctx,
    skillVersion,
    validateVersion,
    maxRetriesPerSection,
  })
}

// ============================================================
// generateValidateRender — boucle rédaction → critique → (retry si fail)
// avec retries max 2 par section, escalade humaine au-delà
// ============================================================
async function generateValidateRender(p: {
  batchId: string
  sequenceId: string
  sequenceTitre: string
  ctx: GenerationContext
  skillVersion: 'v1' | 'v2'
  validateVersion: 'v1' | 'v2'
  maxRetriesPerSection: number
}): Promise<void> {
  const { batchId, sequenceId, sequenceTitre, ctx, skillVersion, validateVersion, maxRetriesPerSection } = p

  let sections: SectionContent[] = []
  let retryCount = 0
  let validation: ValidationResult | null = null
  let escalated = false

  // Génère toutes les sections une première fois
  await emitPipelineEvent(batchId, {
    sequence_id: sequenceId,
    agent: 'redacteur',
    skill: `generate_section_pair_${skillVersion}`,
    phase: 'start',
    message: `Rédaction des sections (skill ${skillVersion}) pour "${sequenceTitre}"...`,
  })

  const redStart = Date.now()
  const genResult = await generateAllSections(
    FICHE_TEMPLATE_V1_SECTIONS,
    ctx,
    skillVersion,
    (sid, _content, ok) => {
      emitPipelineEvent(batchId, {
        sequence_id: sequenceId,
        agent: 'redacteur',
        skill: `generate_section_pair_${skillVersion}`,
        phase: ok ? 'progress' : 'error',
        message: `Section "${sid}" ${ok ? 'rédigée' : 'en contenu de secours'}`,
      })
    },
  )
  sections = genResult.sections
  const redDuration = Date.now() - redStart

  await emitPipelineEvent(batchId, {
    sequence_id: sequenceId,
    agent: 'redacteur',
    skill: `generate_section_pair_${skillVersion}`,
    phase: 'done',
    message: `${sections.length} section(s) rédigée(s) en ${redDuration} ms${genResult.errors.length ? ` (${genResult.errors.length} erreur(s) LLM)` : ''}`,
    payload: { sections: sections.length, errors: genResult.errors.length, duration_ms: redDuration },
    duration_ms: redDuration,
  })

  await persistAgentRun({
    sequenceId,
    batchId,
    agent: 'redacteur',
    skill: `generate_section_pair_${skillVersion}`,
    input: { sequence_id: sequenceId, sections_count: FICHE_TEMPLATE_V1_SECTIONS.length, version: skillVersion },
    output: {
      sections: sections.map((s) => ({ section_id: s.section_id, length: s.contenu.length })),
      errors: genResult.errors,
    },
    decision: 'continue',
    durationMs: redDuration,
    statut: genResult.errors.length > 0 ? 'warning' : 'ok',
  })

  await delay(500)

  // ----- 4. CRITIQUE — structurel puis pédagogique -----
  // Boucle de retry ciblée par section (max 2)
  // On boucle sur la validation globale (structurel + pédagogique)
  let attempt = 0
  while (attempt <= maxRetriesPerSection) {
    attempt++
    // 4a. Structurel (TS pur — AUCUN LLM)
    await emitPipelineEvent(batchId, {
      sequence_id: sequenceId,
      agent: 'critique',
      skill: 'validate_structurel_v1',
      phase: 'start',
      message: `Critique structurelle (couche 1)...`,
    })
    const structStart = Date.now()
    validation = validateStructurel(sections, ctx)
    const structDuration = Date.now() - structStart

    await emitPipelineEvent(batchId, {
      sequence_id: sequenceId,
      agent: 'critique',
      skill: 'validate_structurel_v1',
      phase: validation.structurel_pass ? 'done' : 'retry',
      message: validation.structurel_pass
        ? `Structurel PASS — évaluation pédagogique`
        : `Structurel FAIL — ${validation.structurel_raisons.length} raison(s)`,
      payload: { pass: validation.structurel_pass, raisons: validation.structurel_raisons, section_a_regenerer: validation.section_a_regenerer },
      duration_ms: structDuration,
    })

    await persistAgentRun({
      sequenceId,
      batchId,
      agent: 'critique',
      skill: 'validate_structurel_v1',
      input: { sequence_id: sequenceId, sections: sections.map((s) => s.section_id) },
      output: {
        pass: validation.structurel_pass,
        raisons: validation.structurel_raisons,
        section_a_regenerer: validation.section_a_regenerer,
      },
      decision: validation.structurel_pass ? 'continue' : 'retry',
      durationMs: structDuration,
      statut: 'ok',
    })

    if (!validation.structurel_pass) {
      // Retry ciblé : régénère uniquement la section en défaut
      if (attempt > maxRetriesPerSection) {
        escalated = true
        await emitPipelineEvent(batchId, {
          sequence_id: sequenceId,
          agent: 'critique',
          phase: 'escalade',
          message: `Échec structurel persistant après ${maxRetriesPerSection} retries — escalade humaine`,
        })
        await persistAgentRun({
          sequenceId,
          batchId,
          agent: 'critique',
          skill: 'validate_structurel_v1',
          input: { attempt },
          output: { escalade: true },
          decision: 'escalade_humaine',
          durationMs: 0,
          statut: 'error',
        })
        break
      }
      retryCount++
      const sectionToRegen = validation.section_a_regenerer as FicheSectionId
      await emitPipelineEvent(batchId, {
        sequence_id: sequenceId,
        agent: 'redacteur',
        skill: `generate_section_pair_${skillVersion}`,
        phase: 'retry',
        message: `Retry ${attempt}/${maxRetriesPerSection} — régénération de "${sectionToRegen}"`,
      })
      const regen = await generateSectionPair(sectionToRegen, ctx, skillVersion)
      sections = sections.map((s) => (s.section_id === sectionToRegen ? regen.content : s))
      await persistAgentRun({
        sequenceId,
        batchId,
        agent: 'redacteur',
        skill: `generate_section_pair_${skillVersion}`,
        input: { sequence_id: sequenceId, section_id: sectionToRegen, retry: attempt },
        output: { section_id: sectionToRegen, length: regen.content.contenu.length, ok: regen.ok },
        decision: 'retry',
        durationMs: regen.duration_ms,
        statut: regen.ok ? 'ok' : 'warning',
      })
      await delay(400)
      continue
    }

    // 4b. Pédagogique (LLM)
    await emitPipelineEvent(batchId, {
      sequence_id: sequenceId,
      agent: 'critique',
      skill: `validate_pedagogique_${validateVersion}`,
      phase: 'start',
      message: `Critique pédagogique (couche 2, skill ${validateVersion})...`,
    })
    const pedStart = Date.now()
    const pedagogique = await validatePedagogique(sections, ctx, validateVersion)
    const pedDuration = pedagogique.duration_ms ?? Date.now() - pedStart
    validation = {
      ...validation,
      pedagogique_pass: pedagogique.pedagogique_pass,
      pedagogique_raisons: pedagogique.pedagogique_raisons,
      section_a_regenerer: pedagogique.section_a_regenerer,
      couche_declenchee: 'pedagogique',
    }

    await emitPipelineEvent(batchId, {
      sequence_id: sequenceId,
      agent: 'critique',
      skill: `validate_pedagogique_${validateVersion}`,
      phase: validation.pedagogique_pass ? 'done' : 'retry',
      message: validation.pedagogique_pass
        ? `Pédagogique PASS — validation acceptée`
        : `Pédagogique FAIL — section à régénérer : ${validation.section_a_regenerer}`,
      payload: {
        pass: validation.pedagogique_pass,
        scores: pedagogique.scores,
        raisons: validation.pedagogique_raisons,
        section_a_regenerer: validation.section_a_regenerer,
      },
      duration_ms: pedDuration,
    })

    await persistAgentRun({
      sequenceId,
      batchId,
      agent: 'critique',
      skill: `validate_pedagogique_${validateVersion}`,
      input: { sequence_id: sequenceId, sections: sections.map((s) => s.section_id), version: validateVersion },
      output: {
        pass: validation.pedagogique_pass,
        scores: pedagogique.scores,
        raisons: validation.pedagogique_raisons,
        section_a_regenerer: validation.section_a_regenerer,
      },
      decision: validation.pedagogique_pass ? 'continue' : 'retry',
      durationMs: pedDuration,
      statut: pedagogique.ok === false ? 'warning' : 'ok',
    })

    if (validation.pedagogique_pass) {
      // PASS → on sort de la boucle
      break
    }

    // FAIL pédagogique : retry ciblé
    if (attempt > maxRetriesPerSection) {
      escalated = true
      await emitPipelineEvent(batchId, {
        sequence_id: sequenceId,
        agent: 'critique',
        phase: 'escalade',
        message: `Échec pédagogique persistant après ${maxRetriesPerSection} retries — escalade humaine`,
      })
      await persistAgentRun({
        sequenceId,
        batchId,
        agent: 'critique',
        skill: `validate_pedagogique_${validateVersion}`,
        input: { attempt },
        output: { escalade: true },
        decision: 'escalade_humaine',
        durationMs: 0,
        statut: 'error',
      })
      break
    }
    retryCount++
    const sectionToRegen = (validation.section_a_regenerer ?? 'deroulement') as FicheSectionId
    await emitPipelineEvent(batchId, {
      sequence_id: sequenceId,
      agent: 'redacteur',
      skill: `generate_section_pair_${skillVersion}`,
      phase: 'retry',
      message: `Retry ${attempt}/${maxRetriesPerSection} — régénération de "${sectionToRegen}" (pédagogique)`,
    })
    const regen = await generateSectionPair(sectionToRegen, ctx, skillVersion)
    sections = sections.map((s) => (s.section_id === sectionToRegen ? regen.content : s))
    await persistAgentRun({
      sequenceId,
      batchId,
      agent: 'redacteur',
      skill: `generate_section_pair_${skillVersion}`,
      input: { sequence_id: sequenceId, section_id: sectionToRegen, retry: attempt, layer: 'pedagogique' },
      output: { section_id: sectionToRegen, length: regen.content.contenu.length, ok: regen.ok },
      decision: 'retry',
      durationMs: regen.duration_ms,
      statut: regen.ok ? 'ok' : 'warning',
    })
    await delay(400)
  }

  await delay(500)

  // ----- 5. SUPERVISEUR — renderFiche + persistance -----
  await emitPipelineEvent(batchId, {
    sequence_id: sequenceId,
    agent: 'superviseur',
    skill: 'render_fiche_v1',
    phase: 'start',
    message: `Rendu final + persistance du livrable...`,
  })
  const supStart = Date.now()

  // Crée le livrable
  const livrable = await db.livrable.create({
    data: {
      sequenceId,
      type: 'fiche',
      contenuJson: JSON.stringify({ sections }),
      format: 'markdown',
      valide: !escalated && !!validation?.pedagogique_pass,
      skillVersion,
    },
  })

  // Rendu via le superviseur
  const rendered: RenderedDocument = renderFiche(sections, ctx, {
    livrable_id: livrable.id,
    skill_version: skillVersion,
  })

  // Met à jour le livrable avec le rendu final
  await db.livrable.update({
    where: { id: livrable.id },
    data: {
      contenuJson: JSON.stringify(rendered.contenu_final),
      agentTraceId: `agent_run_${batchId}_${sequenceId}`,
    },
  })

  // Persiste le ValidationResult
  if (validation) {
    await db.validationResult.create({
      data: {
        livrableId: livrable.id,
        structurelPass: validation.structurel_pass,
        structurelRaisons: JSON.stringify(validation.structurel_raisons),
        pedagogiquePass: validation.pedagogique_pass ?? false,
        pedagogiqueRaisons: JSON.stringify(validation.pedagogique_raisons ?? []),
        sectionARegenerer: validation.section_a_regenerer ?? null,
        coucheDeclenchee: validation.couche_declenchee,
        skillVersion: validateVersion,
      },
    })
  }

  // agent_run superviseur
  const supDuration = Date.now() - supStart
  await persistAgentRun({
    sequenceId,
    batchId,
    agent: 'superviseur',
    skill: 'render_fiche_v1',
    input: { sequence_id: sequenceId, sections: sections.length },
    output: { livrable_id: livrable.id, valide: livrable.valide, escalade: escalated },
    decision: escalated ? 'escalade_humaine' : 'continue',
    durationMs: supDuration,
    statut: escalated ? 'error' : 'ok',
  })

  await emitPipelineEvent(batchId, {
    sequence_id: sequenceId,
    agent: 'superviseur',
    skill: 'render_fiche_v1',
    phase: escalated ? 'escalade' : 'done',
    message: escalated
      ? `Livrable ${livrable.id} créé mais escalade humaine requise`
      : `Livrable ${livrable.id} validé et persisté`,
    payload: { livrable_id: livrable.id, valide: livrable.valide, escalade: escalated, retries: retryCount },
    duration_ms: supDuration,
  })
}
