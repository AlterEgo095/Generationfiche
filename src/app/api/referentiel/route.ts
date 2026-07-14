import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/referentiel → { notions (with prerequisPour/prerequisDe), progressions, regles }
export async function GET() {
  try {
    const [notions, progressions, regles] = await Promise.all([
      db.notion.findMany({
        include: {
          prerequisPour: { include: { prerequis: true } },
          prerequisDe: { include: { notion: true } },
        },
        orderBy: { niveau: 'asc' },
      }),
      db.progression.findMany({
        include: { notion: true },
        orderBy: [{ niveau: 'asc' }, { semaine: 'asc' }],
      }),
      db.regle.findMany({
        where: { active: true },
        orderBy: { niveau: 'asc' },
      }),
    ])

    return NextResponse.json({
      notions: notions.map((n) => ({
        id: n.id,
        nom: n.nom,
        description: n.description,
        niveau: n.niveau,
        chapitre: n.chapitre,
        competences: JSON.parse(n.competences),
        objectifs: JSON.parse(n.objectifs),
        prerequisPour: n.prerequisPour.map((p) => ({
          id: p.id,
          obligation: p.obligation,
          prerequis: { id: p.prerequis.id, nom: p.prerequis.nom, niveau: p.prerequis.niveau },
        })),
        prerequisDe: n.prerequisDe.map((p) => ({
          id: p.id,
          obligation: p.obligation,
          notion: { id: p.notion.id, nom: p.notion.nom, niveau: p.notion.niveau },
        })),
      })),
      progressions: progressions.map((p) => ({
        id: p.id,
        niveau: p.niveau,
        chapitre: p.chapitre,
        semaine: p.semaine,
        dureeMin: p.dureeMin,
        notionId: p.notionId,
        notion: { id: p.notion.id, nom: p.notion.nom },
      })),
      regles: regles.map((r) => ({
        id: r.id,
        niveau: r.niveau,
        cle: r.cle,
        valeur: safeParse(r.valeur),
        active: r.active,
      })),
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
