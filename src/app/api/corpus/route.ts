import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/corpus?type=&niveau=&chapitre=&statut=&exemplaire=
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') || undefined
    const niveau = req.nextUrl.searchParams.get('niveau') || undefined
    const chapitre = req.nextUrl.searchParams.get('chapitre') || undefined
    const statut = req.nextUrl.searchParams.get('statut') || undefined
    const exemplaire = req.nextUrl.searchParams.get('exemplaire')

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (niveau) where.niveau = niveau
    if (chapitre) where.chapitre = { contains: chapitre }
    if (statut) where.statut = statut
    if (exemplaire === 'true') where.exemplaire = true
    if (exemplaire === 'false') where.exemplaire = false

    const items = await db.corpusVectoriel.findMany({
      where,
      include: { notion: { select: { id: true, nom: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      items: items.map((c) => ({
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
      })),
      total: items.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/corpus
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contenu, type, niveau, chapitre, notionId, exemplaire, statut, metadata } = body || {}
    if (!contenu || !type || !niveau || !chapitre) {
      return NextResponse.json(
        { error: 'champs obligatoires: contenu, type, niveau, chapitre' },
        { status: 400 },
      )
    }
    const created = await db.corpusVectoriel.create({
      data: {
        contenu,
        type,
        niveau,
        chapitre,
        notionId: notionId || null,
        exemplaire: !!exemplaire,
        statut: statut || 'brouillon',
        embedding: 'pending',
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
    return NextResponse.json({
      id: created.id,
      contenu: created.contenu,
      type: created.type,
      niveau: created.niveau,
      chapitre: created.chapitre,
      statut: created.statut,
      exemplaire: created.exemplaire,
      notionId: created.notionId,
      createdAt: created.createdAt.toISOString(),
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
