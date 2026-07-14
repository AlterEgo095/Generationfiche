import { NextRequest, NextResponse } from 'next/server'
import { processOutbox } from '@/lib/outbox-worker'
import { db } from '@/lib/db'

// POST /api/events/process — déclenche le worker outbox pour livrer les events en attente
// Peut être appelé périodiquement (cron, setInterval frontend, ou manuellement).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const limit = Math.min(body.limit || 20, 100)
    const result = await processOutbox(limit)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/events/status — statistiques de l'outbox
export async function GET() {
  try {
    const pending = await db.eventOutbox.count({ where: { status: 'pending' } })
    const delivered = await db.eventOutbox.count({ where: { status: 'delivered' } })
    const failed = await db.eventOutbox.count({ where: { status: 'failed_delivery' } })
    const total = pending + delivered + failed
    return NextResponse.json({
      total,
      pending,
      delivered,
      failed,
      delivery_rate: total > 0 ? Math.round((delivered / total) * 100) : 100,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
