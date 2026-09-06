// Quality Gate pédagogique — P4-6 (Sprint 4) + R-31 (F-31)
// Calcule un score pédagogique automatique pour chaque fiche.
// Bloque la publication si score < 80.
//
// F-31 (audit 360°, EXP C2) — AVANT : le score était 100% structurel (compteurs
// de mots) → incitation inversée : une fiche concise excellente était bloquée
// (65) tandis qu'une fiche verbeuse et creuse passait (85-100), et une fiche
// mathématiquement fausse obtenait 100/100.
//
// R-31 : trois critères de SUBSTANCE déterministes s'ajoutent aux compteurs :
//   1. evaluationCriteria   — l'évaluation contient des critères de réussite
//      explicites (mot-clé "critère/réussite/barème", questions numérotées)
//   2. objectivesAssessed   — l'évaluation recouvre lexicographiquement les
//      objectifs (mots de contenu partagés) : on évalue ce qu'on annonce
//   3. noFiller             — aucune phrase longue répétée (remplissage /
//      verbeux-creux détecté par n-grammes de phrases normalisées)
// Chaque critère manquant applique une pénalité au score (le plancher reste 0).
// La dimension exactitude factuelle (calculs) est assurée par la Critique LLM
// (couche 2, dimension exactitude_contenu) et verrouillée au commit (F-31c).

import { FICHE_TEMPLATE_V1_SECTIONS, type SectionContent, type GenerationContext, type FicheSectionId } from '@/lib/contracts'

export interface PedagogicalScore {
  score: number // 0-100
  criteria: {
    objectives: boolean // section objectifs présente et > 40 mots
    progression: boolean // section déroulement présente et > 120 mots, avec étapes numérotées
    activities: boolean // section activités présente et > 80 mots
    assessment: boolean // section évaluation présente et > 40 mots
    differentiation: boolean // section différenciation présente et > 40 mots
    // R-31 (F-31) — critères de substance
    evaluationCriteria: boolean // évaluation avec critères de réussite explicites
    objectivesAssessed: boolean // l'évaluation recouvre les objectifs annoncés
    noFiller: boolean // pas de remplissage (phrases répétées)
  }
  details: string[]
}

const FILLER_PENALTY = 15
const EVAL_CRITERIA_PENALTY = 12
const OBJ_ASSESSED_PENALTY = 10

// ============================================================
// Helpers de normalisation — R-31
// ============================================================
function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Stopwords français (déjà normalisés sans accents) — filtrés pour l'analyse lexicale
const STOPWORDS = new Set([
  'pour', 'avec', 'dans', 'cette', 'leurs', 'elles', 'nous', 'vous', 'mais',
  'donc', 'puis', 'afin', 'ainsi', 'tout', 'tous', 'toute', 'toutes', 'etre',
  'avoir', 'faire', 'comme', 'aussi', 'leur', 'dont', 'chez', 'sous', 'entre',
  'vers', 'quel', 'quelle', 'apres', 'avant', 'lors', 'sera', 'seront', 'peut',
  'peuvent', 'doit', 'doivent', 'sont', 'ete', 'cela', 'celle', 'celui', 'chaque',
  'sans', 'plus', 'moins', 'tres', 'leur', 'etc',
])

function contentWords(s: string): Set<string> {
  const words = normalizeText(s)
    .split(/[\s'-]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
  return new Set(words)
}

// Détection de remplissage : phrases longues (>= 8 mots) répétées à l'identique.
// ⚠️ On découpe le texte BRUT (les délimiteurs de phrases y sont encore),
// PUIS on normalise chaque phrase — normaliser avant le split effacerait '.'
// et fusionnerait tout le texte en un seul bloc (plus aucune répétition détectée).
function findRepeatedSentences(s: string): string[] {
  const raw = (s || '').slice(0, 5000)
  if (!raw) return []
  const chunks = raw
    .split(/[.!?\n;]+/)
    .map((c) => normalizeText(c))
    .filter((c) => c.split(/\s+/).filter(Boolean).length >= 8)
  const counts = new Map<string, number>()
  for (const c of chunks) counts.set(c, (counts.get(c) || 0) + 1)
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([c]) => c)
}

// L'évaluation contient-elle des critères de réussite explicites ?
function hasExplicitCriteria(evaluation: string): boolean {
  const t = normalizeText(evaluation)
  if (/critere|reussite|bareme|grille d/.test(t)) return true
  // ≥ 3 questions/énoncés numérotés = critères explicites
  const numbered = (evaluation.match(/^\s*\d+\s*[.):]/gm) || []).length
  if (numbered >= 3) return true
  return false
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
    // R-31 (F-31) — substance
    evaluationCriteria: hasExplicitCriteria(sectionsById.get('evaluation')?.contenu || ''),
    objectivesAssessed: (() => {
      const obj = contentWords(sectionsById.get('objectifs')?.contenu || '')
      const ev = contentWords(sectionsById.get('evaluation')?.contenu || '')
      if (obj.size === 0 || ev.size === 0) return true // rien à comparer — pas de pénalité ici
      let shared = 0
      for (const w of obj) if (ev.has(w)) shared++
      return shared >= 2
    })(),
    noFiller: (() => {
      for (const sid of FICHE_TEMPLATE_V1_SECTIONS) {
        const s = sectionsById.get(sid)
        if (s && findRepeatedSentences(s.contenu).length > 0) return false
      }
      return true
    })(),
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

  // R-31 (F-31) — pénalités de substance
  if (!criteria.noFiller) {
    const sectionsWithFiller = FICHE_TEMPLATE_V1_SECTIONS.filter((sid) => {
      const s = sectionsById.get(sid)
      return s && findRepeatedSentences(s.contenu).length > 0
    })
    score = Math.max(0, score - FILLER_PENALTY)
    details.push(
      `❌ Remplissage : phrase(s) répétée(s) à l'identique dans ${sectionsWithFiller.join(', ')} (-${FILLER_PENALTY})`,
    )
  }
  if (!criteria.evaluationCriteria) {
    score = Math.max(0, score - EVAL_CRITERIA_PENALTY)
    details.push(
      `❌ Évaluation sans critères de réussite explicites (mot "critère/réussite" ou questions numérotées) (-${EVAL_CRITERIA_PENALTY})`,
    )
  }
  if (!criteria.objectivesAssessed) {
    score = Math.max(0, score - OBJ_ASSESSED_PENALTY)
    details.push(
      `❌ L'évaluation ne recouvre pas les objectifs annoncés (recouvrement lexical insuffisant) (-${OBJ_ASSESSED_PENALTY})`,
    )
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
