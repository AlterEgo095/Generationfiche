// Contrats de données — Architecture Élite v2 §3
// Chaque objet échangé entre étapes est un schéma Zod validé — plus de dict libre entre agents.

import { z } from 'zod'

// ============================================================
// CurriculumSpec — spécification d'une notion issue du référentiel
// ============================================================
export const CurriculumSpecSchema = z.object({
  notion_id: z.string(),
  nom: z.string(),
  competences: z.array(z.string()),
  objectifs: z.array(z.string()),
  prerequis_ids: z.array(z.string()),
  niveau: z.string(),
  chapitre: z.string(),
})
export type CurriculumSpec = z.infer<typeof CurriculumSpecSchema>

// ============================================================
// StyleReference — extrait d'une fiche marquée exemplaire
// ============================================================
export const StyleReferenceSchema = z.object({
  fiche_id: z.string(),
  extrait: z.string(),
  niveau: z.string(),
  chapitre: z.string(),
})
export type StyleReference = z.infer<typeof StyleReferenceSchema>

// ============================================================
// GenerationContext — produit une fois par le Knowledge Compiler, figé et rejouable
// ============================================================
export const GenerationContextSchema = z.object({
  sequence_id: z.string(),
  sequence_titre: z.string(),
  notions: z.array(CurriculumSpecSchema),
  exemples_pedagogiques: z.array(z.record(z.string(), z.unknown())),
  references_style: z.array(StyleReferenceSchema),
  regles: z.record(z.string(), z.unknown()),
  contexte_classe: z.record(z.string(), z.unknown()).nullable(),
  template_version: z.string(),
  curriculum_version: z.string(),
  compiled_at: z.string(),
  // P1-6 (Sprint 3) : hash des dépendances pour invalidation intelligente du cache.
  // Optionnel pour compatibilité avec les contexts historiques.
  dependency_hash: z.string().optional(),
})
export type GenerationContext = z.infer<typeof GenerationContextSchema>

// ============================================================
// SectionContent — une section produite par le Rédacteur
// ============================================================
export const SectionContentSchema = z.object({
  section_id: z.string(),
  contenu: z.string(),
  methode: z.string().nullable().optional(),
})
export type SectionContent = z.infer<typeof SectionContentSchema>

// ============================================================
// ValidationResult — résultat du Critique à deux couches
// ============================================================
export const ValidationResultSchema = z.object({
  structurel_pass: z.boolean(),
  structurel_raisons: z.array(z.string()),
  pedagogique_pass: z.boolean().nullable().optional(),
  pedagogique_raisons: z.array(z.string()).nullable().optional(),
  section_a_regenerer: z.string().nullable().optional(),
  couche_declenchee: z.enum(['structurel', 'pedagogique']).default('structurel'),
})
export type ValidationResult = z.infer<typeof ValidationResultSchema>

// ============================================================
// RenderedDocument — livrable final produit par le Superviseur
// ============================================================
export const RenderedDocumentSchema = z.object({
  livrable_id: z.string(),
  sequence_id: z.string(),
  format: z.string(),
  contenu_final: z.record(z.string(), z.unknown()),
  valide: z.boolean(),
  skill_version: z.string(),
})
export type RenderedDocument = z.infer<typeof RenderedDocumentSchema>

// ============================================================
// Sections attendues par le template v1 — utilisé par le Critique structurel
// ============================================================
export const FICHE_TEMPLATE_V1_SECTIONS = [
  'objectifs',
  'prerequis',
  'deroulement',
  'activites',
  'differentiation',
  'evaluation',
  'prolongement',
] as const

export type FicheSectionId = (typeof FICHE_TEMPLATE_V1_SECTIONS)[number]

export const SECTION_LABELS: Record<FicheSectionId, string> = {
  objectifs: 'Objectifs pédagogiques',
  prerequis: 'Prérequis mobilisés',
  deroulement: 'Déroulement de la séquence',
  activites: 'Activités proposées',
  differentiation: 'Différenciation',
  evaluation: "Évaluation",
  prolongement: 'Prolongement',
}

// ============================================================
// Pipeline events — émis par le mini-service WebSocket
// ============================================================
export const PipelineEventSchema = z.object({
  batch_id: z.string(),
  sequence_id: z.string().nullable().optional(),
  agent: z.enum(['planificateur', 'knowledge_compiler', 'redacteur', 'critique', 'superviseur']),
  skill: z.string().nullable().optional(),
  phase: z.enum(['start', 'progress', 'done', 'error', 'retry', 'escalade']),
  message: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
  duration_ms: z.number().nullable().optional(),
})
export type PipelineEvent = z.infer<typeof PipelineEventSchema>

// ============================================================
// Batch plan — produit par l'Agent Planificateur
// ============================================================
export const BatchPlanItemSchema = z.object({
  sequence_id: z.string(),
  sequence_titre: z.string(),
  semaine: z.number(),
  priorite: z.number(),
  notions: z.array(CurriculumSpecSchema),
  prerequis_couverts: z.boolean(),
  ready: z.boolean(),
})
export type BatchPlanItem = z.infer<typeof BatchPlanItemSchema>

export const BatchPlanSchema = z.object({
  batch_id: z.string(),
  demande: z.string(),
  items: z.array(BatchPlanItemSchema),
  total: z.number(),
})
export type BatchPlan = z.infer<typeof BatchPlanSchema>
