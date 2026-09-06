// Evidence Refresher — boucle Critique→Retrieval (R-32, ferme F-32)
// ============================================================
// PROBLÈME (F-32, audit 360° + Vague 2) : sur échec critique (structurel ou
// pédagogique), l'orchestrateur régénérait la section avec LE MÊME
// GenerationContext. Si la cause racine était un déficit de preuves
// (exemples hors-sujet, retrieval muet), la régénération à contexte identique
// ne pouvait qu'échouer à nouveau : le retry était aveugle, la boucle ouverte.
//
// CORRECTIF : sur échec critique, AVANT toute régénération :
//   1. les raisons de la critique sont converties en requête affinée
//      (section visée + raisons + notions et objectifs imposés),
//   2. le retrieval est relancé avec cette requête (k=5),
//   3. les nouveaux exemples fusionnent dans le contexte en mémoire :
//      dédupliqués par id, triés par score décroissant, cap à 8.
// Le Rédacteur régénère donc avec un contexte enrichi — boucle fermée
// Critique → Retrieval → Rédacteur. Le cache KC en DB n'est PAS altéré
// (enrichissement volatil du seul run en cours : isolé, rollbackable).
//
// Réversibilité : CRITIQUE_RETRIEVAL_LOOP=off désactive la boucle (retour au
// comportement antérieur, régénération à contexte identique), sans suppression
// de code — même convention que R-12 (LLM_GOVERNOR) et F-02 (EVIDENCE_GATE).
// ============================================================

import type { GenerationContext } from '@/lib/contracts'
import { retrieve_pedagogical_examples } from './knowledge-compiler'

export interface CritiqueSignals {
  raisons: string[]
  section: string | null
}

export interface EvidenceRefreshResult {
  ctx: GenerationContext
  added: number
  refinedQuery: string
  loopEnabled: boolean
}

export function isCritiqueRetrievalLoopEnabled(): boolean {
  return (process.env.CRITIQUE_RETRIEVAL_LOOP || 'on') !== 'off'
}

/** Cap d'exemples dans le contexte enrichi (évite l'explosion du prompt). */
export const MAX_EXEMPLES_ENRICHIS = 8

// ============================================================
// buildRefinedQuery — convertit les signaux de la critique en requête
// de retrieval affinée (fonction pure — testable sans DB ni LLM)
// ============================================================
export function buildRefinedQuery(
  signals: CritiqueSignals,
  ctx: GenerationContext,
): string {
  const parties: string[] = []

  // 1. La section en défaut porte le vocabulaire du déficit (ex. "evaluation"
  //    → la critique reproche une évaluation non alignée sur les objectifs)
  if (signals.section) parties.push(signals.section)

  // 2. Les raisons contiennent le vocabulaire incident (nettoyé des ids/marqueurs techniques)
  const raisonWords = signals.raisons
    .join(' ')
    .replace(/["'`]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
  parties.push(raisonWords.slice(0, 30).join(' '))

  // 3. Les notions imposées restent l'ancrage principal (jamais de dérive hors curriculum)
  for (const n of ctx.notions) {
    parties.push(n.nom)
    if (Array.isArray(n.objectifs)) parties.push(n.objectifs.join(' '))
  }

  return parties.filter(Boolean).join(' ').slice(0, 600)
}

// ============================================================
// mergeExemples — fusionne les exemples fraîchement récupérés dans le
// contexte : déduplication par id, tri score décroissant, cap.
// (fonction pure — testable sans DB ni LLM)
// ============================================================
export function mergeExemples(
  current: GenerationContext['exemples_pedagogiques'],
  additions: GenerationContext['exemples_pedagogiques'],
  cap: number = MAX_EXEMPLES_ENRICHIS,
): { merged: GenerationContext['exemples_pedagogiques']; added: number } {
  const seen = new Set(current.map((e) => e.id))
  const merged = [...current]
  let added = 0
  for (const e of additions) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    merged.push({ id: e.id, contenu: e.contenu, score: Number(e.score) || 0 })
    added++
  }
  merged.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
  return { merged: merged.slice(0, Math.max(1, cap)), added }
}

// ============================================================
// refreshEvidenceOnCritique — point d'entrée de la boucle.
// Env off → retourne le contexte inchangé (comportement antérieur).
// ============================================================
export async function refreshEvidenceOnCritique(p: {
  ctx: GenerationContext
  signals: CritiqueSignals
}): Promise<EvidenceRefreshResult> {
  const loopEnabled = isCritiqueRetrievalLoopEnabled()
  if (!loopEnabled) {
    return { ctx: p.ctx, added: 0, refinedQuery: '', loopEnabled: false }
  }

  const refinedQuery = buildRefinedQuery(p.signals, p.ctx)
  let additions: GenerationContext['exemples_pedagogiques'] = []
  try {
    const hits = await retrieve_pedagogical_examples(refinedQuery, 5)
    // Ne garde que les hits exploitables (au-dessus du plancher de bruit F-02)
    const minScore = (() => {
      const v = parseFloat(process.env.EVIDENCE_MIN_SCORE || '0.12')
      return Number.isFinite(v) && v >= 0 ? v : 0.12
    })()
    additions = hits
      .filter((h) => (Number(h.score) || 0) >= minScore)
      .map((h) => ({ id: h.id, contenu: h.contenu, score: Number(h.score.toFixed(4)) }))
  } catch {
    // Retrieval indisponible : on régénère avec le contexte existant (dégradation gracieuse)
    additions = []
  }

  const { merged, added } = mergeExemples(p.ctx.exemples_pedagogiques || [], additions)
  const ctxEnrichi: GenerationContext = {
    ...p.ctx,
    exemples_pedagogiques: merged,
  }
  return { ctx: ctxEnrichi, added, refinedQuery, loopEnabled: true }
}
