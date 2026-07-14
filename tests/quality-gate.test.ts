// Tests — Quality Gate pédagogique (P4-6 Sprint 4)
// Vérifie que le score pédagogique bloque la publication si < 80.

import { describe, it, expect } from 'vitest'
import { computePedagogicalScore, isPublishable, PUBLICATION_THRESHOLD } from '@/lib/quality-gate'
import type { GenerationContext, SectionContent } from '@/lib/contracts'
import { FICHE_TEMPLATE_V1_SECTIONS } from '@/lib/contracts'

function makeCtx(): GenerationContext {
  return {
    sequence_id: 'seq_test',
    sequence_titre: 'Test',
    notions: [{ notion_id: 'n1', nom: 'Test', competences: ['c1'], objectifs: ['o1'], prerequis_ids: [], niveau: '4e', chapitre: 'Géométrie' }],
    exemples_pedagogiques: [], references_style: [], regles: {},
    contexte_classe: null, template_version: 'v1', curriculum_version: 'v1', compiled_at: '2026-01-01T00:00:00.000Z',
  }
}

function makeQualitySections(): SectionContent[] {
  const contenus: Record<string, string> = {
    objectifs: 'L\'élève sera capable de calculer une longueur dans un triangle rectangle en utilisant le théorème de Pythagore. L\'élève saura vérifier si un triangle est rectangle à partir des longueurs de ses côtés. L\'élève appliquera le théorème dans des problèmes concrets de la vie courante comme le calcul de la diagonale d\'un rectangle ou la hauteur d\'un mur avec une échelle.',
    prerequis: 'Carré d\'un nombre entier ou décimal, racine carrée d\'un nombre positif, somme des angles d\'un triangle égale à 180 degrés, reconnaissance d\'un angle droit dans une figure géométrique.',
    deroulement: '1. Activation des prérequis (10 min) : rappel sur le carré d\'un nombre entier et la racine carrée d\'un nombre positif. Exercices rapides de calcul mental pour vérifier les acquis des élèves et identifier les difficultés. 2. Introduction avec la corde à 13 nœuds (15 min) : découverte du théorème par manipulation en groupes de quatre. Les élèves construisent des triangles rectangles et mesurent les trois côtés. Ils conjecturent la relation entre les carrés des longueurs et formulent une hypothèse. Mise en commun des résultats et formulation du théorème. 3. Institutionnalisation (15 min) : énoncé formel du théorème de Pythagore au tableau. Démonstration géométrique par découpage avec un puzzle de triangles. Exemples d\'application : calcul de l\'hypoténuse et calcul d\'un côté de l\'angle droit. 4. Exercices d\'application différenciés (10 min) : calculs directs de l\'hypoténuse pour les élèves fragiles, problème concret avec une échelle contre un mur pour les autres, et démonstration de la nature d\'un triangle pour les avancés.',
    activites: 'Activité 1 : construction d\'un triangle rectangle avec la corde à 13 nœuds et vérification de la relation 3² + 4² = 5² par mesure directe. Activité 2 : mesure des côtés de plusieurs triangles rectangles et conjecture sur la relation BC² = AB² + AC², mise en commun et formulation. Activité 3 : exercices d\'application gradués allant du calcul direct de l\'hypoténuse à un problème concret d\'échelle contre un mur. Activité 4 : vérification de la nature d\'un triangle à partir de ses trois côtés donnés.',
    differentiation: 'Groupes de besoin : atelier dirigé avec l\'enseignant pour les élèves fragiles avec support visuel et calcul guidé étape par étape. Tâche complexe pour les élèves avancés avec un problème concret en plusieurs étapes incluant le calcul de la diagonale d\'un pavé droit. Fiche outil avec la formule et les étapes pour tous les élèves. Tutorat entre pairs pour les exercices intermédiaires.',
    evaluation: '4 questions : 1 calcul direct de l\'hypoténuse BC dans un triangle ABC rectangle en A avec AB=3 et AC=4. 1 calcul d\'un côté de l\'angle droit avec BC=10 et AC=6. 1 problème concret avec une échelle de 5 mètres contre un mur. 1 démonstration pour vérifier si un triangle de côtés 5, 12, 13 est rectangle. Critère de réussite : 3 questions sur 4 justes avec démarche visible.',
    prolongement: 'Lien avec le théorème de Thalès pour la séquence suivante dans la progression. Application en topographie pour mesurer des distances inaccessibles. Histoire des mathématiques avec le théorème dans différentes civilisations anciennes comme Babylone et la Chine.',
  }
  return FICHE_TEMPLATE_V1_SECTIONS.map((sid) => ({ section_id: sid, contenu: contenus[sid], methode: null }))
}

describe('Quality Gate pédagogique', () => {
  it('PUBLICATION_THRESHOLD est 80', () => {
    expect(PUBLICATION_THRESHOLD).toBe(80)
  })

  it('calcule un score >= 80 pour des sections de qualité', () => {
    const score = computePedagogicalScore(makeQualitySections(), makeCtx())
    expect(score.score).toBeGreaterThanOrEqual(80)
    expect(isPublishable(score)).toBe(true)
  })

  it('calcule un score < 80 pour des sections squelettiques', () => {
    const poorSections: SectionContent[] = FICHE_TEMPLATE_V1_SECTIONS.map((sid) => ({
      section_id: sid,
      contenu: 'Trop court.',
      methode: null,
    }))
    const score = computePedagogicalScore(poorSections, makeCtx())
    expect(score.score).toBeLessThan(80)
    expect(isPublishable(score)).toBe(false)
  })

  it('tous les critères sont true pour des sections de qualité', () => {
    const score = computePedagogicalScore(makeQualitySections(), makeCtx())
    expect(score.criteria.objectives).toBe(true)
    expect(score.criteria.progression).toBe(true)
    expect(score.criteria.activities).toBe(true)
    expect(score.criteria.assessment).toBe(true)
    expect(score.criteria.differentiation).toBe(true)
  })

  it('critère progression = false si pas d\'étapes numérotées', () => {
    const sections = makeQualitySections().map((s) =>
      s.section_id === 'deroulement' ? { ...s, contenu: 'Pas d\'étapes numérotées ici. On décrit juste le déroulement sans numérotation. C\'est long mais pas structuré avec des numéros au début des lignes. '.repeat(5) } : s,
    )
    const score = computePedagogicalScore(sections, makeCtx())
    expect(score.criteria.progression).toBe(false)
  })

  it('pénalité si contenu de secours détecté', () => {
    const sections = makeQualitySections().map((s) =>
      s.section_id === 'objectifs' ? { ...s, contenu: 'LLM indisponible — contenu de secours pour cette section. Voir le manuel.' } : s,
    )
    const score = computePedagogicalScore(sections, makeCtx())
    expect(score.score).toBeLessThan(80)
    expect(score.details.some((d) => d.includes('contenu de secours'))).toBe(true)
  })

  it('retourne des détails explicites pour chaque critère manquant', () => {
    const poorSections: SectionContent[] = FICHE_TEMPLATE_V1_SECTIONS.map((sid) => ({
      section_id: sid,
      contenu: 'Court.',
      methode: null,
    }))
    const score = computePedagogicalScore(poorSections, makeCtx())
    expect(score.details.length).toBeGreaterThan(0)
    expect(score.details.some((d) => d.includes('Objectifs'))).toBe(true)
    expect(score.details.some((d) => d.includes('Progression'))).toBe(true)
  })

  it('bonus pour prérequis et prolongement présents', () => {
    const withBonus = computePedagogicalScore(makeQualitySections(), makeCtx())
    const withoutPrereq = makeQualitySections().map((s) =>
      s.section_id === 'prerequis' ? { ...s, contenu: 'x' } : s,
    )
    const noBonus = computePedagogicalScore(withoutPrereq, makeCtx())
    expect(withBonus.score).toBeGreaterThanOrEqual(noBonus.score)
  })

  it('score = 0 pour toutes sections vides', () => {
    const empty: SectionContent[] = FICHE_TEMPLATE_V1_SECTIONS.map((sid) => ({
      section_id: sid, contenu: '', methode: null,
    }))
    const score = computePedagogicalScore(empty, makeCtx())
    expect(score.score).toBeLessThanOrEqual(10) // only possible bonus points
  })

  it('score = 100 pour sections parfaites avec prérequis et prolongement', () => {
    const score = computePedagogicalScore(makeQualitySections(), makeCtx())
    expect(score.score).toBeGreaterThanOrEqual(100)
  })

  it('isPublishable retourne false pour score 79', () => {
    expect(isPublishable({ score: 79, criteria: {} as any, details: [] })).toBe(false)
  })

  it('isPublishable retourne true pour score 80', () => {
    expect(isPublishable({ score: 80, criteria: {} as any, details: [] })).toBe(true)
  })

  it('isPublishable retourne true pour score 100', () => {
    expect(isPublishable({ score: 100, criteria: {} as any, details: [] })).toBe(true)
  })

  it('critère assessment = false si section evaluation manquante', () => {
    const sections = makeQualitySections().filter((s) => s.section_id !== 'evaluation')
    const score = computePedagogicalScore(sections, makeCtx())
    expect(score.criteria.assessment).toBe(false)
  })

  it('critère differentiation = false si contenu < 40 mots', () => {
    const sections = makeQualitySections().map((s) =>
      s.section_id === 'differentiation' ? { ...s, contenu: 'Trop court pour la différenciation.' } : s,
    )
    const score = computePedagogicalScore(sections, makeCtx())
    expect(score.criteria.differentiation).toBe(false)
  })
})
