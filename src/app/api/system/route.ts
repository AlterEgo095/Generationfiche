import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processOutbox } from '@/lib/outbox-worker'
import { llmRateLimiter } from '@/lib/llm-limiter'
import { pipelineGate } from '@/lib/pipeline-gate'

// GET /api/system — Dashboard système complet
// Retourne : santé API, état queue LLM, état outbox, erreurs 24h, temps moyen génération
export async function GET() {
  try {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Outbox stats
    const outboxStats = await db.eventOutbox.groupBy({
      by: ['status'],
      _count: true,
    })
    const outboxMap: Record<string, number> = {}
    for (const s of outboxStats) outboxMap[s.status] = s._count

    // Last event
    const lastEvent = await db.eventOutbox.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, status: true, agent: true, message: true },
    })

    // Erreurs 24h (agent_runs avec statut error)
    const errors24h = await db.agentRun.count({
      where: { statut: 'error', timestamp: { gte: yesterday } },
    })

    // Latences par agent (24h)
    const agentLatencies = await db.agentRun.groupBy({
      by: ['agent'],
      where: { timestamp: { gte: yesterday } },
      _avg: { durationMs: true },
      _count: true,
    })

    // DB counts
    const [sequences, livrables, corpus, notions, agentRuns] = await Promise.all([
      db.sequence.count(),
      db.livrable.count(),
      db.corpusVectoriel.count(),
      db.notion.count(),
      db.agentRun.count(),
    ])

    // LLM limiter status
    const llmStatus = llmRateLimiter.getStatus()

    // R-12 : statut du gouverneur d'admission des pipelines (F-33 fermé)
    const gateStatus = pipelineGate.getStatus()

    // Worker status : healthy si pas trop d'events failed
    const failedEvents = outboxMap['failed_delivery'] || 0
    const pendingEvents = outboxMap['pending'] || 0
    const workerStatus = failedEvents > 50 ? 'degraded' : pendingEvents > 100 ? 'overloaded' : 'healthy'

    return NextResponse.json({
      status: 'ok',
      timestamp: now.toISOString(),
      api: {
        healthy: true,
        version: 'elite-v2-sprint4',
      },
      database: {
        sequences,
        livrables,
        corpus,
        notions,
        agentRuns,
      },
      llm_limiter: {
        state: llmStatus.state,
        active: llmStatus.active,
        queued: llmStatus.queued,
        consecutive_errors: llmStatus.consecutiveErrors,
        pacing_ms: llmStatus.pacingMs,
        adaptive_spacing_ms: llmStatus.adaptiveSpacingMs,
        rate_limit_hits: llmStatus.rateLimitHits,
        max_concurrent: parseInt(process.env.MAX_CONCURRENT_LLM || '3', 10),
      },
      outbox: {
        pending: pendingEvents,
        delivered: outboxMap['delivered'] || 0,
        failed: failedEvents,
        total: Object.values(outboxMap).reduce((a, b) => a + b, 0),
        delivery_rate: Object.values(outboxMap).reduce((a, b) => a + b, 0) > 0
          ? Math.round(((outboxMap['delivered'] || 0) / Object.values(outboxMap).reduce((a, b) => a + b, 0)) * 100)
          : 100,
        last_event: lastEvent ? {
          timestamp: lastEvent.createdAt.toISOString(),
          status: lastEvent.status,
          agent: lastEvent.agent,
          message: lastEvent.message,
        } : null,
        worker_status: workerStatus,
      },
      pipeline_gate: {
        enabled: gateStatus.enabled,
        active: gateStatus.active,
        max: gateStatus.max,
        queued: gateStatus.queued,
        total_admitted: gateStatus.totalAdmitted,
        total_refused: gateStatus.totalRefused,
      },
      errors_24h: errors24h,
      agent_latencies_24h: agentLatencies.map((a) => ({
        agent: a.agent,
        avg_ms: Math.round(a._avg.durationMs || 0),
        count: a._count,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ status: 'error', error: msg }, { status: 500 })
  }
}
