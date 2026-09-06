// Tests — Evidence Refresher (F-32) : boucle Critique→Retrieval
// Sur échec critique, le contexte doit être enrichi AVANT régénération.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  buildRefinedQuery,
  mergeExemples,
  isCritiqueRetrievalLoopEnabled,
  MAX_EXEMPLES_ENRICHIS,
} from '@/lib/pipeline/evidence-refresher'
import type { GenerationContext } from '@/lib/contracts'

function makeCtx(exemples: Array<{ id: string; contenu: string; score: number }>): GenerationContext {
  return {
    sequence_id: 'seq_test',
    sequence_titre: 'Théorème de Thalès',
    notions: [{
      notion_id: 'n1',
      nom: 'Théorème de Thalès',
      competences: ['appliquer le théorème'],
      objectifs: ['Calculer une longueur dans une configuration de Thalès'],
      prerequis_ids: [],
      niveau: '4e',
      chapitre: 'Géométrie',
    }],
    exemples_pedagogiques: exemples,
    references_style: [],
    regles: {},
    contexte_classe: null,
    template_version: 'v1',
    curriculum_version: 'v1',
    compiled_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('Evidence Refresher — F-32 boucle Critique→Retrieval', () => {
  let savedEnv: string | undefined
  beforeEach(() => {
    savedEnv = process.env.CRITIQUE_RETRIEVAL_LOOP
    delete process.env.CRITIQUE_RETRIEVAL_LOOP
  })
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.CRITIQUE_RETRIEVAL_LOOP
    else process.env.CRITIQUE_RETRIEVAL_LOOP = savedEnv
  })

  describe('mergeExemples (pur)', () => {
    it('ajoute les nouveaux exemples sans dupliquer les ids existants', () => {
      const current = [{ id: 'a', contenu: 'A', score: 0.3 }]
      const additions = [
        { id: 'a', contenu: 'A bis', score: 0.9 }, // déjà présent → ignoré
        { id: 'b', contenu: 'B', score: 0.5 },
      ]
      const { merged, added } = mergeExemples(current, additions)
      expect(added).toBe(1)
      expect(merged.map((e) => e.id)).toEqual(['b', 'a']) // tri score décroissant
      expect(merged.find((e) => e.id === 'a')?.contenu).toBe('A') // original préservé
    })

    it('trie par score décroissant et applique le cap', () => {
      const current = Array.from({ length: MAX_EXEMPLES_ENRICHIS }, (_, i) => ({
        id: `cur_${i}`, contenu: `c${i}`, score: 0.9 - i * 0.01,
      }))
      const additions = [{ id: 'new', contenu: 'N', score: 0.99 }]
      const { merged, added } = mergeExemples(current, additions)
      expect(added).toBe(1)
      expect(merged).toHaveLength(MAX_EXEMPLES_ENRICHIS)
      expect(merged[0].id).toBe('new') // le meilleur score reste en tête
    })

    it('cap jamais inférieur à 1', () => {
      const { merged } = mergeExemples([], [{ id: 'x', contenu: 'X', score: 1 }], 0)
      expect(merged).toHaveLength(1)
    })

    it('contexte vide + additions vides → merge vide, 0 ajout', () => {
      const { merged, added } = mergeExemples([], [])
      expect(merged).toHaveLength(0)
      expect(added).toBe(0)
    })
  })

  describe('buildRefinedQuery (pur)', () => {
    it('combine section visée + raisons nettoyées + notions imposées', () => {
      const ctx = makeCtx([])
      const q = buildRefinedQuery(
        { raisons: ['Section "evaluation" — 30 mots < seuil min 40 mots'], section: 'evaluation' },
        ctx,
      )
      expect(q).toContain('evaluation')
      expect(q).toContain('Théorème de Thalès')
      expect(q).toContain('Calculer une longueur') // objectifs = ancrage curriculum
      expect(q.length).toBeLessThanOrEqual(600)
    })

    it('purge la ponctuation et les marqueurs techniques des raisons', () => {
      const q = buildRefinedQuery(
        { raisons: ['Échec pédagogique persistant — raisons: {"clarte": "trop dense"}'], section: null },
        makeCtx([]),
      )
      expect(q).not.toMatch(/[{}"]/)
      expect(q).toContain('Théorème de Thalès')
    })
  })

  describe('réversibilité', () => {
    it('CRITIQUE_RETRIEVAL_LOOP=off → boucle désactivée (même convention que R-12/F-02)', () => {
      process.env.CRITIQUE_RETRIEVAL_LOOP = 'off'
      expect(isCritiqueRetrievalLoopEnabled()).toBe(false)
    })

    it('activée par défaut', () => {
      expect(isCritiqueRetrievalLoopEnabled()).toBe(true)
    })
  })
})
