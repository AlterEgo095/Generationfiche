// Tests unitaires — Contrats Zod (P0-1, P0-4)
// Vérifie que les schémas valident les objets valides et rejettent les invalides.

import { describe, it, expect } from 'vitest'
import {
  CurriculumSpecSchema,
  StyleReferenceSchema,
  GenerationContextSchema,
  SectionContentSchema,
  ValidationResultSchema,
  RenderedDocumentSchema,
  BatchPlanSchema,
} from '@/lib/contracts'

// ============================================================
// Helpers — objets valides de référence
// ============================================================
const validCurriculumSpec = {
  notion_id: 'notion_test',
  nom: 'Test notion',
  competences: ['comp1'],
  objectifs: ['obj1'],
  prerequis_ids: [],
  niveau: '4e',
  chapitre: 'Géométrie',
}

const validStyleReference = {
  fiche_id: 'ref_1',
  extrait: 'extrait de fiche',
  niveau: '4e',
  chapitre: 'Géométrie',
}

const validGenerationContext = {
  sequence_id: 'seq_1',
  sequence_titre: 'Test séquence',
  notions: [validCurriculumSpec],
  exemples_pedagogiques: [],
  references_style: [],
  regles: {},
  contexte_classe: null,
  template_version: 'v1',
  curriculum_version: 'v1',
  compiled_at: '2026-01-01T00:00:00.000Z',
}

const validSectionContent = {
  section_id: 'objectifs',
  contenu: 'Un contenu valide pour la section objectifs.',
  methode: null,
}

const validValidationResult = {
  structurel_pass: true,
  structurel_raisons: [],
  couche_declenchee: 'structurel' as const,
}

const validRenderedDocument = {
  livrable_id: 'liv_1',
  sequence_id: 'seq_1',
  format: 'markdown',
  contenu_final: { markdown: '# Test', sections: [], meta: {} },
  valide: true,
  skill_version: 'v1',
}

// ============================================================
// CurriculumSpec
// ============================================================
describe('CurriculumSpecSchema', () => {
  it('valide un objet complet', () => {
    const r = CurriculumSpecSchema.safeParse(validCurriculumSpec)
    expect(r.success).toBe(true)
  })
  it('rejette un objet sans notion_id', () => {
    const r = CurriculumSpecSchema.safeParse({ ...validCurriculumSpec, notion_id: undefined })
    expect(r.success).toBe(false)
  })
  it('rejette null', () => {
    const r = CurriculumSpecSchema.safeParse(null)
    expect(r.success).toBe(false)
  })
  it('rejette un objet sans competences', () => {
    const r = CurriculumSpecSchema.safeParse({ ...validCurriculumSpec, competences: undefined })
    expect(r.success).toBe(false)
  })
})

// ============================================================
// StyleReference
// ============================================================
describe('StyleReferenceSchema', () => {
  it('valide un objet complet', () => {
    const r = StyleReferenceSchema.safeParse(validStyleReference)
    expect(r.success).toBe(true)
  })
  it('rejette un objet sans fiche_id', () => {
    const r = StyleReferenceSchema.safeParse({ ...validStyleReference, fiche_id: undefined })
    expect(r.success).toBe(false)
  })
})

// ============================================================
// GenerationContext
// ============================================================
describe('GenerationContextSchema', () => {
  it('valide un contexte complet', () => {
    const r = GenerationContextSchema.safeParse(validGenerationContext)
    expect(r.success).toBe(true)
  })
  it('valide un contexte avec contexte_classe non-null', () => {
    const r = GenerationContextSchema.safeParse({
      ...validGenerationContext,
      contexte_classe: { effectif: 28, duree_min: 50 },
    })
    expect(r.success).toBe(true)
  })
  it('rejette un contexte sans compiled_at', () => {
    const r = GenerationContextSchema.safeParse({ ...validGenerationContext, compiled_at: undefined })
    expect(r.success).toBe(false)
  })
  it('rejette un contexte avec notions non-array', () => {
    const r = GenerationContextSchema.safeParse({ ...validGenerationContext, notions: 'not_an_array' })
    expect(r.success).toBe(false)
  })
  it('rejette un contexte sans sequence_id', () => {
    const r = GenerationContextSchema.safeParse({ ...validGenerationContext, sequence_id: undefined })
    expect(r.success).toBe(false)
  })
})

// ============================================================
// SectionContent
// ============================================================
describe('SectionContentSchema', () => {
  it('valide une section avec methode null', () => {
    const r = SectionContentSchema.safeParse(validSectionContent)
    expect(r.success).toBe(true)
  })
  it('valide une section avec methode non-null', () => {
    const r = SectionContentSchema.safeParse({ ...validSectionContent, methode: 'une méthode' })
    expect(r.success).toBe(true)
  })
  it('rejette une section sans section_id', () => {
    const r = SectionContentSchema.safeParse({ ...validSectionContent, section_id: undefined })
    expect(r.success).toBe(false)
  })
  it('rejette une section sans contenu', () => {
    const r = SectionContentSchema.safeParse({ ...validSectionContent, contenu: undefined })
    expect(r.success).toBe(false)
  })
})

// ============================================================
// ValidationResult
// ============================================================
describe('ValidationResultSchema', () => {
  it('valide un résultat structurel pass', () => {
    const r = ValidationResultSchema.safeParse(validValidationResult)
    expect(r.success).toBe(true)
  })
  it('valide un résultat pédagogique pass', () => {
    const r = ValidationResultSchema.safeParse({
      ...validValidationResult,
      pedagogique_pass: true,
      pedagogique_raisons: ['OK'],
      couche_declenchee: 'pedagogique',
    })
    expect(r.success).toBe(true)
  })
  it('valide un résultat structurel fail avec section_a_regenerer', () => {
    const r = ValidationResultSchema.safeParse({
      structurel_pass: false,
      structurel_raisons: ['Section manquante'],
      pedagogique_pass: null,
      pedagogique_raisons: null,
      section_a_regenerer: 'deroulement',
      couche_declenchee: 'structurel',
    })
    expect(r.success).toBe(true)
  })
  it('rejette un couche_declenchee invalide', () => {
    const r = ValidationResultSchema.safeParse({
      ...validValidationResult,
      couche_declenchee: 'invalide',
    })
    expect(r.success).toBe(false)
  })
})

// ============================================================
// RenderedDocument
// ============================================================
describe('RenderedDocumentSchema', () => {
  it('valide un document rendu', () => {
    const r = RenderedDocumentSchema.safeParse(validRenderedDocument)
    expect(r.success).toBe(true)
  })
  it('rejette un document sans contenu_final', () => {
    const r = RenderedDocumentSchema.safeParse({ ...validRenderedDocument, contenu_final: undefined })
    expect(r.success).toBe(false)
  })
})

// ============================================================
// BatchPlan
// ============================================================
describe('BatchPlanSchema', () => {
  it('valide un batch plan avec items', () => {
    const r = BatchPlanSchema.safeParse({
      batch_id: 'batch_1',
      demande: 'Géométrie 4e',
      items: [
        {
          sequence_id: 'seq_1',
          sequence_titre: 'Test',
          semaine: 1,
          priorite: 5,
          notions: [validCurriculumSpec],
          prerequis_couverts: true,
          ready: true,
        },
      ],
      total: 1,
    })
    expect(r.success).toBe(true)
  })
  it('valide un batch plan vide', () => {
    const r = BatchPlanSchema.safeParse({
      batch_id: 'batch_2',
      demande: 'rien',
      items: [],
      total: 0,
    })
    expect(r.success).toBe(true)
  })
  it('rejette un batch plan sans batch_id', () => {
    const r = BatchPlanSchema.safeParse({
      batch_id: undefined,
      demande: 'x',
      items: [],
      total: 0,
    })
    expect(r.success).toBe(false)
  })

  it('valide un batch plan avec total=0 (même si items vide)', () => {
    const r = BatchPlanSchema.safeParse({
      batch_id: 'b1', demande: 'x', items: [], total: 0,
    })
    expect(r.success).toBe(true)
  })

  it('rejette un CurriculumSpec avec niveau vide (undefined)', () => {
    const r = CurriculumSpecSchema.safeParse({ ...validCurriculumSpec, niveau: undefined })
    expect(r.success).toBe(false)
  })

  it('rejette un CurriculumSpec avec chapitre vide (undefined)', () => {
    const r = CurriculumSpecSchema.safeParse({ ...validCurriculumSpec, chapitre: undefined })
    expect(r.success).toBe(false)
  })

  it('valide un CurriculumSpec avec prerequis_ids vide', () => {
    const r = CurriculumSpecSchema.safeParse({ ...validCurriculumSpec, prerequis_ids: [] })
    expect(r.success).toBe(true)
  })

  it('rejette un SectionContent avec methode non-string (nombre)', () => {
    const r = SectionContentSchema.safeParse({ ...validSectionContent, methode: 123 })
    expect(r.success).toBe(false)
  })

  it('valide un ValidationResult avec section_a_regenerer null', () => {
    const r = ValidationResultSchema.safeParse({
      ...validValidationResult,
      section_a_regenerer: null,
    })
    expect(r.success).toBe(true)
  })

  it('rejette un ValidationResult avec structurel_pass non-booléen', () => {
    const r = ValidationResultSchema.safeParse({
      ...validValidationResult,
      structurel_pass: 'yes',
    })
    expect(r.success).toBe(false)
  })

  it('valide un RenderedDocument avec valide=false', () => {
    const r = RenderedDocumentSchema.safeParse({ ...validRenderedDocument, valide: false })
    expect(r.success).toBe(true)
  })

  it('rejette un GenerationContext avec template_version undefined', () => {
    const r = GenerationContextSchema.safeParse({ ...validGenerationContext, template_version: undefined })
    expect(r.success).toBe(false)
  })
})
