import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

// P0-1 : schéma Zod pour la création d'entrée corpus
const createCorpusSchema = z.object({
  contenu: z.string().min(10).max(10000),
  type: z.enum(['exemple_pedagogique', 'fiche_reference']),
  niveau: z.enum(['6e', '5e', '4e', '3e', '2nde', '1ere', 'Term']),
  chapitre: z.string().min(1).max(100),
  notionId: z.string().optional(),
  exemplaire: z.boolean().optional(),
  statut: z.enum(['brouillon', 'validee']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

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

    // P0-1 : validation Zod du body (type et statut en enum — plus d'injection)
    const parsed = createCorpusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'body invalide', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const { contenu, type, niveau, chapitre, notionId, exemplaire, statut, metadata } = parsed.data

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
