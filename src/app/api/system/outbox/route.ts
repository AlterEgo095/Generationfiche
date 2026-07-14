import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { processOutbox } from '@/lib/outbox-worker'

// GET /api/system/outbox — Monitoring outbox
// Retour : { pending, failed, processed, last_event, worker_status }
export async function GET() {
  try {
    const outboxStats = await db.eventOutbox.groupBy({
      by: ['status'],
      _count: true,
    })
    const outboxMap: Record<string, number> = {}
    for (const s of outboxStats) outboxMap[s.status] = s._count

    const lastEvent = await db.eventOutbox.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, status: true, agent: true, message: true, attempts: true },
    })

    const pending = outboxMap['pending'] || 0
    const failed = outboxMap['failed_delivery'] || 0
    const delivered = outboxMap['delivered'] || 0
    const total = pending + failed + delivered
    const workerStatus = failed > 50 ? 'degraded' : pending > 100 ? 'overloaded' : 'healthy'

    return NextResponse.json({
      pending,
      failed,
      processed: delivered,
      delivered,
      total,
      delivery_rate: total > 0 ? Math.round((delivered / total) * 100) : 100,
      last_event: lastEvent ? {
        timestamp: lastEvent.createdAt.toISOString(),
        status: lastEvent.status,
        agent: lastEvent.agent,
        message: lastEvent.message,
        attempts: lastEvent.attempts,
      } : null,
      worker_status: workerStatus,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg, worker_status: 'error' }, { status: 500 })
  }
}

// POST /api/system/outbox — Déclenche le worker (process pending events)
export async function POST() {
  try {
    const result = await processOutbox(50)
    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
