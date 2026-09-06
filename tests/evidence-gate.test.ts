// Tests — Evidence Gate (F-02) : admission sur preuves avant génération LLM
// Le pipeline ne doit JAMAIS générer sans preuve exploitable dans le contexte.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  evaluateEvidence,
  assertEvidenceOrFlag,
  evidenceMinScore,
  isEvidenceGateEnabled,
} from '@/lib/pipeline/evidence-gate'
import type { GenerationContext } from '@/lib/contracts'

function makeCtx(exemples: Array<{ id: string; contenu: string; score: number }>): GenerationContext {
  return {
    sequence_id: 'seq_test',
    sequence_titre: 'Test',
    notions: [{ notion_id: 'n1', nom: 'Test', competences: ['c1'], objectifs: ['o1'], prerequis_ids: [], niveau: '4e', chapitre: 'Géométrie' }],
    exemples_pedagogiques: exemples,
    references_style: [],
    regles: {},
    contexte_classe: null,
    template_version: 'v1',
    curriculum_version: 'v1',
    compiled_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('Evidence Gate — F-02 INSUFFICIENT_EVIDENCE', () => {
  let savedEnv: string | undefined
  let savedMin: string | undefined

  beforeEach(() => {
    savedEnv = process.env.EVIDENCE_GATE
    savedMin = process.env.EVIDENCE_MIN_SCORE
    delete process.env.EVIDENCE_GATE
    delete process.env.EVIDENCE_MIN_SCORE
  })
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.EVIDENCE_GATE
    else process.env.EVIDENCE_GATE = savedEnv
    if (savedMin === undefined) delete process.env.EVIDENCE_MIN_SCORE
    else process.env.EVIDENCE_MIN_SCORE = savedMin
  })

  it('0 exemple → insufficient (aucune preuve à adosser)', () => {
    const a = evaluateEvidence(makeCtx([]))
    expect(a.level).toBe('insufficient')
    expect(a.reasons[0]).toContain('INSUFFICIENT_EVIDENCE')
  })

  it('exemples présents mais tous sous le seuil de bruit → insufficient', () => {
    const a = evaluateEvidence(makeCtx([
      { id: 'e1', contenu: '...', score: 0.04 },
      { id: 'e2', contenu: '...', score: 0.07 },
    ]))
    expect(a.level).toBe('insufficient')
    expect(a.maxScore).toBeCloseTo(0.07)
    expect(a.strongCount).toBe(0)
  })

  it('au moins 1 exemple au-dessus du seuil → sufficient', () => {
    const a = evaluateEvidence(makeCtx([
      { id: 'e1', contenu: '...', score: 0.05 },
      { id: 'e2', contenu: '...', score: 0.30 },
    ]))
    expect(a.level).toBe('sufficient')
    expect(a.strongCount).toBe(1)
  })

  it('couverture mince (1 seule preuve forte) → sufficient MAIS signalé', () => {
    const a = evaluateEvidence(makeCtx([{ id: 'e1', contenu: '...', score: 0.42 }]))
    expect(a.level).toBe('sufficient')
    expect(a.reasons.some((r) => r.includes('Couverture mince'))).toBe(true)
  })

  it('deux preuves fortes → sufficient sans warning de couverture', () => {
    const a = evaluateEvidence(makeCtx([
      { id: 'e1', contenu: '...', score: 0.42 },
      { id: 'e2', contenu: '...', score: 0.31 },
    ]))
    expect(a.level).toBe('sufficient')
    expect(a.reasons).toHaveLength(0)
  })

  it('assertEvidenceOrFlag bloque la génération en insufficient', () => {
    const r = assertEvidenceOrFlag(makeCtx([{ id: 'e1', contenu: '...', score: 0.01 }]))
    expect(r.proceed).toBe(false)
  })

  it('assertEvidenceOrFlag laisse passer en sufficient', () => {
    const r = assertEvidenceOrFlag(makeCtx([{ id: 'e1', contenu: '...', score: 0.5 }]))
    expect(r.proceed).toBe(true)
  })

  it('EVIDENCE_GATE=off → toujours sufficient (réversibilité, même convention que R-12)', () => {
    process.env.EVIDENCE_GATE = 'off'
    const r = assertEvidenceOrFlag(makeCtx([]))
    expect(r.proceed).toBe(true)
    expect(r.assessment.gateEnabled).toBe(false)
    expect(isEvidenceGateEnabled()).toBe(false)
  })

  it('seuil configurable via EVIDENCE_MIN_SCORE', () => {
    process.env.EVIDENCE_MIN_SCORE = '0.5'
    expect(evidenceMinScore()).toBe(0.5)
    const a = evaluateEvidence(makeCtx([{ id: 'e1', contenu: '...', score: 0.3 }]))
    expect(a.level).toBe('insufficient')
  })
})
