import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/system/health — Health check simple pour load balancer / monitoring
export async function GET() {
  try {
    // Vérifie la DB
    const notionCount = await db.notion.count()

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'ok',
      notionCount,
    })
  } catch (e) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    )
  }
}
