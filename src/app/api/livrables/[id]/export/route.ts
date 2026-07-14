import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { renderFiche } from '@/lib/pipeline/superviseur'
import { exportLivrable, type ExportFormat } from '@/lib/export'
import type { GenerationContext, SectionContent } from '@/lib/contracts'

// GET /api/livrables/[id]/export?format=markdown|html|docx|pdf
// Télécharge le livrable dans le format demandé.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const formatParam = req.nextUrl.searchParams.get('format') || 'markdown'

    // P0-1 : validation du format (enum)
    const validFormats: ExportFormat[] = ['markdown', 'html', 'docx', 'pdf']
    if (!validFormats.includes(formatParam as ExportFormat)) {
      return NextResponse.json(
        { error: `format invalide. Valeurs acceptées: ${validFormats.join(', ')}` },
        { status: 400 },
      )
    }
    const format = formatParam as ExportFormat

    // Charge le livrable
    const livrable = await db.livrable.findUnique({
      where: { id },
      include: {
        sequence: {
          include: {
            notions: { include: { notion: true } },
          },
        },
        validations: true,
      },
    })
    if (!livrable) {
      return NextResponse.json({ error: 'Livrable introuvable' }, { status: 404 })
    }

    // Reconstruit le GenerationContext depuis la DB (figé, rejouable)
    const gcRow = await db.generationContext.findUnique({
      where: { sequenceId: livrable.sequenceId },
    })
    if (!gcRow) {
      return NextResponse.json({ error: 'GenerationContext introuvable pour ce livrable' }, { status: 404 })
    }
    const ctx = JSON.parse(gcRow.payloadJson) as GenerationContext

    // Reconstruit les SectionContent depuis contenuJson
    const contenuRaw = JSON.parse(livrable.contenuJson)
    // contenuJson peut être soit un objet {section_id: contenu} (seed), soit un objet avec .sections (pipeline)
    let sections: SectionContent[]
    if (Array.isArray(contenuRaw.sections)) {
      sections = contenuRaw.sections.map((s: { section_id: string; contenu: string; methode?: string | null }) => ({
        section_id: s.section_id,
        contenu: s.contenu,
        methode: s.methode ?? null,
      }))
    } else {
      // Format seed: { objectifs: "...", prerequis: "...", ... }
      sections = Object.entries(contenuRaw).map(([sid, contenu]) => ({
        section_id: sid,
        contenu: String(contenu),
        methode: null,
      }))
    }

    // Render (assemblage selon template)
    const rendered = renderFiche(sections, ctx, {
      livrable_id: livrable.id,
      skill_version: livrable.skillVersion,
    })

    // Export dans le format demandé
    const result = await exportLivrable(rendered, format)

    // Retourne le fichier avec les bons headers
    const headers = new Headers()
    headers.set('Content-Type', result.mime)
    headers.set('Content-Disposition', `attachment; filename="${result.filename}"`)
    headers.set('Content-Length', String(typeof result.data === 'string' ? result.data.length : result.data.length))

    return new NextResponse(result.data as BodyInit, { headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[export] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
