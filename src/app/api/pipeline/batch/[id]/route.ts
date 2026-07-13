import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/pipeline/batch/[id]
// → { batch_id, items: [{sequence_id, statut, livrable_id?}], stats }
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const runs = await db.agentRun.findMany({
      where: { batchId: id },
      orderBy: { timestamp: 'asc' },
    })

    if (runs.length === 0) {
      return NextResponse.json({ error: 'batch introuvable ou vide', batch_id: id }, { status: 404 })
    }

    // Group by sequenceId
    const seqIds = Array.from(new Set(runs.map((r) => r.sequenceId).filter(Boolean))) as string[]
    const items = []
    for (const seqId of seqIds) {
      const seqRuns = runs.filter((r) => r.sequenceId === seqId)
      const hasEscalade = seqRuns.some((r) => r.decision === 'escalade_humaine')
      const lastSuperviseur = [...seqRuns].reverse().find((r) => r.agent === 'superviseur')
      const hasError = seqRuns.some((r) => r.statut === 'error')
      const seq = await db.sequence.findUnique({
        where: { id: seqId },
        select: { id: true, titre: true, statut: true },
      })
      const livrable = await db.livrable.findFirst({
        where: { sequenceId: seqId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, valide: true },
      })
      items.push({
        sequence_id: seqId,
        sequence_titre: seq?.titre ?? null,
        statut: hasEscalade
          ? 'escalade_humaine'
          : lastSuperviseur?.decision === 'continue'
            ? 'validee'
            : hasError
              ? (seq?.statut ?? 'en_cours')
              : (seq?.statut ?? 'en_cours'),
        livrable_id: livrable?.id ?? null,
        livrable_valide: livrable?.valide ?? null,
        runs_count: seqRuns.length,
        last_decision: lastSuperviseur?.decision ?? null,
        last_skill: lastSuperviseur?.skill ?? null,
        runs: seqRuns.map((r) => ({
          id: r.id,
          agent: r.agent,
          skill: r.skill,
          decision: r.decision,
          statut: r.statut,
          durationMs: r.durationMs,
          timestamp: r.timestamp.toISOString(),
        })),
      })
    }

    const stats = {
      total_sequences: items.length,
      validees: items.filter((i) => i.statut === 'validee').length,
      en_cours: items.filter((i) => i.statut === 'en_cours').length,
      echec: items.filter((i) => i.statut === 'echec').length,
      escalade: items.filter((i) => i.statut === 'escalade_humaine').length,
      total_runs: runs.length,
      started_at: runs[0]?.timestamp.toISOString() ?? null,
      finished_at: runs[runs.length - 1]?.timestamp.toISOString() ?? null,
    }

    return NextResponse.json({
      batch_id: id,
      items,
      stats,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
