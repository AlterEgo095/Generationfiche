import { NextRequest, NextResponse } from 'next/server'
import { resolve_batch_plan } from '@/lib/pipeline/planificateur'
import { runPipeline } from '@/lib/pipeline/orchestrator'

// POST /api/pipeline/generate
// Body: { mode: 'single'|'batch', sequenceId?, demande?, skillVersion: 'v1'|'v2', validateVersion: 'v1'|'v2' }
//
// APPROCHE : fire-and-forget — on résout SYNCHRONE le batch_plan (étape 1, rapide et déterministe)
// pour renvoyer batch_id + items immédiatement (~100ms), puis on lance runPipeline en arrière-plan.
// Le frontend suit en live via WebSocket (pipeline:event) et GET /api/pipeline/batch/[id].
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mode, sequenceId, demande, skillVersion, validateVersion } = body || {}

    if (mode !== 'single' && mode !== 'batch') {
      return NextResponse.json({ error: "mode doit être 'single' ou 'batch'" }, { status: 400 })
    }
    if (mode === 'single' && !sequenceId) {
      return NextResponse.json({ error: 'sequenceId requis pour mode=single' }, { status: 400 })
    }
    if (mode === 'batch' && !demande) {
      return NextResponse.json({ error: 'demande requise pour mode=batch' }, { status: 400 })
    }

    const sv = skillVersion === 'v2' ? 'v2' : 'v1'
    const vv = validateVersion === 'v2' ? 'v2' : 'v1'

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
