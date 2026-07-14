import { NextResponse } from 'next/server'
import { SKILLS_CATALOG } from '@/lib/skills-catalog'

// GET /api/skills
export async function GET() {
  try {
    return NextResponse.json({ items: SKILLS_CATALOG, total: SKILLS_CATALOG.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
