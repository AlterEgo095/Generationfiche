// Tests unitaires — Render + Export (P0-3, P0-4)
// Vérifie : renderFiche produit un RenderedDocument valide, exports markdown/html/docx/pdf.

import { describe, it, expect } from 'vitest'
import { renderFiche } from '@/lib/pipeline/superviseur'
import { markdownExport, htmlExport, docxExport, pdfExport, exportLivrable } from '@/lib/export'
import type { GenerationContext, SectionContent } from '@/lib/contracts'
import { FICHE_TEMPLATE_V1_SECTIONS, SECTION_LABELS } from '@/lib/contracts'

// ============================================================
// Helpers
// ============================================================
function makeCtx(): GenerationContext {
  return {
    sequence_id: 'seq_test',
    sequence_titre: 'Séquence de test — Pythagore 4e',
    notions: [{
      notion_id: 'notion_pyth',
      nom: 'Théorème de Pythagore',
      competences: ['Appliquer le théorème de Pythagore'],
      objectifs: ['Calculer une longueur dans un triangle rectangle'],
      prerequis_ids: [],
      niveau: '4e',
      chapitre: 'Géométrie',
    }],
    exemples_pedagogiques: [],
    references_style: [],
    regles: {},
    contexte_classe: { effectif: 28, duree_min: 50 },
    template_version: 'v1',
    curriculum_version: 'v1',
    compiled_at: '2026-01-01T00:00:00.000Z',
  }
}

function makeSections(): SectionContent[] {
  const contenus: Record<string, string> = {
    objectifs: "À l'issue de la séquence, l'élève sera capable de calculer une longueur dans un triangle rectangle en utilisant le théorème de Pythagore. L'élève saura également vérifier si un triangle est rectangle ou non à partir des longueurs de ses côtés.",
    prerequis: "L'élève doit maîtriser : le carré d'un nombre, la racine carrée, la propriété de la somme des angles dans un triangle, la reconnaissance d'un triangle rectangle (angle droit).",
    deroulement: "1. Activation des prérequis (10 min) : rappel sur le carré et la racine carrée. 2. Activité d'introduction (15 min) : découverte du théorème via la corde à 13 nœuds. 3. Institutionnalisation (15 min) : énoncé formel du théorème. 4. Exercices d'application (10 min) : calculs directs.",
    activites: "Activité 1 : corde à 13 nœuds pour construire un triangle rectangle. Activité 2 : mesure des côtés et conjecture sur la relation BC² = AB² + AC². Activité 3 : exercices d'application gradués.",
    differentiation: "Groupes de besoin : atelier dirigé avec l'enseignant pour les élèves fragiles (calcul guidé). Tâche complexe pour les élèves avancés (problème concret avec étapes multiples).",
    evaluation: "4 questions : 1 calcul direct de l'hypoténuse, 1 calcul d'un côté de l'angle droit, 1 problème concret (échelle contre un mur), 1 démonstration (vérifier si un triangle est rectangle). Critère de réussite : 3/4 questions justes.",
    prolongement: "Lien avec le théorème de Thalès (séquence suivante). Application en topographie : mesure de distances inaccessibles.",
  }
  return FICHE_TEMPLATE_V1_SECTIONS.map((sid) => ({
    section_id: sid,
    contenu: contenus[sid],
    methode: sid === 'deroulement' ? 'Repérer le triangle rectangle, identifier l\'hypoténuse, appliquer BC² = AB² + AC², extraire la racine.' : null,
  }))
}

// ============================================================
// renderFiche
// ============================================================
describe('renderFiche', () => {
  it('produit un RenderedDocument avec toutes les sections du template v1', () => {
    const rendered = renderFiche(makeSections(), makeCtx(), { livrable_id: 'liv_1', skill_version: 'v1' })
    expect(rendered.livrable_id).toBe('liv_1')
    expect(rendered.sequence_id).toBe('seq_test')
    expect(rendered.format).toBe('markdown')
    expect(rendered.valide).toBe(true)
    expect(rendered.skill_version).toBe('v1')
  })

  it('le markdown contient le titre de la séquence', () => {
    const rendered = renderFiche(makeSections(), makeCtx(), { livrable_id: 'liv_1', skill_version: 'v1' })
    const md = rendered.contenu_final.markdown as string
    expect(md).toContain('Séquence de test — Pythagore 4e')
  })

  it('le markdown contient toutes les sections avec leurs labels', () => {
    const rendered = renderFiche(makeSections(), makeCtx(), { livrable_id: 'liv_1', skill_version: 'v1' })
    const md = rendered.contenu_final.markdown as string
    for (const sid of FICHE_TEMPLATE_V1_SECTIONS) {
      expect(md).toContain(SECTION_LABELS[sid])
    }
  })

  it('les sections sont présentes dans contenu_final.sections', () => {
    const rendered = renderFiche(makeSections(), makeCtx(), { livrable_id: 'liv_1', skill_version: 'v1' })
    const sections = rendered.contenu_final.sections as unknown[]
    expect(sections.length).toBe(FICHE_TEMPLATE_V1_SECTIONS.length)
  })

  it('les métadonnées sont présentes (notions_count, etc.)', () => {
    const rendered = renderFiche(makeSections(), makeCtx(), { livrable_id: 'liv_1', skill_version: 'v1' })
    const meta = rendered.contenu_final.meta as Record<string, unknown>
    expect(meta.notions_count).toBe(1)
    expect(meta.template_version).toBe('v1')
  })

  it('rejette sections null (P0-5)', () => {
    expect(() => renderFiche(null as unknown as SectionContent[], makeCtx(), { livrable_id: 'liv_1', skill_version: 'v1' })).toThrow(/sections.*tableau/i)
  })

  it('rejette opts.livrable_id vide (P0-5)', () => {
    expect(() => renderFiche(makeSections(), makeCtx(), { livrable_id: '', skill_version: 'v1' })).toThrow(/livrable_id.*invalide/i)
  })
})

// ============================================================
// Exports — markdown, html, docx, pdf (P0-3)
// ============================================================
describe('Exports documentaires', () => {
  const rendered = renderFiche(makeSections(), makeCtx(), { livrable_id: 'liv_1', skill_version: 'v1' })

  it('markdownExport produit une string non vide', () => {
    const md = markdownExport(rendered)
    expect(typeof md).toBe('string')
    expect(md.length).toBeGreaterThan(100)
    expect(md).toContain('Pythagore')
  })

  it('htmlExport produit du HTML valide avec DOCTYPE', () => {
    const html = htmlExport(rendered)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="fr">')
    expect(html).toContain('Pythagore')
    // Toutes les sections présentes
    for (const sid of FICHE_TEMPLATE_V1_SECTIONS) {
      expect(html).toContain(SECTION_LABELS[sid])
    }
  })

  it('htmlExport échappe les caractères spéciaux (sécurité XSS)', () => {
    const ctx = makeCtx()
    const sections: SectionContent[] = [{
      section_id: 'objectifs',
      contenu: '<script>alert("xss")</script> & <b>bold</b>',
      methode: null,
    }, ...makeSections().slice(1)]
    const r = renderFiche(sections, ctx, { livrable_id: 'liv_1', skill_version: 'v1' })
    const html = htmlExport(r)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert')
  })

  it('docxExport produit un Buffer non vide (format ZIP)', async () => {
    const buf = await docxExport(rendered)
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(1000)
    // Un DOCX est un ZIP — commence par PK\x03\x04
    expect(buf[0]).toBe(0x50) // 'P'
    expect(buf[1]).toBe(0x4b) // 'K'
  })

  it('pdfExport produit un Buffer non vide (format PDF)', async () => {
    const buf = await pdfExport(rendered)
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(1000)
    // Un PDF commence par %PDF
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF')
  })

  it('exportLivrable produit les 4 formats avec bons mime/filename', async () => {
    const formats = [
      { format: 'markdown' as const, mime: 'text/markdown', ext: '.md' },
      { format: 'html' as const, mime: 'text/html', ext: '.html' },
      { format: 'docx' as const, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: '.docx' },
      { format: 'pdf' as const, mime: 'application/pdf', ext: '.pdf' },
    ]
    for (const { format, mime, ext } of formats) {
      const result = await exportLivrable(rendered, format)
      expect(result.format).toBe(format)
      expect(result.mime).toBe(mime)
      expect(result.filename).toContain(ext)
      expect(result.data).toBeDefined()
    }
  })

  it('exportLivrable rejette un format inconnu', async () => {
    await expect(exportLivrable(rendered, 'inconnu' as never)).rejects.toThrow(/format non supporté/)
  })

  it('exportLivrable rejette un rendered null (P0-5)', async () => {
    await expect(exportLivrable(null as unknown as never, 'markdown')).rejects.toThrow(/rendered.*manquant/)
  })
})
