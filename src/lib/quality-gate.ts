// Quality Gate pédagogique — P4-6 (Sprint 4)
// Calcule un score pédagogique automatique pour chaque fiche.
// Bloque la publication si score < 80.

import { FICHE_TEMPLATE_V1_SECTIONS, type SectionContent, type GenerationContext, type FicheSectionId } from '@/lib/contracts'

export interface PedagogicalScore {
  score: number // 0-100
  criteria: {
    objectives: boolean // section objectifs présente et > 40 mots
    progression: boolean // section déroulement présente et > 120 mots, avec étapes numérotées
    activities: boolean // section activités présente et > 80 mots
    assessment: boolean // section évaluation présente et > 40 mots
    differentiation: boolean // section différenciation présente et > 40 mots
  }
  details: string[]
}

// ============================================================
// computePedagogicalScore — calcule le score d'une fiche
// ============================================================
export function computePedagogicalScore(sections: SectionContent[], ctx: GenerationContext): PedagogicalScore {
  const sectionsById = new Map<string, SectionContent>()
  for (const s of sections) sectionsById.set(s.section_id, s)

  const wordCount = (sid: string): number => {
    const s = sectionsById.get(sid)
    if (!s) return 0
    return (s.contenu || '').trim().split(/\s+/).filter(Boolean).length
  }

  const hasNumberedSteps = (sid: string): boolean => {
    const s = sectionsById.get(sid)
    if (!s) return false
    return /^\s*\d+\./m.test(s.contenu || '')
  }

  const criteria = {
    objectives: wordCount('objectifs') >= 40,
    progression: wordCount('deroulement') >= 120 && hasNumberedSteps('deroulement'),
    activities: wordCount('activites') >= 80,
    assessment: wordCount('evaluation') >= 40,
    differentiation: wordCount('differentiation') >= 40,
  }

  const details: string[] = []
  const checks: Array<[keyof typeof criteria, string, number]> = [
    ['objectives', `Objectifs: ${wordCount('objectifs')} mots (min 40)`, 20],
    ['progression', `Progression: ${wordCount('deroulement')} mots + étapes numérotées (min 120)`, 25],
    ['activities', `Activités: ${wordCount('activites')} mots (min 80)`, 20],
    ['assessment', `Évaluation: ${wordCount('evaluation')} mots (min 40)`, 20],
    ['differentiation', `Différenciation: ${wordCount('differentiation')} mots (min 40)`, 15],
  ]

  let score = 0
  for (const [key, label, points] of checks) {
    if (criteria[key]) {
      score += points
    } else {
      details.push(`❌ ${label}`)
    }
  }

  // Bonus : présence des prérequis et prolongement
  if (wordCount('prerequis') >= 20) score = Math.min(100, score + 5)
  if (wordCount('prolongement') >= 20) score = Math.min(100, score + 5)

  // Pénalité : contenu de secours détecté
  for (const sid of FICHE_TEMPLATE_V1_SECTIONS) {
    const s = sectionsById.get(sid)
    if (s && /LLM indisponible|contenu de secours/i.test(s.contenu || '')) {
      score = Math.max(0, score - 30)
      details.push(`❌ Section ${sid} contient un contenu de secours (-30)`)
    }
  }

  return { score, criteria, details }
}

// ============================================================
// isPublishable — score >= 80 requis pour publication
// ============================================================
export function isPublishable(score: PedagogicalScore): boolean {
  return score.score >= 80
}

// ============================================================
// PUBLICATION_THRESHOLD — seuil de publication
// ============================================================
export const PUBLICATION_THRESHOLD = 80
