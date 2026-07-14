import { NextRequest, NextResponse } from 'next/server'
import { exportMultiTemplate, type TemplateStyle, type FicheData } from '@/lib/export-multi-template'

// POST /api/export-multi
// Body : { fiche: FicheData, templateStyle: 'congolais-bgp' | 'sesame-francais' | 'moderne', format: 'pdf' }
// Retourne le PDF généré selon le template choisi.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fiche, templateStyle, format } = body || {}

    if (!fiche || typeof fiche !== 'object') {
      return NextResponse.json({ error: 'fiche manquant' }, { status: 400 })
    }

    const validStyles: TemplateStyle[] = ['congolais-bgp', 'sesame-francais', 'moderne']
    if (!validStyles.includes(templateStyle)) {
      return NextResponse.json({ error: `templateStyle invalide. Valeurs: ${validStyles.join(', ')}` }, { status: 400 })
    }

    const result = await exportMultiTemplate(fiche as FicheData, format || 'pdf', templateStyle as TemplateStyle)

    const headers = new Headers()
    headers.set('Content-Type', result.mime)
    headers.set('Content-Disposition', `attachment; filename="${result.filename}"`)
    return new NextResponse(result.data as BodyInit, { headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[export-multi] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
