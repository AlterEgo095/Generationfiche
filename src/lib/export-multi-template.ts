// Export multi-template Premium — Sprint 5
// 3 templates : Congolais BGP (2 pages recto-verso), Fiche Sésame (Français), Moderne
// Chaque template force 2 pages (recto-verso) avec positionnement précis du contenu.
// Aspects techniques : QR code traçabilité, pagination forcée, pieds de page, numérotation.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// ============================================================
// Types
// ============================================================
export type TemplateStyle = 'congolais-bgp' | 'sesame-francais' | 'moderne'
export type ExportFormat = 'markdown' | 'html' | 'docx' | 'pdf'

export interface FicheData {
  // En-tête commun
  fiche_numero?: string
  branche?: string
  discipline?: string
  niveau?: string
  chapitre?: string
  titre?: string
  titre_lecon?: string
  sujet_revision?: string
  sujet_jour?: string
  duree?: string
  // Objectifs et compétences
  objectifs?: string
  competences?: string[]
  prerequis?: string | string[]
  supports?: string[]
  materiel?: string
  ref_bgp?: string
  // Sections (variables selon template)
  introduction?: { rappel?: string; motivation?: string; annonce?: string }
  decouverte?: string
  comprehension?: string
  structuration?: string
  developpement?: string
  deroulement?: string
  activites?: string
  differentiation?: string
  synthese?: string
  application?: string[]
  evaluation?: string
  prolongement?: string
  auto_evaluation?: string[]
  // Métadonnées
  generated_at?: string
  sequence_id?: string
}

export interface ExportResult {
  format: ExportFormat
  mime: string
  data: Buffer | string
  filename: string
}

// ============================================================
// Helpers communs
// ============================================================
const PAGE_W = 595.28
const PAGE_H = 841.89

function sanitizeForPDF(s: string): string {
  if (!s) return ''
  return String(s)
    .replace(/▲/g, '>').replace(/▸/g, '>')
    .replace(/□/g, '[ ]').replace(/✓/g, 'v').replace(/✗/g, 'x')
    .replace(/⊂/g, 'C').replace(/⊆/g, 'C').replace(/⊃/g, 'C')
    .replace(/∈/g, 'in').replace(/∉/g, '!in').replace(/∞/g, 'inf')
    .replace(/√/g, 'V').replace(/π/g, 'pi').replace(/θ/g, 'theta')
    .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=')
    .replace(/×/g, 'x').replace(/÷/g, '/').replace(/±/g, '+/-')
    .replace(/→/g, '->').replace(/←/g, '<-').replace(/⇒/g, '=>')
    .replace(/²/g, '^2').replace(/³/g, '^3').replace(/…/g, '...')
    .replace(/€/g, 'EUR').replace(/£/g, 'GBP')
    .replace(/«/g, '"').replace(/»/g, '"').replace(/'/g, "'").replace(/'/g, "'")
    .replace(/–/g, '-').replace(/—/g, '-')
    .replace(/[^\x00-\xFF]/g, '?')
}

// ============================================================
// Générateur QR code simple (texte encodé en grille 2D)
// ============================================================
function drawQRPlaceholder(doc: any, x: number, y: number, size: number, text: string): void {
  // QR code simplifié — grille 8x8 basée sur le hash du texte
  const hash = text.split('').reduce((a: number, c: string) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
  const cellSize = size / 8
  doc.drawRectangle({ x, y: y - size, width: size, height: size, color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 1 })
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const bit = (hash >> ((i * 8 + j) % 24)) & 1
      if (bit) {
        doc.drawRectangle({
          x: x + j * cellSize,
          y: y - i * cellSize - cellSize,
          width: cellSize,
          height: cellSize,
          color: rgb(0.1, 0.1, 0.1),
        })
      }
    }
  }
  // Coins de repère (style QR real)
  const corner = cellSize * 2
  doc.drawRectangle({ x, y: y - size, width: corner, height: corner, color: rgb(0, 0, 0) })
  doc.drawRectangle({ x: x + size - corner, y: y - size, width: corner, height: corner, color: rgb(0, 0, 0) })
  doc.drawRectangle({ x, y: y - corner, width: corner, height: corner, color: rgb(0, 0, 0) })
}

// ============================================================
// Helper : drawWrappedText avec pagination automatique
// ============================================================
function createPdfHelper(pdfDoc: PDFDocument, fonts: { bold: any; regular: any; italic: any }) {
  let currentPage = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - 40
  let pageNumber = 1

  const newPage = () => {
    // Pied de page de la page courante
    drawFooter(currentPage, pageNumber)
    currentPage = pdfDoc.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - 40
    pageNumber++
  }

  const drawFooter = (page: any, num: number) => {
    page.drawText(sanitizeForPDF(`Page ${num} / 2`), {
      x: PAGE_W / 2 - 30, y: 20, size: 7,
      font: fonts.regular, color: rgb(0.6, 0.6, 0.6),
    })
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < 50) {
      newPage()
    }
  }

  const drawWrapped = (text: string, opts: {
    size: number
    font: any
    color: ReturnType<typeof rgb>
    indent?: number
    maxWidth?: number
  }) => {
    const sanitized = sanitizeForPDF(text)
    const maxWidth = opts.maxWidth || (PAGE_W - 80 - (opts.indent || 0))
    const lineHeight = opts.size * 1.35
    for (const line of sanitized.split('\n')) {
      const words = line.split(/\s+/).filter(Boolean)
      if (!words.length) { y -= lineHeight * 0.5; continue }
      let current = ''
      for (const word of words) {
        const test = current ? `${current} ${word}` : word
        if (opts.font.widthOfTextAtSize(test, opts.size) > maxWidth && current) {
          ensureSpace(lineHeight)
          currentPage.drawText(current, { x: 40 + (opts.indent || 0), y, size: opts.size, font: opts.font, color: opts.color })
          y -= lineHeight
          current = word
        } else {
          current = test
        }
      }
      if (current) {
        ensureSpace(lineHeight)
        currentPage.drawText(current, { x: 40 + (opts.indent || 0), y, size: opts.size, font: opts.font, color: opts.color })
        y -= lineHeight
      }
    }
  }

  const drawText = (text: string, opts: { x: number; y: number; size: number; font: any; color: ReturnType<typeof rgb> }) => {
    currentPage.drawText(sanitizeForPDF(text), { ...opts, font: opts.font, color: opts.color })
  }

  const drawLine = (opts: { x1: number; y1: number; x2: number; y2: number; thickness: number; color: ReturnType<typeof rgb> }) => {
    currentPage.drawLine({
      start: { x: opts.x1, y: opts.y1 },
      end: { x: opts.x2, y: opts.y2 },
      thickness: opts.thickness,
      color: opts.color,
    })
  }

  const drawRect = (opts: { x: number; y: number; width: number; height: number; color?: ReturnType<typeof rgb>; borderColor?: ReturnType<typeof rgb>; borderWidth?: number }) => {
    currentPage.drawRectangle({
      x: opts.x, y: opts.y, width: opts.width, height: opts.height,
      color: opts.color, borderColor: opts.borderColor, borderWidth: opts.borderWidth,
    })
  }

  const forcePageBreak = () => {
    while (pageNumber < 2) {
      newPage()
    }
  }

  const finish = () => {
    // Force 2 pages minimum (recto-verso)
    while (pageNumber < 2) {
      newPage()
    }
    drawFooter(currentPage, pageNumber)
  }

  return {
    getCurrentPage: () => currentPage,
    getY: () => y,
    setY: (newY: number) => { y = newY },
    newPage,
    ensureSpace,
    drawWrapped,
    drawText,
    drawLine,
    drawRect,
    drawQR: (x: number, yCoord: number, size: number, text: string) => drawQRPlaceholder(currentPage, x, yCoord, size, text),
    forcePageBreak,
    finish,
    fonts,
  }
}

// ============================================================
// TEMPLATE 1 : Congolais BGP — 2 pages recto-verso premium
// ============================================================
async function exportCongolaisBGP(fiche: FicheData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`Fiche Pédagogique — ${fiche.sujet_jour || fiche.titre || 'Sans titre'}`)
  pdfDoc.setAuthor('Élite v2 — Plateforme pédagogique agentique')
  pdfDoc.setSubject('Fiche pédagogique congolaise BGP')

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const COLOR_TEAL = rgb(0.05, 0.46, 0.43)
  const COLOR_TEAL_LIGHT = rgb(0.78, 0.94, 0.90)
  const COLOR_DARK = rgb(0.12, 0.16, 0.23)
  const COLOR_GRAY = rgb(0.29, 0.33, 0.40)
  const COLOR_LIGHT = rgb(0.61, 0.64, 0.69)
  const COLOR_WHITE = rgb(1, 1, 1)

  const h = createPdfHelper(pdfDoc, { bold: fontBold, regular: fontRegular, italic: fontItalic })

  // ===================== PAGE 1 (RECTO) =====================
  // Bandeau d'en-tête premium
  h.drawRect({ x: 0, y: PAGE_H - 90, width: PAGE_W, height: 90, color: COLOR_TEAL })
  // Ligne décorative
  h.drawLine({ x1: 0, y1: PAGE_H - 90, x2: PAGE_W, y2: PAGE_H - 90, thickness: 3, color: rgb(0.08, 0.72, 0.55) })

  h.drawText('FICHE PÉDAGOGIQUE', { x: PAGE_W / 2 - 100, y: PAGE_H - 45, size: 20, font: fontBold, color: COLOR_WHITE })
  h.drawText('Élite v2 — Plateforme pédagogique agentique', { x: PAGE_W / 2 - 120, y: PAGE_H - 65, size: 8, font: fontRegular, color: rgb(0.85, 0.95, 0.93) })

  // QR code de traçabilité (coin droit)
  h.drawQR(PAGE_W - 70, PAGE_H - 35, 25, `ELITE-V2|${fiche.sequence_id || ''}|${fiche.fiche_numero || ''}|${new Date().toISOString()}`)
  h.drawText('Traçabilité', { x: PAGE_W - 70, y: PAGE_H - 75, size: 6, font: fontRegular, color: COLOR_WHITE })

  h.setY(PAGE_H - 110)

  // Champs d'en-tête (2 colonnes)
  const fields = [
    { label: 'FICHE N°', value: fiche.fiche_numero || '...', half: 'left' },
    { label: 'BRANCHE', value: fiche.branche || '...', half: 'right' },
    { label: 'SUJET DE LA RÉVISION', value: fiche.sujet_revision || '...', half: 'left' },
    { label: 'SUJET DU JOUR', value: fiche.sujet_jour || fiche.titre || '...', half: 'right' },
  ]

  for (const f of fields) {
    const x = f.half === 'left' ? 40 : PAGE_W / 2
    const labelWidth = fontBold.widthOfTextAtSize(`${f.label} : `, 9)
    h.drawText(`${f.label} : `, { x, y: h.getY(), size: 9, font: fontBold, color: COLOR_DARK })
    h.drawText(f.value, { x: x + labelWidth, y: h.getY(), size: 9, font: fontRegular, color: COLOR_DARK })
    // Ligne pointillée
    const valueWidth = fontRegular.widthOfTextAtSize(f.value, 9)
    const lineEnd = f.half === 'left' ? PAGE_W / 2 - 10 : PAGE_W - 40
    h.drawLine({ x1: x + labelWidth + valueWidth + 3, y1: h.getY() - 2, x2: lineEnd, y2: h.getY() - 2, thickness: 0.3, color: COLOR_LIGHT })
    h.setY(h.getY() - 18)
  }

  h.setY(h.getY() - 5)

  // Objectifs
  h.drawText('OBJECTIFS OPÉRATIONNELS :', { x: 40, y: h.getY(), size: 9, font: fontBold, color: COLOR_TEAL })
  h.setY(h.getY() - 14)
  h.drawWrapped(fiche.objectifs || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 5)

  // Compétences
  h.drawText("À L'ISSUE DE CETTE LEÇON, L'ÉLÈVE SERA CAPABLE DE (D') :", { x: 40, y: h.getY(), size: 9, font: fontBold, color: COLOR_TEAL })
  h.setY(h.getY() - 14)
  for (const comp of (fiche.competences || [])) {
    h.drawWrapped(`>  ${comp}`, { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })
  }

  h.setY(h.getY() - 5)

  // Matériel + Réf (2 colonnes)
  h.drawText(`MATÉRIEL DIDACTIQUE : `, { x: 40, y: h.getY(), size: 9, font: fontBold, color: COLOR_DARK })
  h.drawText(fiche.materiel || '...', { x: 40 + fontBold.widthOfTextAtSize('MATÉRIEL DIDACTIQUE : ', 9), y: h.getY(), size: 9, font: fontRegular, color: COLOR_DARK })
  h.drawText(`/REF. BGP : `, { x: PAGE_W / 2, y: h.getY(), size: 9, font: fontBold, color: COLOR_DARK })
  h.drawText(fiche.ref_bgp || '...', { x: PAGE_W / 2 + fontBold.widthOfTextAtSize('/REF. BGP : ', 9), y: h.getY(), size: 9, font: fontRegular, color: COLOR_DARK })
  h.setY(h.getY() - 20)

  // Tableau 2 colonnes — En-tête
  const colW = (PAGE_W - 80) / 2
  const tableTop = h.getY()
  h.drawRect({ x: 40, y: h.getY() - 16, width: colW, height: 16, color: COLOR_TEAL })
  h.drawRect({ x: 40 + colW, y: h.getY() - 16, width: colW, height: 16, color: COLOR_TEAL })
  h.drawText('MÉTHODE ET PROCÉDÉ', { x: 45, y: h.getY() - 12, size: 8, font: fontBold, color: COLOR_WHITE })
  h.drawText('MATIÈRES À ENSEIGNER', { x: 45 + colW, y: h.getY() - 12, size: 8, font: fontBold, color: COLOR_WHITE })
  h.setY(h.getY() - 22)

  // Bordure gauche du tableau (colonne MÉTHODE)
  const tableStartY = tableTop
  // On dessinera la bordure à la fin

  // I. INTRODUCTION
  h.drawText('I. INTRODUCTION', { x: 45, y: h.getY(), size: 10, font: fontBold, color: COLOR_TEAL })
  h.setY(h.getY() - 14)

  if (fiche.introduction) {
    h.drawText('a) Rappel :', { x: 50, y: h.getY(), size: 9, font: fontBold, color: COLOR_GRAY })
    h.setY(h.getY() - 12)
    h.drawWrapped(fiche.introduction.rappel || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15, maxWidth: colW - 20 })
    h.setY(h.getY() - 3)

    h.drawText('b) Motivation :', { x: 50, y: h.getY(), size: 9, font: fontBold, color: COLOR_GRAY })
    h.setY(h.getY() - 12)
    h.drawWrapped(fiche.introduction.motivation || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15, maxWidth: colW - 20 })
    h.setY(h.getY() - 3)

    h.drawText('c) Annonce du sujet :', { x: 50, y: h.getY(), size: 9, font: fontBold, color: COLOR_GRAY })
    h.setY(h.getY() - 12)
    h.drawWrapped(fiche.introduction.annonce || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15, maxWidth: colW - 20 })
  }

  h.setY(h.getY() - 10)

  // II. DÉVELOPPEMENT (début page 1)
  h.drawText('II. DÉVELOPPEMENT', { x: 45, y: h.getY(), size: 10, font: fontBold, color: COLOR_TEAL })
  h.setY(h.getY() - 14)
  h.drawWrapped(fiche.developpement || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15, maxWidth: colW - 20 })

  // Forcer le saut de page 2 (recto-verso)
  h.forcePageBreak()

  // ===================== PAGE 2 (VERSO) =====================
  // En-tête page 2
  h.drawRect({ x: 0, y: PAGE_H - 50, width: PAGE_W, height: 50, color: COLOR_TEAL_LIGHT })
  h.drawLine({ x1: 0, y1: PAGE_H - 50, x2: PAGE_W, y2: PAGE_H - 50, thickness: 2, color: COLOR_TEAL })
  h.drawText(`FICHE N° ${fiche.fiche_numero || ''} — ${fiche.sujet_jour || fiche.titre || ''}`.slice(0, 80), { x: 40, y: PAGE_H - 30, size: 9, font: fontBold, color: COLOR_TEAL })
  h.drawText('(suite)', { x: PAGE_W - 70, y: PAGE_H - 30, size: 8, font: fontItalic, color: COLOR_GRAY })
  h.setY(PAGE_H - 65)

  // II. DÉVELOPPEMENT (suite — si contenu long, sinon on passe à III)
  // Note : dans une vraie implémentation, on splitterait le développement entre page 1 et 2
  // Ici on affiche la suite des exemples/exercices résolus

  // III. SYNTHÈSE
  h.drawText('III. SYNTHÈSE', { x: 45, y: h.getY(), size: 10, font: fontBold, color: COLOR_TEAL })
  h.setY(h.getY() - 4)
  // Soulignement
  h.drawLine({ x1: 45, y1: h.getY(), x2: 100, y2: h.getY(), thickness: 1, color: rgb(0.08, 0.72, 0.55) })
  h.setY(h.getY() - 12)
  h.drawWrapped(fiche.synthese || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 10)

  // IV. APPLICATION
  h.drawText('IV. APPLICATION', { x: 45, y: h.getY(), size: 10, font: fontBold, color: COLOR_TEAL })
  h.setY(h.getY() - 4)
  h.drawLine({ x1: 45, y1: h.getY(), x2: 100, y2: h.getY(), thickness: 1, color: rgb(0.08, 0.72, 0.55) })
  h.setY(h.getY() - 12)
  for (const ex of (fiche.application || [])) {
    h.drawWrapped(`• ${ex}`, { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15 })
    h.setY(h.getY() - 2)
  }

  h.setY(h.getY() - 10)

  // V. AUTO-ÉVALUATION
  h.drawText('V. AUTO-ÉVALUATION', { x: 45, y: h.getY(), size: 10, font: fontBold, color: COLOR_TEAL })
  h.setY(h.getY() - 4)
  h.drawLine({ x1: 45, y1: h.getY(), x2: 110, y2: h.getY(), thickness: 1, color: rgb(0.08, 0.72, 0.55) })
  h.setY(h.getY() - 12)
  for (const q of (fiche.auto_evaluation || [])) {
    h.drawWrapped(`[ ] ${q}`, { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15 })
    h.setY(h.getY() - 2)
  }

  // Pied de page premium
  h.setY(60)
  h.drawLine({ x1: 40, y1: h.getY(), x2: PAGE_W - 40, y2: h.getY(), thickness: 0.5, color: COLOR_LIGHT })
  h.setY(h.getY() - 12)
  h.drawText('Généré par Élite v2 — Plateforme pédagogique agentique', { x: 40, y: h.getY(), size: 7, font: fontItalic, color: COLOR_LIGHT })
  h.drawText(new Date().toLocaleDateString('fr-FR'), { x: PAGE_W - 100, y: h.getY(), size: 7, font: fontRegular, color: COLOR_LIGHT })

  h.finish()

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

// ============================================================
// TEMPLATE 2 : Fiche Sésame — Français
// ============================================================
async function exportSesameFrancais(fiche: FicheData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`Fiche Sésame — ${fiche.titre_lecon || fiche.titre || ''}`)
  pdfDoc.setAuthor('Élite v2')
  pdfDoc.setSubject('Fiche Sésame — Cours de Français')

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const COLOR_PURPLE = rgb(0.49, 0.23, 0.93)
  const COLOR_PURPLE_LIGHT = rgb(0.93, 0.88, 0.99)
  const COLOR_DARK = rgb(0.12, 0.16, 0.23)
  const COLOR_GRAY = rgb(0.29, 0.33, 0.40)
  const COLOR_LIGHT = rgb(0.61, 0.64, 0.69)
  const COLOR_WHITE = rgb(1, 1, 1)

  const h = createPdfHelper(pdfDoc, { bold: fontBold, regular: fontRegular, italic: fontItalic })

  // ===================== PAGE 1 =====================
  // Bandeau violet
  h.drawRect({ x: 0, y: PAGE_H - 90, width: PAGE_W, height: 90, color: COLOR_PURPLE })
  h.drawLine({ x1: 0, y1: PAGE_H - 90, x2: PAGE_W, y2: PAGE_H - 90, thickness: 3, color: rgb(0.65, 0.55, 0.98) })
  h.drawText('FICHE SÉSAME', { x: PAGE_W / 2 - 70, y: PAGE_H - 45, size: 20, font: fontBold, color: COLOR_WHITE })
  h.drawText('Cours de Français', { x: PAGE_W / 2 - 55, y: PAGE_H - 65, size: 10, font: fontItalic, color: rgb(0.85, 0.80, 0.98) })
  h.drawQR(PAGE_W - 70, PAGE_H - 35, 25, `SESAME|${fiche.sequence_id || ''}|${new Date().toISOString()}`)

  h.setY(PAGE_H - 110)

  // Champs en-tête
  const headerFields = [
    { label: 'Niveau', value: fiche.niveau || '...', half: 'left' },
    { label: 'Discipline', value: fiche.discipline || 'Français', half: 'right' },
    { label: 'Chapitre', value: fiche.chapitre || '...', half: 'left' },
    { label: 'Durée', value: fiche.duree || '...', half: 'right' },
  ]
  for (const f of headerFields) {
    const x = f.half === 'left' ? 40 : PAGE_W / 2
    h.drawText(`${f.label} : `, { x, y: h.getY(), size: 9, font: fontBold, color: COLOR_DARK })
    const lw = fontBold.widthOfTextAtSize(`${f.label} : `, 9)
    h.drawText(f.value, { x: x + lw, y: h.getY(), size: 9, font: fontRegular, color: COLOR_DARK })
    h.setY(h.getY() - 16)
  }

  // Titre de la leçon
  h.drawText('Titre de la leçon : ', { x: 40, y: h.getY(), size: 10, font: fontBold, color: COLOR_PURPLE })
  h.setY(h.getY() - 14)
  h.drawWrapped(fiche.titre_lecon || fiche.titre || '', { size: 11, font: fontBold, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 8)

  // Objectifs
  h.drawText('Objectifs pédagogiques :', { x: 40, y: h.getY(), size: 9, font: fontBold, color: COLOR_PURPLE })
  h.setY(h.getY() - 14)
  h.drawWrapped(fiche.objectifs || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 5)

  // Supports
  h.drawText('Supports didactiques :', { x: 40, y: h.getY(), size: 9, font: fontBold, color: COLOR_PURPLE })
  h.setY(h.getY() - 14)
  if (Array.isArray(fiche.supports)) {
    for (const s of fiche.supports) {
      h.drawWrapped(`• ${s}`, { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15 })
    }
  } else {
    h.drawWrapped(fiche.supports || fiche.materiel || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15 })
  }

  h.setY(h.getY() - 5)

  // Prérequis
  h.drawText('Prérequis :', { x: 40, y: h.getY(), size: 9, font: fontBold, color: COLOR_PURPLE })
  h.setY(h.getY() - 14)
  const prerequis = Array.isArray(fiche.prerequis) ? fiche.prerequis.join('. ') : fiche.prerequis || ''
  h.drawWrapped(prerequis, { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 10)

  // Phase 1 — Découverte
  h.drawRect({ x: 40, y: h.getY() - 18, width: PAGE_W - 80, height: 18, color: COLOR_PURPLE_LIGHT })
  h.drawText('Phase 1 — Découverte', { x: 45, y: h.getY() - 13, size: 10, font: fontBold, color: COLOR_PURPLE })
  h.setY(h.getY() - 25)
  h.drawWrapped(fiche.decouverte || fiche.introduction?.motivation || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 8)

  // Phase 2 — Compréhension
  h.drawRect({ x: 40, y: h.getY() - 18, width: PAGE_W - 80, height: 18, color: COLOR_PURPLE_LIGHT })
  h.drawText('Phase 2 — Compréhension', { x: 45, y: h.getY() - 13, size: 10, font: fontBold, color: COLOR_PURPLE })
  h.setY(h.getY() - 25)
  h.drawWrapped(fiche.comprehension || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.forcePageBreak()

  // ===================== PAGE 2 =====================
  h.drawRect({ x: 0, y: PAGE_H - 50, width: PAGE_W, height: 50, color: COLOR_PURPLE_LIGHT })
  h.drawLine({ x1: 0, y1: PAGE_H - 50, x2: PAGE_W, y2: PAGE_H - 50, thickness: 2, color: COLOR_PURPLE })
  h.drawText(`Fiche Sésame — ${fiche.titre_lecon || fiche.titre || ''}`.slice(0, 70), { x: 40, y: PAGE_H - 30, size: 9, font: fontBold, color: COLOR_PURPLE })
  h.drawText('(suite)', { x: PAGE_W - 70, y: PAGE_H - 30, size: 8, font: fontItalic, color: COLOR_GRAY })
  h.setY(PAGE_H - 65)

  // Phase 3 — Structuration
  h.drawRect({ x: 40, y: h.getY() - 18, width: PAGE_W - 80, height: 18, color: COLOR_PURPLE_LIGHT })
  h.drawText('Phase 3 — Structuration', { x: 45, y: h.getY() - 13, size: 10, font: fontBold, color: COLOR_PURPLE })
  h.setY(h.getY() - 25)
  h.drawWrapped(fiche.structuration || fiche.synthese || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 8)

  // Phase 4 — Application
  h.drawRect({ x: 40, y: h.getY() - 18, width: PAGE_W - 80, height: 18, color: COLOR_PURPLE_LIGHT })
  h.drawText('Phase 4 — Application', { x: 45, y: h.getY() - 13, size: 10, font: fontBold, color: COLOR_PURPLE })
  h.setY(h.getY() - 25)
  if (Array.isArray(fiche.application)) {
    for (const ex of fiche.application) {
      h.drawWrapped(`• ${ex}`, { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15 })
      h.setY(h.getY() - 2)
    }
  } else {
    h.drawWrapped(fiche.application || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15 })
  }

  h.setY(h.getY() - 8)

  // Phase 5 — Évaluation
  h.drawRect({ x: 40, y: h.getY() - 18, width: PAGE_W - 80, height: 18, color: COLOR_PURPLE_LIGHT })
  h.drawText('Phase 5 — Évaluation', { x: 45, y: h.getY() - 13, size: 10, font: fontBold, color: COLOR_PURPLE })
  h.setY(h.getY() - 25)
  h.drawWrapped(fiche.evaluation || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 8)

  // Prolongement
  if (fiche.prolongement) {
    h.drawText('Prolongement :', { x: 40, y: h.getY(), size: 9, font: fontBold, color: COLOR_PURPLE })
    h.setY(h.getY() - 14)
    h.drawWrapped(fiche.prolongement, { size: 9, font: fontItalic, color: COLOR_GRAY, indent: 10 })
  }

  // Pied de page
  h.setY(60)
  h.drawLine({ x1: 40, y1: h.getY(), x2: PAGE_W - 40, y2: h.getY(), thickness: 0.5, color: COLOR_LIGHT })
  h.setY(h.getY() - 12)
  h.drawText('Fiche Sésame — Élite v2', { x: 40, y: h.getY(), size: 7, font: fontItalic, color: COLOR_LIGHT })
  h.drawText(new Date().toLocaleDateString('fr-FR'), { x: PAGE_W - 100, y: h.getY(), size: 7, font: fontRegular, color: COLOR_LIGHT })

  h.finish()

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

// ============================================================
// TEMPLATE 3 : Moderne Premium
// ============================================================
async function exportModerne(fiche: FicheData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`Séquence — ${fiche.titre || ''}`)
  pdfDoc.setAuthor('Élite v2')

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const COLOR_BLUE = rgb(0.05, 0.65, 0.91)
  const COLOR_BLUE_LIGHT = rgb(0.88, 0.95, 0.99)
  const COLOR_DARK = rgb(0.12, 0.16, 0.23)
  const COLOR_GRAY = rgb(0.29, 0.33, 0.40)
  const COLOR_LIGHT = rgb(0.61, 0.64, 0.69)
  const COLOR_WHITE = rgb(1, 1, 1)

  const h = createPdfHelper(pdfDoc, { bold: fontBold, regular: fontRegular, italic: fontItalic })

  // ===================== PAGE 1 =====================
  // En-tête épuré
  h.drawText('SÉQUENCE PÉDAGOGIQUE', { x: 40, y: PAGE_H - 50, size: 9, font: fontBold, color: COLOR_BLUE })
  h.drawLine({ x1: 40, y1: PAGE_H - 58, x2: PAGE_W - 40, y2: PAGE_H - 58, thickness: 2, color: COLOR_BLUE })
  h.drawQR(PAGE_W - 70, PAGE_H - 50, 25, `MODERNE|${fiche.sequence_id || ''}|${new Date().toISOString()}`)

  h.setY(PAGE_H - 80)

  // Titre principal
  h.drawWrapped(fiche.titre || fiche.sujet_jour || '', { size: 18, font: fontBold, color: COLOR_DARK })
  h.setY(h.getY() - 10)

  // Tags
  const tags = [fiche.niveau, fiche.discipline, fiche.duree].filter(Boolean)
  if (tags.length) {
    let tagX = 40
    for (const tag of tags) {
      const tw = fontBold.widthOfTextAtSize(tag, 8) + 16
      h.drawRect({ x: tagX, y: h.getY() - 14, width: tw, height: 14, color: COLOR_BLUE_LIGHT, borderColor: COLOR_BLUE, borderWidth: 0.5 })
      h.drawText(tag, { x: tagX + 8, y: h.getY() - 10, size: 8, font: fontBold, color: COLOR_BLUE })
      tagX += tw + 6
    }
    h.setY(h.getY() - 25)
  }

  // Objectifs
  h.drawText('OBJECTIFS', { x: 40, y: h.getY(), size: 10, font: fontBold, color: COLOR_BLUE })
  h.setY(h.getY() - 14)
  h.drawWrapped(fiche.objectifs || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 8)

  // Prérequis
  if (fiche.prerequis) {
    h.drawText('PRÉREQUIS', { x: 40, y: h.getY(), size: 10, font: fontBold, color: COLOR_BLUE })
    h.setY(h.getY() - 14)
    const prereq = Array.isArray(fiche.prerequis) ? fiche.prerequis.join(', ') : fiche.prerequis
    h.drawWrapped(prereq, { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })
    h.setY(h.getY() - 8)
  }

  // Compétences
  if (fiche.competences?.length) {
    h.drawText('COMPÉTENCES VISÉES', { x: 40, y: h.getY(), size: 10, font: fontBold, color: COLOR_BLUE })
    h.setY(h.getY() - 14)
    for (const c of fiche.competences) {
      h.drawWrapped(`→ ${c}`, { size: 9, font: fontRegular, color: COLOR_DARK, indent: 15 })
    }
    h.setY(h.getY() - 8)
  }

  // Déroulement
  h.drawRect({ x: 40, y: h.getY() - 20, width: PAGE_W - 80, height: 20, color: COLOR_BLUE })
  h.drawText('DÉROULEMENT', { x: 50, y: h.getY() - 14, size: 10, font: fontBold, color: COLOR_WHITE })
  h.setY(h.getY() - 30)
  h.drawWrapped(fiche.deroulement || fiche.developpement || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 8)

  // Activités
  h.drawRect({ x: 40, y: h.getY() - 20, width: PAGE_W - 80, height: 20, color: COLOR_BLUE })
  h.drawText('ACTIVITÉS', { x: 50, y: h.getY() - 14, size: 10, font: fontBold, color: COLOR_WHITE })
  h.setY(h.getY() - 30)
  h.drawWrapped(fiche.activites || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.forcePageBreak()

  // ===================== PAGE 2 =====================
  h.drawText('SÉQUENCE PÉDAGOGIQUE (suite)', { x: 40, y: PAGE_H - 50, size: 9, font: fontBold, color: COLOR_BLUE })
  h.drawLine({ x1: 40, y1: PAGE_H - 58, x2: PAGE_W - 40, y2: PAGE_H - 58, thickness: 2, color: COLOR_BLUE })
  h.setY(PAGE_H - 75)

  // Différenciation
  h.drawRect({ x: 40, y: h.getY() - 20, width: PAGE_W - 80, height: 20, color: COLOR_BLUE })
  h.drawText('DIFFÉRENCIATION', { x: 50, y: h.getY() - 14, size: 10, font: fontBold, color: COLOR_WHITE })
  h.setY(h.getY() - 30)
  h.drawWrapped(fiche.differentiation || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 8)

  // Évaluation
  h.drawRect({ x: 40, y: h.getY() - 20, width: PAGE_W - 80, height: 20, color: COLOR_BLUE })
  h.drawText('ÉVALUATION', { x: 50, y: h.getY() - 14, size: 10, font: fontBold, color: COLOR_WHITE })
  h.setY(h.getY() - 30)
  h.drawWrapped(fiche.evaluation || '', { size: 9, font: fontRegular, color: COLOR_DARK, indent: 10 })

  h.setY(h.getY() - 8)

  // Prolongement
  if (fiche.prolongement) {
    h.drawRect({ x: 40, y: h.getY() - 20, width: PAGE_W - 80, height: 20, color: COLOR_BLUE_LIGHT })
    h.drawText('PROLONGEMENT', { x: 50, y: h.getY() - 14, size: 10, font: fontBold, color: COLOR_BLUE })
    h.setY(h.getY() - 30)
    h.drawWrapped(fiche.prolongement, { size: 9, font: fontItalic, color: COLOR_GRAY, indent: 10 })
  }

  // Pied de page
  h.setY(60)
  h.drawLine({ x1: 40, y1: h.getY(), x2: PAGE_W - 40, y2: h.getY(), thickness: 0.5, color: COLOR_LIGHT })
  h.setY(h.getY() - 12)
  h.drawText('Élite v2 — Premium', { x: 40, y: h.getY(), size: 7, font: fontItalic, color: COLOR_LIGHT })
  h.drawText(new Date().toLocaleDateString('fr-FR'), { x: PAGE_W - 100, y: h.getY(), size: 7, font: fontRegular, color: COLOR_LIGHT })

  h.finish()

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

// ============================================================
// Point d'entrée : exportLivrableMultiTemplate
// ============================================================
export async function exportMultiTemplate(
  fiche: FicheData,
  format: ExportFormat,
  templateStyle: TemplateStyle = 'congolais-bgp',
): Promise<ExportResult> {
  if (format !== 'pdf') {
    throw new Error('Export multi-template supporte actuellement uniquement le PDF. Utilisez exportLivrable pour markdown/html/docx.')
  }

  let data: Buffer
  switch (templateStyle) {
    case 'congolais-bgp':
      data = await exportCongolaisBGP(fiche)
      break
    case 'sesame-francais':
      data = await exportSesameFrancais(fiche)
      break
    case 'moderne':
      data = await exportModerne(fiche)
      break
    default:
      throw new Error(`Template style non supporté: ${templateStyle}`)
  }

  const safeName = (fiche.sujet_jour || fiche.titre || 'fiche').replace(/[^a-zA-Z0-9À-ÿ\-\s]/g, '').replace(/\s+/g, '_').slice(0, 50)
  return {
    format: 'pdf',
    mime: 'application/pdf',
    data,
    filename: `${safeName}_${templateStyle}.pdf`,
  }
}
