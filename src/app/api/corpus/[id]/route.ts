import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

// P0-1 : schéma Zod pour le PATCH corpus (statut en enum)
const patchCorpusSchema = z.object({
  statut: z.enum(['brouillon', 'validee']).optional(),
  exemplaire: z.boolean().optional(),
  contenu: z.string().min(10).max(10000).optional(),
})

// PATCH /api/corpus/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // P0-1 : validation Zod du body
    const parsed = patchCorpusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'body invalide', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const data: Record<string, unknown> = {}
    if (parsed.data.statut !== undefined) data.statut = parsed.data.statut
    if (parsed.data.exemplaire !== undefined) data.exemplaire = parsed.data.exemplaire
    if (parsed.data.contenu !== undefined) data.contenu = parsed.data.contenu

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
