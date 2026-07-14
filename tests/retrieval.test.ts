// Tests unitaires — retrieve_style_reference + retrieve_pedagogical_examples (P0-2, P0-4)
// Vérifie le filtre strict et le comportement quand le corpus est vide.

import { describe, it, expect } from 'vitest'
import './setup'
import { retrieve_style_reference, retrieve_pedagogical_examples } from '@/lib/pipeline/knowledge-compiler'

// ============================================================
// retrieve_style_reference — filtre STRICT (P0-2)
// ============================================================
describe('retrieve_style_reference — filtre strict', () => {
  it('retourne les fiches exemplaires pour un (niveau, chapitre) existant', async () => {
    // Seed : ref_frac_1 est exemplaire pour 5e/Nombres et calculs
    const refs = await retrieve_style_reference('5e', 'Nombres et calculs', 3)
    expect(refs.length).toBeGreaterThan(0)
    // Toutes les refs DOIVENT être du bon niveau et chapitre (P0-2 — pas de fallback)
    for (const r of refs) {
      expect(r.niveau).toBe('5e')
      expect(r.chapitre).toBe('Nombres et calculs')
    }
  })

  it("retourne [] quand aucune fiche exemplaire n'existe pour le (niveau, chapitre) — PAS DE FALLBACK", async () => {
    // 6e/Nombres et calculs n'a aucune fiche exemplaire seedée
    const refs = await retrieve_style_reference('6e', 'Nombres et calculs', 3)
    expect(refs).toEqual([])
    // CRITIQUE P0-2 : on ne doit PAS retomber sur 5e ou 4e
  })

  it("retourne [] pour un niveau inexistant", async () => {
    const refs = await retrieve_style_reference('Terminale', 'Nombres et calculs', 3)
    expect(refs).toEqual([])
  })

  it("retourne [] pour un chapitre inexistant", async () => {
    const refs = await retrieve_style_reference('4e', 'Chapitre Inexistant', 3)
    expect(refs).toEqual([])
  })

  it('retourne les fiches pour 4e/Géométrie (ref_pyth_1 est exemplaire)', async () => {
    const refs = await retrieve_style_reference('4e', 'Géométrie', 3)
    expect(refs.length).toBeGreaterThan(0)
    for (const r of refs) {
      expect(r.niveau).toBe('4e')
      expect(r.chapitre).toBe('Géométrie')
    }
  })

  it('rejette un paramètre niveau null avec une erreur explicite (P0-5)', async () => {
    await expect(retrieve_style_reference(null as unknown as string, 'Géométrie', 3)).rejects.toThrow(
      /niveau.*invalide/,
    )
  })

  it('rejette un paramètre chapitre vide avec une erreur explicite (P0-5)', async () => {
    await expect(retrieve_style_reference('4e', '', 3)).rejects.toThrow(/chapitre.*invalide/)
  })

  it('rejette k=0 ou négatif avec une erreur explicite (P0-5)', async () => {
    await expect(retrieve_style_reference('4e', 'Géométrie', 0)).rejects.toThrow(/k.*entier positif/)
    await expect(retrieve_style_reference('4e', 'Géométrie', -1)).rejects.toThrow(/k.*entier positif/)
  })
})

// ============================================================
// retrieve_pedagogical_examples — recherche TF-IDF large
// ============================================================
describe('retrieve_pedagogical_examples', () => {
  it('retourne des exemples pour une query pertinente', async () => {
    const results = await retrieve_pedagogical_examples('fractions addition dénominateur', 5)
    expect(results.length).toBeGreaterThan(0)
    // Chaque résultat doit avoir un contenu non vide et un score > 0
    for (const r of results) {
      expect(r.contenu.length).toBeGreaterThan(0)
      expect(r.score).toBeGreaterThan(0)
    }
  })

  it('retourne [] pour une query vide (aucun match)', async () => {
    const results = await retrieve_pedagogical_examples('xyzqwertyinexistant', 5)
    // Le TF-IDF ne match pas → []
    expect(results).toEqual([])
  })

  it('rejette une query null avec une erreur explicite (P0-5)', async () => {
    await expect(retrieve_pedagogical_examples(null as unknown as string, 5)).rejects.toThrow(/query.*invalide/)
  })

  it('rejette k négatif (P0-5)', async () => {
    await expect(retrieve_pedagogical_examples('fractions', -1)).rejects.toThrow(/k.*entier positif/)
  })

  it('respecte la limite k (retourne au plus k résultats)', async () => {
    const results = await retrieve_pedagogical_examples('mathématiques', 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })
})
