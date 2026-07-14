// Utilitaire de validation Zod — P0-1
// Toute validation aux frontières (API, sorties d'agents, écritures DB) passe par ici.
// Utiliser safeParse() pour ne jamais crasher ; logger les erreurs et tracer dans agent_run.

import {
  CurriculumSpecSchema,
  GenerationContextSchema,
  SectionContentSchema,
  ValidationResultSchema,
  RenderedDocumentSchema,
  BatchPlanSchema,
  type CurriculumSpec,
  type GenerationContext,
  type SectionContent,
  type ValidationResult,
  type RenderedDocument,
  type BatchPlan,
} from '@/lib/contracts'

export interface ValidationOk<T> {
  ok: true
  data: T
}
export interface ValidationErr {
  ok: false
  error: string
  issues: string[]
}
export type ValidationOutcome<T> = ValidationOk<T> | ValidationErr

// ============================================================
// validateGenerationContext — sortie du Knowledge Compiler
// ============================================================
export function validateGenerationContext(ctx: unknown): ValidationOutcome<GenerationContext> {
  const r = GenerationContextSchema.safeParse(ctx)
  if (r.success) return { ok: true, data: r.data }
  const issues = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  return { ok: false, error: `GenerationContext invalide: ${issues.join('; ')}`, issues }
}

// ============================================================
// validateSectionContent — sortie du Rédacteur
// ============================================================
export function validateSectionContent(s: unknown): ValidationOutcome<SectionContent> {
  const r = SectionContentSchema.safeParse(s)
  if (r.success) return { ok: true, data: r.data }
  const issues = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  return { ok: false, error: `SectionContent invalide: ${issues.join('; ')}`, issues }
}

// ============================================================
// validateSectionContentArray — sortie du Rédacteur (toutes sections)
// ============================================================
export function validateSectionContentArray(arr: unknown): ValidationOutcome<SectionContent[]> {
  if (!Array.isArray(arr)) {
    return { ok: false, error: 'SectionContent[] attendu (tableau)', issues: ['not an array'] }
  }
  const results = arr.map((s) => validateSectionContent(s))
  const firstErr = results.find((r) => !r.ok)
  if (firstErr && !firstErr.ok) return firstErr
  return { ok: true, data: results.map((r) => (r as ValidationOk<SectionContent>).data) }
}

// ============================================================
// validateValidationResult — sortie du Critique
// ============================================================
export function validateValidationResult(v: unknown): ValidationOutcome<ValidationResult> {
  const r = ValidationResultSchema.safeParse(v)
  if (r.success) return { ok: true, data: r.data }
  const issues = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  return { ok: false, error: `ValidationResult invalide: ${issues.join('; ')}`, issues }
}

// ============================================================
// validateRenderedDocument — avant commit DB
// ============================================================
export function validateRenderedDocument(d: unknown): ValidationOutcome<RenderedDocument> {
  const r = RenderedDocumentSchema.safeParse(d)
  if (r.success) return { ok: true, data: r.data }
  const issues = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  return { ok: false, error: `RenderedDocument invalide: ${issues.join('; ')}`, issues }
}

// ============================================================
// validateBatchPlan — sortie du Planificateur
// ============================================================
export function validateBatchPlan(bp: unknown): ValidationOutcome<BatchPlan> {
  const r = BatchPlanSchema.safeParse(bp)
  if (r.success) return { ok: true, data: r.data }
  const issues = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  return { ok: false, error: `BatchPlan invalide: ${issues.join('; ')}`, issues }
}

// ============================================================
// validateCurriculumSpec — sortie de fetchCurriculumSpec
// ============================================================
export function validateCurriculumSpec(cs: unknown): ValidationOutcome<CurriculumSpec> {
  const r = CurriculumSpecSchema.safeParse(cs)
  if (r.success) return { ok: true, data: r.data }
  const issues = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  return { ok: false, error: `CurriculumSpec invalide: ${issues.join('; ')}`, issues }
}

// ============================================================
// validateOrThrow — pour les frontières où l'échec doit propager
// (ex: sortie KC, sortie Rédacteur — si invalide, le pipeline doit s'arrêter proprement)
// ============================================================
export function validateOrThrow<T>(outcome: ValidationOutcome<T>, context: string): T {
  if (outcome.ok) return outcome.data
  const msg = `[${context}] ${outcome.error}`
  console.error(`[ZOD VALIDATION ERROR] ${msg}`)
  if (outcome.issues.length > 0) {
    console.error(`[ZOD ISSUES] ${outcome.issues.join('\n')}`)
  }
  throw new Error(msg)
}
