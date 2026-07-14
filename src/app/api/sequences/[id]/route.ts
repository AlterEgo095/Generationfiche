import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sequences/[id] — full detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const seq = await db.sequence.findUnique({
      where: { id },
      include: {
        notions: { include: { notion: { include: { prerequisPour: { include: { prerequis: true } } } } } },
        progression: true,
        generationContext: true,
        livrables: { include: { validations: true }, orderBy: { createdAt: 'desc' } },
        agentRuns: { orderBy: { timestamp: 'desc' } },
      },
    })

    if (!seq) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })

    return NextResponse.json({
      id: seq.id,
      titre: seq.titre,
      niveau: seq.niveau,
      chapitre: seq.chapitre,
      semaine: seq.semaine,
      priorite: seq.priorite,
      statut: seq.statut,
      templateVersion: seq.templateVersion,
      curriculumVersion: seq.curriculumVersion,
      contexteClasse: seq.contexteClasse,
      createdAt: seq.createdAt.toISOString(),
      updatedAt: seq.updatedAt.toISOString(),
      notionIds: JSON.parse(seq.notionIds),
      notions: seq.notions.map((sn) => ({
        notionId: sn.notionId,
        nom: sn.notion.nom,
        description: sn.notion.description,
        niveau: sn.notion.niveau,
        chapitre: sn.notion.chapitre,
        competences: JSON.parse(sn.notion.competences),
        objectifs: JSON.parse(sn.notion.objectifs),
        prerequis: sn.notion.prerequisPour.map((p) => ({
          id: p.id,
          obligation: p.obligation,
          prerequis: { id: p.prerequis.id, nom: p.prerequis.nom },
        })),
      })),
      progression: seq.progression
        ? { id: seq.progression.id, semaine: seq.progression.semaine, dureeMin: seq.progression.dureeMin }
        : null,
      generationContext: seq.generationContext
        ? {
            id: seq.generationContext.id,
            compiledAt: seq.generationContext.compiledAt.toISOString(),
            payload: JSON.parse(seq.generationContext.payloadJson),
          }
        : null,
      livrables: seq.livrables.map((l) => ({
        id: l.id,
        type: l.type,
        format: l.format,
        valide: l.valide,
        skillVersion: l.skillVersion,
        createdAt: l.createdAt.toISOString(),
        contenu: JSON.parse(l.contenuJson),
        validations: l.validations.map((v) => ({
          id: v.id,
          structurelPass: v.structurelPass,
          structurelRaisons: JSON.parse(v.structurelRaisons),
          pedagogiquePass: v.pedagogiquePass,
          pedagogiqueRaisons: v.pedagogiqueRaisons ? JSON.parse(v.pedagogiqueRaisons) : null,
          sectionARegenerer: v.sectionARegenerer,
          coucheDeclenchee: v.coucheDeclenchee,
          skillVersion: v.skillVersion,
          createdAt: v.createdAt.toISOString(),
        })),
      })),
      agentRuns: seq.agentRuns.map((r) => ({
        id: r.id,
        agent: r.agent,
        skill: r.skill,
        decision: r.decision,
        statut: r.statut,
        durationMs: r.durationMs,
        timestamp: r.timestamp.toISOString(),
        batchId: r.batchId,
        input: safeParse(r.input),
        output: safeParse(r.output),
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
