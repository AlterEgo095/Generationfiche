import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/corpus/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { statut, exemplaire, contenu } = body || {}

    const data: Record<string, unknown> = {}
    if (typeof statut === 'string') data.statut = statut
    if (typeof exemplaire === 'boolean') data.exemplaire = exemplaire
    if (typeof contenu === 'string') data.contenu = contenu

    const updated = await db.corpusVectoriel.update({
      where: { id },
      data,
    })
    return NextResponse.json({
      id: updated.id,
      contenu: updated.contenu,
      type: updated.type,
      niveau: updated.niveau,
      chapitre: updated.chapitre,
      statut: updated.statut,
      exemplaire: updated.exemplaire,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const c = await db.corpusVectoriel.findUnique({
      where: { id },
      include: { notion: { select: { id: true, nom: true } } },
    })
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      id: c.id,
      contenu: c.contenu,
      type: c.type,
      niveau: c.niveau,
      chapitre: c.chapitre,
      statut: c.statut,
      exemplaire: c.exemplaire,
      notionId: c.notionId,
      notion: c.notion,
      metadata: c.metadata ? safeParse(c.metadata) : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
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
