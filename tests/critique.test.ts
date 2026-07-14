// Tests unitaires — Critique structurelle (P0-4)
// Vérifie : sections obligatoires, longueurs min, détection contenu de secours.

import { describe, it, expect } from 'vitest'
import { validateStructurel } from '@/lib/pipeline/critique'
import type { GenerationContext, SectionContent } from '@/lib/contracts'
import { FICHE_TEMPLATE_V1_SECTIONS } from '@/lib/contracts'

// ============================================================
// Helpers
// ============================================================
function makeCtx(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    sequence_id: 'seq_test',
    sequence_titre: 'Test',
    notions: [{
      notion_id: 'n1',
      nom: 'Test notion',
      competences: ['c1'],
      objectifs: ['o1'],
      prerequis_ids: [],
      niveau: '4e',
      chapitre: 'Géométrie',
    }],
    exemples_pedagogiques: [],
    references_style: [],
    regles: { longueur_section: { min_mots: 40 } },
    contexte_classe: null,
    template_version: 'v1',
    curriculum_version: 'v1',
    compiled_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeValidSections(): SectionContent[] {
  // Seuils min_mots par section : objectifs 40, prerequis 20, deroulement 120, activites 80,
  // differentiation 40, evaluation 40, prolongement 20
  const wordCounts: Record<string, number> = {
    objectifs: 50,
    prerequis: 25,
    deroulement: 130,
    activites: 90,
    differentiation: 50,
    evaluation: 50,
    prolongement: 25,
  }
  return FICHE_TEMPLATE_V1_SECTIONS.map((sid) => {
    const words = wordCounts[sid] || 50
    return {
      section_id: sid,
      contenu: `Contenu substantiel pour la section ${sid}. `.repeat(Math.ceil(words / 6) + 2),
      methode: null,
    }
  })
}

// ============================================================
// validateStructurel
// ============================================================
describe('validateStructurel', () => {
  it('passe quand toutes les sections obligatoires sont présentes et suffisamment longues', () => {
    const ctx = makeCtx()
    const sections = makeValidSections()
    const result = validateStructurel(sections, ctx)
    expect(result.structurel_pass).toBe(true)
    expect(result.structurel_raisons).toEqual([])
  })

  it('échoue si une section obligatoire est manquante', () => {
    const ctx = makeCtx()
    const sections = makeValidSections().filter((s) => s.section_id !== 'objectifs')
    const result = validateStructurel(sections, ctx)
    expect(result.structurel_pass).toBe(false)
    expect(result.structurel_raisons.some((r) => r.includes('objectifs'))).toBe(true)
    expect(result.section_a_regenerer).toBe('objectifs')
  })

  it('échoue si une section obligatoire a un contenu trop court (< 10 chars)', () => {
    const ctx = makeCtx()
    const sections = makeValidSections().map((s) =>
      s.section_id === 'objectifs' ? { ...s, contenu: 'court' } : s,
    )
    const result = validateStructurel(sections, ctx)
    expect(result.structurel_pass).toBe(false)
    expect(result.structurel_raisons.some((r) => r.includes('objectifs') && r.includes('trop courte'))).toBe(true)
  })

  it('détecte le contenu de secours LLM et le rejette', () => {
    const ctx = makeCtx()
    const sections = makeValidSections().map((s) =>
      s.section_id === 'objectifs'
        ? { ...s, contenu: 'LLM indisponible — contenu de secours pour cette section.' }
        : s,
    )
    const result = validateStructurel(sections, ctx)
    expect(result.structurel_pass).toBe(false)
    expect(result.structurel_raisons.some((r) => r.includes('contenu de secours'))).toBe(true)
  })

  it('échoue si une section est sous le seuil min_mots', () => {
    const ctx = makeCtx({ regles: { longueur_section: { min_mots: 40 } } })
    const sections = makeValidSections().map((s) =>
      s.section_id === 'prerequis' ? { ...s, contenu: 'Mot1 mot2 mot3.' } : s, // 3 mots < 20
    )
    const result = validateStructurel(sections, ctx)
    expect(result.structurel_pass).toBe(false)
    expect(result.structurel_raisons.some((r) => r.includes('prerequis') && r.includes('mots'))).toBe(true)
  })

  it('prolongement est optionnel — passe même si manquant', () => {
    const ctx = makeCtx()
    const sections = makeValidSections().filter((s) => s.section_id !== 'prolongement')
    const result = validateStructurel(sections, ctx)
    expect(result.structurel_pass).toBe(true)
  })

  it('couche_declenchee est toujours "structurel"', () => {
    const ctx = makeCtx()
    const result = validateStructurel(makeValidSections(), ctx)
    expect(result.couche_declenchee).toBe('structurel')
  })

  it('rejette sections null avec une erreur explicite (P0-5)', () => {
    const ctx = makeCtx()
    expect(() => validateStructurel(null as unknown as SectionContent[], ctx)).toThrow(
      /sections.*tableau/i,
    )
  })

  it('rejette ctx null avec une erreur explicite (P0-5)', () => {
    expect(() => validateStructurel([], null as unknown as GenerationContext)).toThrow(
      /ctx.*manquant|ctx.*invalide/i,
    )
  })
})
