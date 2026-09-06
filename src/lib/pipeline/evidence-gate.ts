// Evidence Gate — R-02 (Ferme F-02)
// ============================================================
// PROBLÈME (F-02, audit 360° + Vague 2 EXP R1/R4) :
// - Le Knowledge Compiler peut compiler 0 exemple pédagogique (corpus muet,
//   vocabulaire de requête hors corpus → 6/10 requêtes réalistes sans hit).
// - Dans ce cas le prompt du Rédacteur ordonnait "inventes-en" → le LLM
//   fabrique du contenu non adossé au curriculum (hallucination institutionnalisée).
// - Aucune trace INSUFFICIENT_EVIDENCE : la séquence partait en génération
//   comme si de rien n'était, avec un contexte vide de preuves.
//
// CORRECTIF : admission sur preuves AVANT toute génération LLM.
//   - sufficient   : ≥ 1 exemple avec score >= EVIDENCE_MIN_SCORE → génération autorisée
//   - insufficient : 0 exemple OU aucun score >= seuil → la séquence N'EST PAS
//     générée : marquée "en_attente", event INSUFFICIENT_EVIDENCE émis, review
//     humaine requise. Zéro appel LLM, zéro invention.
//
// Réversibilité : EVIDENCE_GATE=off désactive le gate (comportement antérieur
// restauré), sans suppression de code — même convention que R-12.
// ============================================================

import type { GenerationContext } from '@/lib/contracts'

export type EvidenceLevel = 'sufficient' | 'insufficient'

export interface EvidenceAssessment {
  level: EvidenceLevel
  gateEnabled: boolean
  exemplesCount: number
  maxScore: number
  strongCount: number
  minScore: number
  reasons: string[]
}

/** Seuil de "preuve exploitable" : un exemple TF-IDF sous ce score est du bruit, pas de la preuve. */
export function evidenceMinScore(): number {
  const v = parseFloat(process.env.EVIDENCE_MIN_SCORE || '0.12')
  return Number.isFinite(v) && v >= 0 ? v : 0.12
}

export function isEvidenceGateEnabled(): boolean {
  return (process.env.EVIDENCE_GATE || 'on') !== 'off'
}

// ============================================================
// evaluateEvidence — évalue la couverture de preuves d'un GenerationContext
// (fonction pure — testable sans DB, sans LLM)
// ============================================================
export function evaluateEvidence(ctx: GenerationContext): EvidenceAssessment {
  const gateEnabled = isEvidenceGateEnabled()
  const minScore = evidenceMinScore()
  const exemples = (ctx && Array.isArray(ctx.exemples_pedagogiques)) ? ctx.exemples_pedagogiques : []
  const scores = exemples.map((e) => Number(e.score) || 0)
  const maxScore = scores.length ? Math.max(...scores) : 0
  const strongCount = scores.filter((s) => s >= minScore).length

  const reasons: string[] = []
  let level: EvidenceLevel = 'sufficient'

  if (!gateEnabled) {
    return {
      level: 'sufficient',
      gateEnabled: false,
      exemplesCount: exemples.length,
      maxScore,
      strongCount,
      minScore,
      reasons: ['EVIDENCE_GATE=off — gate désactivé (mode réversible)'],
    }
  }

  if (exemples.length === 0) {
    level = 'insufficient'
    reasons.push(
      `INSUFFICIENT_EVIDENCE : 0 exemple pédagogique compilé depuis le corpus — aucune preuve à adosser`,
    )
  } else if (maxScore < minScore) {
    level = 'insufficient'
    reasons.push(
      `INSUFFICIENT_EVIDENCE : ${exemples.length} exemple(s) trouvé(s) mais score max ${maxScore.toFixed(4)} < seuil ${minScore} — retrieval sans hit exploitable (bruit, pas de preuve)`,
    )
  } else if (strongCount < 2) {
    // Suffisant mais signalé : une seule preuve forte = couverture mince
    reasons.push(
      `Couverture mince : ${strongCount} seule preuve forte (score >= ${minScore}) sur ${exemples.length} exemple(s)`,
    )
  }

  return {
    level,
    gateEnabled,
    exemplesCount: exemples.length,
    maxScore,
    strongCount,
    minScore,
    reasons,
  }
}

// ============================================================
// assertEvidenceOrFlag — verdict d'admission pour processSequence
// Retourne proceed=false si la génération doit être bloquée.
// (L'orchestrateur gère event/agent_run/statut — ce module reste pur.)
// ============================================================
export function assertEvidenceOrFlag(ctx: GenerationContext): {
  proceed: boolean
  assessment: EvidenceAssessment
} {
  const assessment = evaluateEvidence(ctx)
  return { proceed: assessment.level !== 'insufficient', assessment }
}
