import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolve_batch_plan } from '@/lib/pipeline/planificateur'
import { runPipeline } from '@/lib/pipeline/orchestrator'
import { pipelineGate } from '@/lib/pipeline-gate'

// P0-1 : schéma Zod pour le lancement de pipeline
const generateSchema = z.object({
  mode: z.enum(['single', 'batch']),
  sequenceId: z.string().optional(),
  demande: z.string().optional(),
  skillVersion: z.enum(['v1', 'v2']),
  validateVersion: z.enum(['v1', 'v2']),
}).refine((d) => {
  if (d.mode === 'single' && !d.sequenceId) return false
  if (d.mode === 'batch' && !d.demande) return false
  return true
}, { message: 'sequenceId requis pour mode=single ; demande requise pour mode=batch' })

// POST /api/pipeline/generate
export async function POST(req: NextRequest) {
  // R-12 : flag anti-double-release — le permis est libéré soit par le
  // finally du pipeline, soit par le catch d'erreur synchrone (jamais deux fois)
  let permitHeldByPipeline = false
  try {
    const body = await req.json()

    // P0-1 : validation Zod du body (skillVersion/validateVersion en enum — plus de v999 silencieux)
    const parsed = generateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'body invalide', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const { mode, sequenceId, demande, skillVersion: sv, validateVersion: vv } = parsed.data

    const started_at = new Date().toISOString()

    // R-12 (Fermé F-33) : ADMISSION CONTROL — refuse déterministement tout
    // pipeline excédentaire au lieu de laisser N pipelines se partager le
    // quota LLM (tempête 429 → circuit breaker auto-agressif → escalades).
    // Réversibilité : LLM_GOVERNOR=off → gate transparent (tryAcquire=true).
    const admitted = await pipelineGate.tryAcquire(0)
    if (!admitted) {
      const gate = pipelineGate.getStatus()
      return NextResponse.json(
        {
          error: 'admission refusée : un pipeline est déjà en cours (gouverneur de concurrence R-12)',
          gate: { active: gate.active, max: gate.max },
          retry_after_s: 30,
        },
        { status: 429, headers: { 'Retry-After': '30' } },
      )
    }

    // 1. Étape 1 synchrone — résolution du batch_plan (rapide, déterministe)
    //    On génère un batch_id fixe en amont pour pouvoir le retourner immédiatement.
    const batch_id = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const plan =
      mode === 'single'
        ? await resolve_batch_plan(`sequenceId:${sequenceId}`, { max_par_batch: 1 })
        : await resolve_batch_plan(demande)

    // 2. Lance le pipeline en arrière-plan (fire-and-forget) avec le batch_id imposé
    //    R-12 : le permis d'admission est libéré dès la fin du pipeline (succès ou échec)
    permitHeldByPipeline = true
    const pipelinePromise =
      mode === 'single'
        ? runPipeline({ mode: 'single', sequenceId, skillVersion: sv, validateVersion: vv, batchId: batch_id })
        : runPipeline({ mode: 'batch', demande, skillVersion: sv, validateVersion: vv, batchId: batch_id })

    void pipelinePromise
      .catch((err) => {
        console.error('[pipeline/generate] background pipeline error:', err)
      })
      .finally(() => {
        pipelineGate.release()
      })

    // 3. Retourne immédiatement
    return NextResponse.json({
      batch_id,
      items: plan.items.map((i) => ({
        sequence_id: i.sequence_id,
        sequence_titre: i.sequence_titre,
        semaine: i.semaine,
        priorite: i.priorite,
        notions: i.notions.map((n) => ({ notion_id: n.notion_id, nom: n.nom, niveau: n.niveau, chapitre: n.chapitre })),
        prerequis_couverts: i.prerequis_couverts,
        ready: i.ready,
      })),
      started_at,
      status: 'running',
      ws_room: `batch:${batch_id}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // R-12 : si l'erreur est survenue avant le lancement du pipeline
    // (ex. resolve_batch_plan), le permis n'est pas encore libéré → libère ici
    if (!permitHeldByPipeline) {
      pipelineGate.release()
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
