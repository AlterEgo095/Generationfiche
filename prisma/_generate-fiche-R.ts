// Génération d'une fiche pédagogique au format congolais (3e secondaire)
// Sujet : L'Ensemble R des réels
// Format : modèle IMG_0453/0454 (FICHE N°, BRANCHE, I. INTRODUCTION, II. DÉVELOPPEMENT, III. SYNTHÈSE, IV. APPLICATION, V. AUTO-ÉVALUATION)

import ZAI from 'z-ai-web-dev-sdk'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'
import * as fs from 'fs'

// ============================================================
// 1. Génération du contenu via LLM (section par section)
// ============================================================
async function llmChat(zai: any, system: string, user: string): Promise<string> {
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    // @ts-expect-error - max_tokens accepté
    max_tokens: 1500,
  })
  return (completion?.choices?.[0]?.message?.content || '').trim()
}

async function generateFicheContent() {
  const zai = await ZAI.create()
  console.log('   Génération section par section...')

  // Section 1 : En-tête + Introduction
  const introPrompt = await llmChat(zai,
    'Tu es un enseignant de mathématiques en 3e secondaire (système congolais). Réponds de façon concise et précise.',
    `Pour une leçon sur "L'Ensemble R des réels" en 3e secondaire, donne :
1. SUJET DE LA RÉVISION (notions antérieures, en une phrase)
2. OBJECTIFS OPÉRATIONNELS (en une phrase)
3. 3 COMPÉTENCES (commençant par un verbe, séparées par | )
4. MATÉRIEL DIDACTIQUE (en une phrase)
5. /REF. BGP (une référence)
6. RAPPEL (révision des prérequis sur les ensembles N, Z, D, Q, en 3-4 phrases)
7. MOTIVATION (mise en situation concrète, 2-3 phrases)
8. ANNONCE DU SUJET (1 phrase)

Format : une ligne par item, préfixé par le numéro.`
  )

  // Section 2 : Développement
  const devPrompt = await llmChat(zai,
    'Tu es un enseignant de mathématiques en 3e secondaire (système congolais). Réponds de façon précise avec des exemples mathématiques.',
    `Rédige le DÉVELOPPEMENT de la leçon sur "L'Ensemble R des réels" pour la 3e secondaire.
Couvre :
- Définition de R (ensemble des réels)
- Notation et représentation sur la droite numérique
- Inclusion des ensembles (N ⊂ Z ⊂ D ⊂ Q ⊂ R)
- Rationnels vs irrationnels (exemples : √2, π)
- Intervalles de R (notations [a,b], ]a,b[, etc.)
- Propriétés des opérations dans R
- 2 exemples concrets
- 1 exercice résolu (avec étapes)

Sois précis mathématiquement. Utilise des notations mathématiques standard.`
  )

  // Section 3 : Synthèse + Application + Auto-éval
  const synthPrompt = await llmChat(zai,
    'Tu es un enseignant de mathématiques en 3e secondaire (système congolais). Réponds de façon concise.',
    `Pour la leçon sur "L'Ensemble R des réels" en 3e secondaire, donne :
1. SYNTHÈSE (résumé en 3-4 phrases des points clés)
2. 3 EXERCICES D'APPLICATION (numérotés, séparés par |)
3. 3 QUESTIONS D'AUTO-ÉVALUATION (numérotées, séparées par |)

Format : SYNTHÈSE: ... | EXERCICES: 1. ... 2. ... 3. ... | AUTO-EVAL: 1. ... 2. ... 3. ...`
  )

  // Parser les réponses en structure
  const lines = introPrompt.split('\n').map(l => l.trim()).filter(Boolean)
  const getLine = (n: number) => lines.find(l => l.startsWith(`${n}.`))?.replace(/^\d+\.\s*/, '') || ''

  const sujetRevision = getLine(1)
  const objectifs = getLine(2)
  const competencesRaw = getLine(3)
  const competences = competencesRaw.split('|').map(s => s.trim()).filter(Boolean)
  const materiel = getLine(4)
  const refBgp = getLine(5)
  const rappel = getLine(6)
  const motivation = getLine(7)
  const annonce = getLine(8)

  // Parser la synthèse
  const synthParts = synthPrompt.split('|').map(s => s.trim())
  const synthese = synthParts.find(p => p.toUpperCase().startsWith('SYNTHÈSE'))?.replace(/^SYNTHÈSE:\s*/i, '') || synthParts[0] || ''
  const appRaw = synthParts.find(p => p.toUpperCase().startsWith('EXERCICES'))?.replace(/^EXERCICES:\s*/i, '') || ''
  const application = appRaw.split(/\d+\./).map(s => s.trim()).filter(Boolean).slice(0, 3)
  const autoRaw = synthParts.find(p => p.toUpperCase().startsWith('AUTO'))?.replace(/^AUTO[^:]*:\s*/i, '') || ''
  const auto_evaluation = autoRaw.split(/\d+\./).map(s => s.trim()).filter(Boolean).slice(0, 3)

  return {
    fiche_numero: '19',
    branche: 'Mathématiques',
    sujet_revision: sujetRevision,
    sujet_jour: "L'Ensemble R des réels",
    objectifs,
    competences,
    materiel,
    ref_bgp: refBgp,
    introduction: { rappel, motivation, annonce },
    developpement: {
      contenu: devPrompt,
      exemples: [],
      exercices_resolus: [],
    },
    synthese,
    application: application.length ? application : ['Exercice 1', 'Exercice 2', 'Exercice 3'],
    auto_evaluation: auto_evaluation.length ? auto_evaluation : ['Question 1', 'Question 2', 'Question 3'],
  }
}

// ============================================================
// 2. Export PDF au format du modèle
// ============================================================
async function exportPDF(fiche: any): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`Fiche pédagogique — ${fiche.sujet_jour}`)
  pdfDoc.setAuthor('Élite v2 — Plateforme pédagogique agentique')

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const PAGE_W = 595.28
  const PAGE_H = 841.89
  const MARGIN = 40
  const CONTENT_W = PAGE_W - 2 * MARGIN
  const COLOR_TEAL = rgb(0.05, 0.46, 0.43)
  const COLOR_DARK = rgb(0.12, 0.16, 0.23)
  const COLOR_GRAY = rgb(0.29, 0.33, 0.40)
  const COLOR_LIGHT = rgb(0.61, 0.64, 0.69)

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  // Sanitize pour les caractères non supportés par WinAnsi
  const sanitize = (s: string): string => s
    .replace(/▲/g, '>').replace(/▸/g, '>').replace(/□/g, '[ ]')
    .replace(/✓/g, 'v').replace(/✗/g, 'x')
    .replace(/⊂/g, 'C').replace(/⊆/g, 'C').replace(/⊃/g, 'C')
    .replace(/∈/g, 'in').replace(/∉/g, '!in').replace(/∞/g, 'inf')
    .replace(/√/g, 'V').replace(/π/g, 'pi')
    .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=')
    .replace(/×/g, 'x').replace(/÷/g, '/')
    .replace(/→/g, '->').replace(/←/g, '<-').replace(/⇒/g, '=>')
    .replace(/²/g, '^2').replace(/³/g, '^3').replace(/…/g, '...')
    .replace(/[^\x00-\xFF]/g, '?')  // tout caractère non-Latin1 → ?

  const drawWrapped = (text: string, size: number, font: typeof fontRegular, color: ReturnType<typeof rgb>, indent = 0) => {
    // Utilise la fonction sanitize globale (gère tous les caractères non-Latin1)
    const sanitized = sanitize(text)
    const maxWidth = CONTENT_W - indent
    const lineHeight = size * 1.35
    for (const line of sanitized.split('\n')) {
      const words = line.split(/\s+/).filter(Boolean)
      if (!words.length) { y -= lineHeight * 0.5; continue }
      let current = ''
      for (const word of words) {
        const test = current ? `${current} ${word}` : word
        if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
          if (y < MARGIN + 30) { page = pdfDoc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN }
          page.drawText(sanitize(current), { x: MARGIN + indent, y, size, font, color })
          y -= lineHeight
          current = word
        } else {
          current = test
        }
      }
      if (current) {
        if (y < MARGIN + 30) { page = pdfDoc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN }
        page.drawText(sanitize(current), { x: MARGIN + indent, y, size, font, color })
        y -= lineHeight
      }
    }
  }

  // === EN-TÊTE ===
  page.drawRectangle({ x: 0, y: PAGE_H - 80, width: PAGE_W, height: 80, color: rgb(0.05, 0.46, 0.43) })
  page.drawText(sanitize('FICHE PÉDAGOGIQUE'), { x: PAGE_W / 2 - 90, y: PAGE_H - 45, size: 18, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText(sanitize('Élite v2 — Plateforme pédagogique agentique'), { x: PAGE_W / 2 - 115, y: PAGE_H - 65, size: 8, font: fontRegular, color: rgb(0.85, 0.95, 0.93) })
  y = PAGE_H - 100

  // Champs d'en-tête
  const fields = [
    [`FICHE N° : ${fiche.fiche_numero}`, `BRANCHE : ${fiche.branche}`],
    [`SUJET DE LA RÉVISION : ${fiche.sujet_revision}`, `SUJET DU JOUR : ${fiche.sujet_jour}`],
  ]
  for (const [left, right] of fields) {
    page.drawText(sanitize(left), { x: MARGIN, y, size: 9, font: fontBold, color: COLOR_DARK })
    page.drawText(sanitize(right), { x: PAGE_W / 2, y, size: 9, font: fontBold, color: COLOR_DARK })
    // Lignes pointillées
    const leftWidth = fontBold.widthOfTextAtSize(left, 9)
    const rightWidth = fontBold.widthOfTextAtSize(right, 9)
    page.drawLine({ start: { x: MARGIN + leftWidth, y: y - 2 }, end: { x: PAGE_W / 2 - 10, y: y - 2 }, thickness: 0.5, color: COLOR_LIGHT })
    page.drawLine({ start: { x: PAGE_W / 2 + rightWidth, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 }, thickness: 0.5, color: COLOR_LIGHT })
    y -= 20
  }

  // Objectifs
  page.drawText(sanitize('OBJECTIFS OPÉRATIONNELS :'), { x: MARGIN, y, size: 9, font: fontBold, color: COLOR_TEAL })
  y -= 14
  drawWrapped(fiche.objectifs, 9, fontRegular, COLOR_DARK, 10)
  y -= 5

  // Compétences
  page.drawText(sanitize("À L'ISSUE DE CETTE LEÇON, L'ÉLÈVE SERA CAPABLE DE (D') :"), { x: MARGIN, y, size: 9, font: fontBold, color: COLOR_TEAL })
  y -= 14
  for (const comp of fiche.competences) {
    drawWrapped(`>  ${comp}`, 9, fontRegular, COLOR_DARK, 10)
  }
  y -= 5

  // Matériel + Réf
  page.drawText(sanitize(`MATÉRIEL DIDACTIQUE : ${fiche.materiel}`), { x: MARGIN, y, size: 9, font: fontBold, color: COLOR_DARK })
  y -= 14
  page.drawText(sanitize(`/REF. BGP : ${fiche.ref_bgp}`), { x: MARGIN, y, size: 9, font: fontBold, color: COLOR_DARK })
  y -= 20

  // === TABLEAU 2 COLONNES ===
  // En-tête du tableau
  const colW = CONTENT_W / 2
  const tableY = y
  page.drawRectangle({ x: MARGIN, y: tableY - 16, width: colW, height: 16, color: COLOR_TEAL })
  page.drawRectangle({ x: MARGIN + colW, y: tableY - 16, width: colW, height: 16, color: COLOR_TEAL })
  page.drawText(sanitize('MÉTHODE ET PROCÉDÉ'), { x: MARGIN + 5, y: tableY - 12, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText(sanitize('MATIÈRES À ENSEIGNER'), { x: MARGIN + colW + 5, y: tableY - 12, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  y = tableY - 22

  // Ligne de séparation
  page.drawLine({ start: { x: MARGIN + colW, y: tableY }, end: { x: MARGIN + colW, y: y }, thickness: 0.5, color: COLOR_LIGHT })

  // I. INTRODUCTION
  page.drawText(sanitize('I. INTRODUCTION'), { x: MARGIN + 5, y, size: 10, font: fontBold, color: COLOR_TEAL })
  y -= 14
  drawWrapped(`a) Rappel :\n${fiche.introduction.rappel}`, 8, fontRegular, COLOR_DARK, 10)
  y -= 3
  drawWrapped(`b) Motivation :\n${fiche.introduction.motivation}`, 8, fontRegular, COLOR_DARK, 10)
  y -= 3
  drawWrapped(`c) Annonce du sujet :\n${fiche.introduction.annonce}`, 8, fontRegular, COLOR_DARK, 10)
  y -= 10

  // II. DÉVELOPPEMENT
  page.drawText(sanitize('II. DÉVELOPPEMENT'), { x: MARGIN + 5, y, size: 10, font: fontBold, color: COLOR_TEAL })
  y -= 14
  drawWrapped(fiche.developpement.contenu, 8, fontRegular, COLOR_DARK, 10)
  y -= 5
  if (fiche.developpement.exemples?.length) {
    page.drawText(sanitize('Exemples :'), { x: MARGIN + 10, y, size: 8, font: fontBold, color: COLOR_GRAY })
    y -= 12
    for (const ex of fiche.developpement.exemples) {
      drawWrapped(`• ${ex}`, 8, fontRegular, COLOR_DARK, 15)
    }
  }
  y -= 5
  if (fiche.developpement.exercices_resolus?.length) {
    page.drawText(sanitize('Exercices résolus :'), { x: MARGIN + 10, y, size: 8, font: fontBold, color: COLOR_GRAY })
    y -= 12
    for (const ex of fiche.developpement.exercices_resolus) {
      drawWrapped(`▸ ${ex}`, 8, fontRegular, COLOR_DARK, 15)
    }
  }
  y -= 10

  // III. SYNTHÈSE
  page.drawText(sanitize('III. SYNTHÈSE'), { x: MARGIN + 5, y, size: 10, font: fontBold, color: COLOR_TEAL })
  y -= 14
  drawWrapped(fiche.synthese, 8, fontRegular, COLOR_DARK, 10)
  y -= 10

  // IV. APPLICATION
  page.drawText(sanitize('IV. APPLICATION'), { x: MARGIN + 5, y, size: 10, font: fontBold, color: COLOR_TEAL })
  y -= 14
  for (const ex of fiche.application) {
    drawWrapped(`• ${ex}`, 8, fontRegular, COLOR_DARK, 10)
  }
  y -= 10

  // V. AUTO-ÉVALUATION
  page.drawText(sanitize('V. AUTO-ÉVALUATION'), { x: MARGIN + 5, y, size: 10, font: fontBold, color: COLOR_TEAL })
  y -= 14
  for (const q of fiche.auto_evaluation) {
    drawWrapped(`□ ${q}`, 8, fontRegular, COLOR_DARK, 10)
  }

  // Bordures du tableau
  const tableBottom = y - 5
  page.drawRectangle({ x: MARGIN, y: tableBottom, width: CONTENT_W, height: tableY - tableBottom, borderColor: COLOR_LIGHT, borderWidth: 1 })
  page.drawLine({ start: { x: MARGIN + colW, y: tableY }, end: { x: MARGIN + colW, y: tableBottom }, thickness: 1, color: COLOR_LIGHT })

  // Footer
  page.drawText(sanitize(`Généré par Élite v2 — ${new Date().toLocaleDateString('fr-FR')}`), { x: PAGE_W / 2 - 80, y: 20, size: 7, font: fontRegular, color: COLOR_LIGHT })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

// ============================================================
// 3. Export DOCX au format du modèle
// ============================================================
async function exportDOCX(fiche: any): Promise<Buffer> {
  const children: Paragraph[] = []

  // Titre
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'FICHE PÉDAGOGIQUE', bold: true, size: 32, color: '0F766E' })],
  }))
  children.push(new Paragraph({ text: '' }))

  // Champs d'en-tête
  const headerFields = [
    { label: 'FICHE N°', value: fiche.fiche_numero },
    { label: 'BRANCHE', value: fiche.branche },
    { label: 'SUJET DE LA RÉVISION', value: fiche.sujet_revision },
    { label: 'SUJET DU JOUR', value: fiche.sujet_jour },
    { label: 'OBJECTIFS OPÉRATIONNELS', value: fiche.objectifs },
    { label: 'MATÉRIEL DIDACTIQUE', value: fiche.materiel },
    { label: '/REF. BGP', value: fiche.ref_bgp },
  ]
  for (const f of headerFields) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${f.label} : `, bold: true, size: 20 }),
        new TextRun({ text: f.value, size: 20 }),
      ],
    }))
  }
  children.push(new Paragraph({ text: '' }))

  // Compétences
  children.push(new Paragraph({
    children: [new TextRun({ text: "À L'ISSUE DE CETTE LEÇON, L'ÉLÈVE SERA CAPABLE DE (D') :", bold: true, size: 20, color: '0F766E' })],
  }))
  for (const comp of fiche.competences) {
    children.push(new Paragraph({ children: [new TextRun({ text: `▲  ${comp}`, size: 20 })] }))
  }
  children.push(new Paragraph({ text: '' }))

  // Tableau 2 colonnes
  const sections: Array<{ titre: string; contenu: Paragraph[] }> = [
    {
      titre: 'I. INTRODUCTION',
      contenu: [
        new Paragraph({ children: [new TextRun({ text: 'a) Rappel :', bold: true, size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: fiche.introduction.rappel, size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: 'b) Motivation :', bold: true, size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: fiche.introduction.motivation, size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: 'c) Annonce du sujet :', bold: true, size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: fiche.introduction.annonce, size: 20 })] }),
      ],
    },
    {
      titre: 'II. DÉVELOPPEMENT',
      contenu: [
        new Paragraph({ children: [new TextRun({ text: fiche.developpement.contenu, size: 20 })] }),
        ...(fiche.developpement.exemples?.length ? [
          new Paragraph({ children: [new TextRun({ text: 'Exemples :', bold: true, size: 20 })] }),
          ...fiche.developpement.exemples.map((ex: string) => new Paragraph({ children: [new TextRun({ text: `• ${ex}`, size: 20 })] })),
        ] : []),
        ...(fiche.developpement.exercices_resolus?.length ? [
          new Paragraph({ children: [new TextRun({ text: 'Exercices résolus :', bold: true, size: 20 })] }),
          ...fiche.developpement.exercices_resolus.map((ex: string) => new Paragraph({ children: [new TextRun({ text: `▸ ${ex}`, size: 20 })] })),
        ] : []),
      ],
    },
    {
      titre: 'III. SYNTHÈSE',
      contenu: [new Paragraph({ children: [new TextRun({ text: fiche.synthese, size: 20 })] })],
    },
    {
      titre: 'IV. APPLICATION',
      contenu: fiche.application.map((ex: string) => new Paragraph({ children: [new TextRun({ text: `• ${ex}`, size: 20 })] })),
    },
    {
      titre: 'V. AUTO-ÉVALUATION',
      contenu: fiche.auto_evaluation.map((q: string) => new Paragraph({ children: [new TextRun({ text: `□ ${q}`, size: 20 })] })),
    },
  ]

  for (const section of sections) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: section.titre, bold: true, color: '0F766E', size: 24 })],
    }))
    children.push(...section.contenu)
    children.push(new Paragraph({ text: '' }))
  }

  const doc = new Document({
    creator: 'Élite v2',
    title: `Fiche — ${fiche.sujet_jour}`,
    sections: [{ properties: {}, children }],
  })

  return Packer.toBuffer(doc)
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🎨 Génération de la fiche : L\'Ensemble R des réels (3e secondaire)\n')

  // 1. Générer le contenu
  console.log('1. Génération du contenu via LLM...')
  const fiche = await generateFicheContent()
  console.log('   ✅ Contenu généré')
  console.log(`   - Sujet : ${fiche.sujet_jour}`)
  console.log(`   - Compétences : ${fiche.competences?.length || 0}`)
  console.log(`   - Exemples : ${fiche.developpement?.exemples?.length || 0}`)
  console.log(`   - Exercices résolus : ${fiche.developpement?.exercices_resolus?.length || 0}`)

  // Sauvegarder le JSON
  fs.writeFileSync('/home/z/my-project/download/fiche-R-reels.json', JSON.stringify(fiche, null, 2))
  console.log('   ✅ JSON sauvegardé : download/fiche-R-reels.json')

  // 2. Export PDF
  console.log('\n2. Export PDF...')
  const pdfBuffer = await exportPDF(fiche)
  fs.writeFileSync('/home/z/my-project/download/fiche-R-reels.pdf', pdfBuffer)
  console.log(`   ✅ PDF sauvegardé : download/fiche-R-reels.pdf (${pdfBuffer.length} bytes)`)

  // 3. Export DOCX
  console.log('\n3. Export DOCX...')
  const docxBuffer = await exportDOCX(fiche)
  fs.writeFileSync('/home/z/my-project/download/fiche-R-reels.docx', docxBuffer)
  console.log(`   ✅ DOCX sauvegardé : download/fiche-R-reels.docx (${docxBuffer.length} bytes)`)

  // 4. Export Markdown
  console.log('\n4. Export Markdown...')
  const md = generateMarkdown(fiche)
  fs.writeFileSync('/home/z/my-project/download/fiche-R-reels.md', md)
  console.log(`   ✅ Markdown sauvegardé : download/fiche-R-reels.md`)

  console.log('\n🎉 Fiche générée avec succès dans /home/z/my-project/download/')
  console.log('\n=== APERÇU DU CONTENU ===')
  console.log(`FICHE N° : ${fiche.fiche_numero}`)
  console.log(`BRANCHE : ${fiche.branche}`)
  console.log(`SUJET DU JOUR : ${fiche.sujet_jour}`)
  console.log(`\nOBJECTIFS : ${fiche.objectifs}`)
  console.log(`\nCOMPÉTENCES :`)
  fiche.competences?.forEach((c: string, i: number) => console.log(`  ${i + 1}. ${c}`))
  console.log(`\nI. INTRODUCTION`)
  console.log(`  a) Rappel : ${fiche.introduction.rappel}`)
  console.log(`  b) Motivation : ${fiche.introduction.motivation}`)
  console.log(`  c) Annonce : ${fiche.introduction.annonce}`)
  console.log(`\nII. DÉVELOPPEMENT (extrait) :`)
  console.log(`  ${fiche.developpement.contenu?.slice(0, 200)}...`)
  console.log(`\nIII. SYNTHÈSE : ${fiche.synthese?.slice(0, 150)}...`)
  console.log(`\nIV. APPLICATION :`)
  fiche.application?.forEach((ex: string, i: number) => console.log(`  ${i + 1}. ${ex}`))
  console.log(`\nV. AUTO-ÉVALUATION :`)
  fiche.auto_evaluation?.forEach((q: string, i: number) => console.log(`  ${i + 1}. ${q}`))
}

function generateMarkdown(fiche: any): string {
  let md = `# FICHE PÉDAGOGIQUE — ${fiche.sujet_jour}\n\n`
  md += `**FICHE N°** : ${fiche.fiche_numero}  \n`
  md += `**BRANCHE** : ${fiche.branche}  \n`
  md += `**SUJET DE LA RÉVISION** : ${fiche.sujet_revision}  \n`
  md += `**SUJET DU JOUR** : ${fiche.sujet_jour}  \n`
  md += `**MATÉRIEL DIDACTIQUE** : ${fiche.materiel}  \n`
  md += `**/REF. BGP** : ${fiche.ref_bgp}  \n\n`
  md += `**OBJECTIFS OPÉRATIONNELS** : ${fiche.objectifs}\n\n`
  md += `**À L'ISSUE DE CETTE LEÇON, L'ÉLÈVE SERA CAPABLE DE (D')** :\n`
  fiche.competences?.forEach((c: string) => { md += `- ▲ ${c}\n` })
  md += `\n---\n\n`
  md += `## I. INTRODUCTION\n\n`
  md += `**a) Rappel** : ${fiche.introduction.rappel}\n\n`
  md += `**b) Motivation** : ${fiche.introduction.motivation}\n\n`
  md += `**c) Annonce du sujet** : ${fiche.introduction.annonce}\n\n`
  md += `## II. DÉVELOPPEMENT\n\n`
  md += `${fiche.developpement.contenu}\n\n`
  if (fiche.developpement.exemples?.length) {
    md += `**Exemples** :\n`
    fiche.developpement.exemples.forEach((ex: string) => { md += `- ${ex}\n` })
    md += `\n`
  }
  if (fiche.developpement.exercices_resolus?.length) {
    md += `**Exercices résolus** :\n`
    fiche.developpement.exercices_resolus.forEach((ex: string) => { md += `- ▸ ${ex}\n` })
    md += `\n`
  }
  md += `## III. SYNTHÈSE\n\n${fiche.synthese}\n\n`
  md += `## IV. APPLICATION\n\n`
  fiche.application?.forEach((ex: string, i: number) => { md += `${i + 1}. ${ex}\n` })
  md += `\n## V. AUTO-ÉVALUATION\n\n`
  fiche.auto_evaluation?.forEach((q: string, i: number) => { md += `${i + 1}. □ ${q}\n` })
  return md
}

main().catch(e => { console.error(e); process.exit(1) })
