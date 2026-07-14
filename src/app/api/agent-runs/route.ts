import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/agent-runs?agent=&batchId=&sequenceId=
export async function GET(req: NextRequest) {
  try {
    const agent = req.nextUrl.searchParams.get('agent') || undefined
    const batchId = req.nextUrl.searchParams.get('batchId') || undefined
    const sequenceId = req.nextUrl.searchParams.get('sequenceId') || undefined
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10)

    const where: Record<string, unknown> = {}
    if (agent) where.agent = agent
    if (batchId) where.batchId = batchId
    if (sequenceId) where.sequenceId = sequenceId

    const runs = await db.agentRun.findMany({
      where,
      take: Math.min(limit, 500),
      orderBy: { timestamp: 'desc' },
      include: { sequence: { select: { id: true, titre: true } } },
    })

    return NextResponse.json({
      items: runs.map((r) => ({
        id: r.id,
        sequenceId: r.sequenceId,
        batchId: r.batchId,
        agent: r.agent,
        skill: r.skill,
        input: safeParse(r.input),
        output: safeParse(r.output),
        decision: r.decision,
        durationMs: r.durationMs,
        statut: r.statut,
        timestamp: r.timestamp.toISOString(),
        sequence_titre: r.sequence?.titre ?? null,
      })),
      total: runs.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}
