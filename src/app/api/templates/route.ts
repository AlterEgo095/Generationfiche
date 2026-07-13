import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/templates
export async function GET() {
  try {
    const templates = await db.ficheTemplate.findMany({
      orderBy: { version: 'asc' },
    })
    return NextResponse.json({
      items: templates.map((t) => ({
        id: t.id,
        version: t.version,
        nom: t.nom,
        active: t.active,
        structure: safeParse(t.structure),
        createdAt: t.createdAt.toISOString(),
      })),
      total: templates.length,
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
