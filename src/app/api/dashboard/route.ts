import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/dashboard
// → { counts, byStatut, funnel, recentRuns, recentLivrables }
export async function GET() {
  try {
    const [
      sequencesCount,
      livrablesCount,
      corpusCount,
      notionsCount,
      agentRunsCount,
      sequences,
      recentRuns,
      recentLivrables,
    ] = await Promise.all([
      db.sequence.count(),
      db.livrable.count(),
      db.corpusVectoriel.count(),
      db.notion.count(),
      db.agentRun.count(),
      db.sequence.findMany({ select: { statut: true, id: true } }),
      db.agentRun.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: { sequence: { select: { titre: true } } },
      }),
      db.livrable.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          sequence: { select: { titre: true, niveau: true, chapitre: true } },
          validations: true,
        },
      }),
    ])

    const byStatut = {
      validee: 0,
      en_cours: 0,
      planifiee: 0,
      en_attente: 0,
      echec: 0,
    }
    for (const s of sequences) {
      if (s.statut in byStatut) {
        ;(byStatut as Record<string, number>)[s.statut]++
      }
    }

    // Funnel — compte les validations par couche
    const validations = await db.validationResult.findMany({
      select: { structurelPass: true, pedagogiquePass: true },
    })
    const funnel = {
      generees: livrablesCount,
      structurel_ok: validations.filter((v) => v.structurelPass).length,
      pedagogique_ok: validations.filter((v) => v.pedagogiquePass).length,
      validees: await db.livrable.count({ where: { valide: true } }),
    }

    return NextResponse.json({
      counts: {
        sequences: sequencesCount,
        livrables: livrablesCount,
        corpus: corpusCount,
        notions: notionsCount,
        agentRuns: agentRunsCount,
      },
      byStatut,
      funnel,
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        agent: r.agent,
        skill: r.skill,
        decision: r.decision,
        statut: r.statut,
        durationMs: r.durationMs,
        timestamp: r.timestamp.toISOString(),
        sequenceId: r.sequenceId,
        batchId: r.batchId,
        sequence_titre: r.sequence?.titre ?? null,
      })),
      recentLivrables: recentLivrables.map((l) => ({
        id: l.id,
        sequenceId: l.sequenceId,
        type: l.type,
        format: l.format,
        valide: l.valide,
        skillVersion: l.skillVersion,
        createdAt: l.createdAt.toISOString(),
        sequence: l.sequence,
        validations: l.validations.map((v) => ({
          id: v.id,
          structurelPass: v.structurelPass,
          pedagogiquePass: v.pedagogiquePass,
          coucheDeclenchee: v.coucheDeclenchee,
          skillVersion: v.skillVersion,
        })),
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
