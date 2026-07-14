import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolve_batch_plan } from '@/lib/pipeline/planificateur'
import { runPipeline } from '@/lib/pipeline/orchestrator'

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

    // 1. Étape 1 synchrone — résolution du batch_plan (rapide, déterministe)
    //    On génère un batch_id fixe en amont pour pouvoir le retourner immédiatement.
    const batch_id = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const plan =
      mode === 'single'
        ? await resolve_batch_plan(`sequenceId:${sequenceId}`, { max_par_batch: 1 })
        : await resolve_batch_plan(demande)

    // 2. Lance le pipeline en arrière-plan (fire-and-forget) avec le batch_id imposé
    const pipelinePromise =
      mode === 'single'
        ? runPipeline({ mode: 'single', sequenceId, skillVersion: sv, validateVersion: vv, batchId: batch_id })
        : runPipeline({ mode: 'batch', demande, skillVersion: sv, validateVersion: vv, batchId: batch_id })

    // Garde-fou : on catch pour éviter un UnhandledPromiseRejection
    pipelinePromise.catch((err) => {
      console.error('[pipeline/generate] background pipeline error:', err)
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
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
