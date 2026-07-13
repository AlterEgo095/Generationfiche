import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sequences?statut=&niveau=&chapitre=
export async function GET(req: NextRequest) {
  try {
    const statut = req.nextUrl.searchParams.get('statut') || undefined
    const niveau = req.nextUrl.searchParams.get('niveau') || undefined
    const chapitre = req.nextUrl.searchParams.get('chapitre') || undefined

    const where: Record<string, unknown> = {}
    if (statut) where.statut = statut
    if (niveau) where.niveau = niveau
    if (chapitre) where.chapitre = { contains: chapitre }

    const sequences = await db.sequence.findMany({
      where,
      include: {
        notions: { include: { notion: true } },
        progression: true,
        _count: { select: { livrables: true, agentRuns: true } },
      },
      orderBy: [{ semaine: 'asc' }, { priorite: 'desc' }],
    })

    return NextResponse.json({
      items: sequences.map((s) => ({
        id: s.id,
        titre: s.titre,
        niveau: s.niveau,
        chapitre: s.chapitre,
        semaine: s.semaine,
        priorite: s.priorite,
        statut: s.statut,
        templateVersion: s.templateVersion,
        curriculumVersion: s.curriculumVersion,
        contexteClasse: s.contexteClasse,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        notionIds: JSON.parse(s.notionIds),
        notions: s.notions.map((sn) => ({
          notionId: sn.notionId,
          nom: sn.notion.nom,
          niveau: sn.notion.niveau,
          chapitre: sn.notion.chapitre,
        })),
        progression: s.progression
          ? {
              id: s.progression.id,
              semaine: s.progression.semaine,
              dureeMin: s.progression.dureeMin,
            }
          : null,
        livrables_count: s._count.livrables,
        agentRuns_count: s._count.agentRuns,
      })),
      total: sequences.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/sequences — create manually
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { titre, niveau, chapitre, semaine, notionIds, priorite, contexteClasse, templateVersion } = body || {}

    if (!titre || !niveau || !chapitre || !Array.isArray(notionIds) || notionIds.length === 0) {
      return NextResponse.json(
        { error: 'champs obligatoires: titre, niveau, chapitre, notionIds[]' },
        { status: 400 },
      )
    }

    const seq = await db.sequence.create({
      data: {
        titre,
        niveau,
        chapitre,
        semaine: Number(semaine) || 1,
        priorite: Number(priorite) || 0,
        notionIds: JSON.stringify(notionIds),
        contexteClasse: contexteClasse ? JSON.stringify(contexteClasse) : null,
        templateVersion: templateVersion || 'v1',
        curriculumVersion: 'v1',
        statut: 'en_attente',
        notions: { create: notionIds.map((id: string) => ({ notionId: id })) },
      },
      include: { notions: { include: { notion: true } } },
    })

    return NextResponse.json({
      id: seq.id,
      titre: seq.titre,
      niveau: seq.niveau,
      chapitre: seq.chapitre,
      semaine: seq.semaine,
      priorite: seq.priorite,
      statut: seq.statut,
      notionIds: JSON.parse(seq.notionIds),
      notions: seq.notions.map((sn) => ({ notionId: sn.notionId, nom: sn.notion.nom })),
      createdAt: seq.createdAt.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
