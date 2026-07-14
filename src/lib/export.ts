// Export documentaire — P0-3
// Produit des livrables dans 4 formats : markdown, html, docx, pdf
// Respecte le template v1 : 7 sections avec labels, en-tête, métadonnées.
//
// Architecture Élite v2 §6 : skill export_render_v1
// Le Superviseur appelle exportRender(rendered, format) → string | Buffer

import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
  BorderStyle,
  type ISectionOptions,
} from 'docx'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import {
  FICHE_TEMPLATE_V1_SECTIONS,
  SECTION_LABELS,
  type FicheSectionId,
  type RenderedDocument,
} from '@/lib/contracts'

// ============================================================
// Types
// ============================================================
export type ExportFormat = 'markdown' | 'html' | 'docx' | 'pdf'

export interface ExportResult {
  format: ExportFormat
  mime: string
  /** Buffer pour docx/pdf, string pour markdown/html */
  data: Buffer | string
  filename: string
}

// ============================================================
// markdownExport — déjà produit par renderFiche, on extrait
// ============================================================
export function markdownExport(rendered: RenderedDocument): string {
  const md = rendered.contenu_final.markdown
  if (typeof md !== 'string') {
    throw new Error('markdownExport: rendered.contenu_final.markdown manquant')
  }
  return md
}

// ============================================================
// htmlExport — HTML structuré avec CSS d'impression
// ============================================================
export function htmlExport(rendered: RenderedDocument): string {
  const sections = (rendered.contenu_final.sections ?? []) as Array<{
    section_id: string
    label: string
    contenu: string
    methode: string | null
  }>

  const meta = (rendered.contenu_final.meta ?? {}) as Record<string, unknown>
  const titre = (meta.sequence_titre as string) || rendered.sequence_id

  const sectionsHtml = sections
    .map((s) => {
      const contenuHtml = escapeHtml(s.contenu).replace(/\n/g, '<br>')
      const methodeHtml = s.methode
        ? `<blockquote class="methode"><strong>Méthode :</strong> ${escapeHtml(s.methode)}</blockquote>`
        : ''
      return `<section class="fiche-section">
  <h2>${escapeHtml(s.label)}</h2>
  <div class="contenu">${contenuHtml}</div>
  ${methodeHtml}
</section>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(titre)}</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Georgia', 'Times New Roman', serif; max-width: 210mm; margin: 0 auto; padding: 20px; line-height: 1.6; color: #1a1a1a; }
  h1 { border-bottom: 3px solid #0d9488; padding-bottom: 10px; color: #0f766e; font-size: 22pt; }
  h2 { margin-top: 28px; color: #0f766e; border-left: 4px solid #14b8a6; padding-left: 10px; font-size: 14pt; }
  .meta { background: #f0fdfa; padding: 12px; border-radius: 6px; margin: 16px 0; font-size: 10pt; }
  .meta p { margin: 2px 0; }
  .fiche-section { page-break-inside: avoid; margin-bottom: 18px; }
  .contenu { white-space: pre-wrap; }
  blockquote.methode { border-left: 4px solid #6b7280; padding-left: 12px; color: #444; font-style: italic; background: #f9fafb; margin: 8px 0; padding: 8px 12px; }
  @media print { body { padding: 0; } .fiche-section { page-break-inside: avoid; } }
</style>
</head>
<body>
<h1>${escapeHtml(titre)}</h1>
<div class="meta">
  <p><strong>Notions :</strong> ${escapeHtml(String(meta.notions_count ?? '?'))} notion(s)</p>
  <p><strong>Exemples pédagogiques mobilisés :</strong> ${escapeHtml(String(meta.exemples_count ?? '?'))}</p>
  <p><strong>Références de style :</strong> ${escapeHtml(String(meta.references_count ?? '?'))}</p>
  <p><strong>Template :</strong> ${escapeHtml(String(meta.template_version ?? 'v1'))}  |  <strong>Curriculum :</strong> ${escapeHtml(String(meta.curriculum_version ?? 'v1'))}</p>
</div>
${sectionsHtml}
</body>
</html>`
}

// ============================================================
// docxExport — produit un Buffer .docx via la lib 'docx'
// Respecte le template v1 : titre, métadonnées, 7 sections
// ============================================================
export async function docxExport(rendered: RenderedDocument): Promise<Buffer> {
  const sections = (rendered.contenu_final.sections ?? []) as Array<{
    section_id: string
    label: string
    contenu: string
    methode: string | null
  }>
  const meta = (rendered.contenu_final.meta ?? {}) as Record<string, unknown>
  const titre = (meta.sequence_titre as string) || rendered.sequence_id

  const children: Paragraph[] = []

  // Titre principal
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: titre, bold: true, size: 32 })],
    }),
  )
  children.push(new Paragraph({ text: '' })) // spacer

  // Bloc métadonnées
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun({ text: 'Informations', bold: true, color: '0F766E' })],
    }),
  )
  const metaLines = [
    `Notions : ${meta.notions_count ?? '?'} notion(s)`,
    `Exemples pédagogiques mobilisés : ${meta.exemples_count ?? '?'}`,
    `Références de style : ${meta.references_count ?? '?'}`,
    `Template : ${meta.template_version ?? 'v1'}  |  Curriculum : ${meta.curriculum_version ?? 'v1'}`,
  ]
  for (const line of metaLines) {
    children.push(new Paragraph({ text: line, size: 20 }))
  }
  children.push(new Paragraph({ text: '' }))

  // Sections de la fiche
  for (const sid of FICHE_TEMPLATE_V1_SECTIONS) {
    const s = sections.find((x) => x.section_id === sid)
    const label = SECTION_LABELS[sid] || sid

    // Titre de section
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: '14B8A6', space: 8 } },
        children: [new TextRun({ text: label, bold: true, color: '0F766E' })],
      }),
    )

    if (s) {
      // Contenu — on split par lignes pour préserver la structure
      const lignes = (s.contenu || '').split('\n').filter((l) => l.trim().length > 0)
      for (const ligne of lignes) {
        children.push(new Paragraph({ text: ligne, size: 22 }))
      }
      // Méthode
      if (s.methode) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Méthode : ', bold: true, italics: true }),
              new TextRun({ text: s.methode, italics: true }),
            ],
            spacing: { before: 100 },
          }),
        )
      }
    } else {
      children.push(new Paragraph({ text: '(section non produite)', italics: true, color: '999999' }))
    }
    children.push(new Paragraph({ text: '' })) // spacer
  }

  const doc = new Document({
    creator: 'Élite v2 — Plateforme pédagogique agentique',
    title: titre,
    description: `Fiche pédagogique générée pour ${titre}`,
    sections: [{ properties: {}, children } satisfies ISectionOptions],
  })

  return Packer.toBuffer(doc)
}

// ============================================================
// pdfExport — produit un Buffer .pdf via pdf-lib
// Respecte le template v1 : pagination A4, titre, métadonnées, 7 sections
// ============================================================
export async function pdfExport(rendered: RenderedDocument): Promise<Buffer> {
  const sections = (rendered.contenu_final.sections ?? []) as Array<{
    section_id: string
    label: string
    contenu: string
    methode: string | null
  }>
  const meta = (rendered.contenu_final.meta ?? {}) as Record<string, unknown>
  const titre = (meta.sequence_titre as string) || rendered.sequence_id

  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(titre)
  pdfDoc.setAuthor('Élite v2 — Plateforme pédagogique agentique')
  pdfDoc.setSubject('Fiche pédagogique')
  pdfDoc.setCreator('Élite v2 — Plateforme pédagogique agentique')

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // A4 : 595.28 x 841.89 points
  const PAGE_W = 595.28
  const PAGE_H = 841.89
  const MARGIN = 50
  const CONTENT_W = PAGE_W - 2 * MARGIN
  const COLOR_TEAL = rgb(0.05, 0.46, 0.43)    // #0F766E
  const COLOR_DARK = rgb(0.12, 0.16, 0.23)    // #1F2937
  const COLOR_GRAY = rgb(0.29, 0.33, 0.40)    // #4B5563
  const COLOR_LIGHT = rgb(0.61, 0.64, 0.69)   // #9CA3AF

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  // Helper : saut de page si besoin
  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 30) {
      // Numérotation de page
      const pageNum = pdfDoc.getPageCount()
      page.drawText(`Page ${pageNum} — Élite v2`, {
        x: PAGE_W / 2 - 60,
        y: 25,
        size: 7,
        font: fontRegular,
        color: COLOR_LIGHT,
      })
      page = pdfDoc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }
  }

  // Helper : texte wrapped (gère les sauts de ligne manuels + wrapping)
  const drawWrapped = (text: string, opts: {
    size: number
    font: typeof fontRegular
    color: ReturnType<typeof rgb>
    maxWidth?: number
    lineHeight?: number
  }) => {
    const maxWidth = opts.maxWidth ?? CONTENT_W
    const lineHeight = opts.lineHeight ?? opts.size * 1.4
    const paragraphs = text.split('\n')
    for (const para of paragraphs) {
      const words = para.split(/\s+/).filter(Boolean)
      if (words.length === 0) {
        y -= lineHeight * 0.5
        continue
      }
      let line = ''
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word
        const width = opts.font.widthOfTextAtSize(testLine, opts.size)
        if (width > maxWidth && line) {
          ensureSpace(lineHeight)
          page.drawText(line, { x: MARGIN, y, size: opts.size, font: opts.font, color: opts.color })
          y -= lineHeight
          line = word
        } else {
          line = testLine
        }
      }
      if (line) {
        ensureSpace(lineHeight)
        page.drawText(line, { x: MARGIN, y, size: opts.size, font: opts.font, color: opts.color })
        y -= lineHeight
      }
    }
  }

  // === Titre ===
  ensureSpace(40)
  const titreWidth = fontBold.widthOfTextAtSize(titre, 18)
  page.drawText(titre, {
    x: (PAGE_W - titreWidth) / 2,
    y,
    size: 18,
    font: fontBold,
    color: COLOR_TEAL,
  })
  y -= 10
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 2,
    color: COLOR_TEAL,
  })
  y -= 25

  // === Métadonnées ===
  ensureSpace(30)
  page.drawText('Informations', { x: MARGIN, y, size: 11, font: fontBold, color: COLOR_DARK })
  y -= 16
  const metaLines = [
    `Notions : ${meta.notions_count ?? '?'}  |  Exemples : ${meta.exemples_count ?? '?'}  |  Références : ${meta.references_count ?? '?'}`,
    `Template : ${meta.template_version ?? 'v1'}  |  Curriculum : ${meta.curriculum_version ?? 'v1'}`,
  ]
  for (const line of metaLines) {
    ensureSpace(14)
    page.drawText(line, { x: MARGIN, y, size: 9, font: fontRegular, color: COLOR_GRAY })
    y -= 14
  }
  y -= 20

  // === Sections ===
  for (const sid of FICHE_TEMPLATE_V1_SECTIONS) {
    const s = sections.find((x) => x.section_id === sid)
    const label = SECTION_LABELS[sid] || sid

    ensureSpace(40)

    // Titre de section
    page.drawText(label, { x: MARGIN, y, size: 13, font: fontBold, color: COLOR_TEAL })
    y -= 4
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + 60, y },
      thickness: 1.5,
      color: rgb(0.08, 0.72, 0.55), // #14B8A6
    })
    y -= 18

    // Contenu
    if (s) {
      drawWrapped((s.contenu || '').trim(), { size: 10, font: fontRegular, color: COLOR_DARK })
      if (s.methode) {
        y -= 5
        drawWrapped(`Méthode : ${s.methode}`, { size: 9, font: fontItalic, color: COLOR_GRAY })
      }
    } else {
      ensureSpace(12)
      page.drawText('(section non produite)', { x: MARGIN, y, size: 9, font: fontItalic, color: COLOR_LIGHT })
      y -= 12
    }
    y -= 18
  }

  // Numérotation de la dernière page
  const totalPages = pdfDoc.getPageCount()
  page.drawText(`Page ${totalPages} / ${totalPages} — Élite v2`, {
    x: PAGE_W / 2 - 60,
    y: 25,
    size: 7,
    font: fontRegular,
    color: COLOR_LIGHT,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

// ============================================================
// exportLivrable — point d'entrée unique
// ============================================================
export async function exportLivrable(rendered: RenderedDocument, format: ExportFormat): Promise<ExportResult> {
  // Guard : validation du rendered (P0-5/P0-1 cohérence)
  if (!rendered || !rendered.contenu_final) {
    throw new Error('exportLivrable: rendered ou rendered.contenu_final manquant')
  }

  const titre = (rendered.contenu_final.meta as Record<string, unknown> | undefined)?.sequence_titre as string || rendered.sequence_id
  const safeTitre = titre.replace(/[^a-zA-Z0-9À-ÿ\-\s]/g, '').replace(/\s+/g, '_').slice(0, 60)

  switch (format) {
    case 'markdown':
      return { format, mime: 'text/markdown', data: markdownExport(rendered), filename: `${safeTitre}.md` }
    case 'html':
      return { format, mime: 'text/html', data: htmlExport(rendered), filename: `${safeTitre}.html` }
    case 'docx':
      return { format, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: await docxExport(rendered), filename: `${safeTitre}.docx` }
    case 'pdf':
      return { format, mime: 'application/pdf', data: await pdfExport(rendered), filename: `${safeTitre}.pdf` }
    default:
      throw new Error(`exportLivrable: format non supporté "${format}"`)
  }
}

// ============================================================
// escapeHtml — échappement pour l'export HTML
// ============================================================
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
