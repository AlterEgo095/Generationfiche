import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/livrables/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const livrable = await db.livrable.findUnique({
      where: { id },
      include: {
        sequence: {
          select: { id: true, titre: true, niveau: true, chapitre: true, semaine: true },
        },
        validations: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!livrable) return NextResponse.json({ error: 'Livrable non trouvé' }, { status: 404 })

    return NextResponse.json({
      id: livrable.id,
      sequenceId: livrable.sequenceId,
      type: livrable.type,
      format: livrable.format,
      valide: livrable.valide,
      skillVersion: livrable.skillVersion,
      agentTraceId: livrable.agentTraceId,
      createdAt: livrable.createdAt.toISOString(),
      contenu: safeParse(livrable.contenuJson),
      sequence: livrable.sequence,
      validations: livrable.validations.map((v) => ({
        id: v.id,
        structurelPass: v.structurelPass,
        structurelRaisons: safeParse(v.structurelRaisons),
        pedagogiquePass: v.pedagogiquePass,
        pedagogiqueRaisons: v.pedagogiqueRaisons ? safeParse(v.pedagogiqueRaisons) : null,
        sectionARegenerer: v.sectionARegenerer,
        coucheDeclenchee: v.coucheDeclenchee,
        skillVersion: v.skillVersion,
        createdAt: v.createdAt.toISOString(),
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
