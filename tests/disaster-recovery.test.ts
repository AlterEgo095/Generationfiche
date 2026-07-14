// Tests — Disaster Recovery (P4-8 Sprint 4)
// Vérifie : restauration DB, replay cache, outbox recovery, LLM indisponible.

import { describe, it, expect } from 'vitest'
import './setup'
import { db } from '@/lib/db'
import { compileGenerationContext } from '@/lib/pipeline/knowledge-compiler'
import { validateStructurel } from '@/lib/pipeline/critique'
import { renderFiche } from '@/lib/pipeline/superviseur'
import { exportLivrable } from '@/lib/export'
import { FICHE_TEMPLATE_V1_SECTIONS } from '@/lib/contracts'
import type { GenerationContext, SectionContent } from '@/lib/contracts'

function makeCtx(): GenerationContext {
  return {
    sequence_id: 'seq_dr', sequence_titre: 'Disaster Recovery Test',
    notions: [{ notion_id: 'n1', nom: 'Test', competences: ['c1'], objectifs: ['o1'], prerequis_ids: [], niveau: '4e', chapitre: 'Géométrie' }],
    exemples_pedagogiques: [], references_style: [], regles: {},
    contexte_classe: null, template_version: 'v1', curriculum_version: 'v1', compiled_at: '2026-01-01T00:00:00.000Z',
  }
}

function makeSections(): SectionContent[] {
  const wc: Record<string, number> = { objectifs: 50, prerequis: 50, deroulement: 130, activites: 90, differentiation: 50, evaluation: 50, prolongement: 50 }
  return FICHE_TEMPLATE_V1_SECTIONS.map((sid) => ({
    section_id: sid,
    contenu: `Contenu recovery ${sid}. `.repeat(Math.ceil((wc[sid] || 50) / 3) + 10),
    methode: null,
  }))
}

describe('Disaster Recovery — DB restore & replay', () => {
  it('la DB est accessible après re-seed', async () => {
    const count = await db.notion.count()
    expect(count).toBeGreaterThan(0)
  })

  it('un GenerationContext peut être recompilé après restauration DB', async () => {
    const seq = await db.sequence.findFirst({ where: { statut: 'en_cours' }, include: { notions: true } })
    if (!seq) return
    const ctx = await compileGenerationContext(seq, { forceRecompile: true })
    expect(ctx.notions.length).toBeGreaterThan(0)
  })

  it('le cache se reconstruit après invalidation (forceRecompile)', async () => {
    const seq = await db.sequence.findFirst({ where: { statut: 'en_cours' }, include: { notions: true } })
    if (!seq) return
    // Force recompile = cache invalidé + reconstruit
    const ctx1 = await compileGenerationContext(seq, { forceRecompile: true })
    const ctx2 = await compileGenerationContext(seq, { forceRecompile: false })
    expect(ctx2.notions).toEqual(ctx1.notions)
  })

  it('le rendu peut être rejoué avec un GenerationContext historique', () => {
    const ctx = makeCtx()
    const sections = makeSections()
    const rendered1 = renderFiche(sections, ctx, { livrable_id: 'liv_dr1', skill_version: 'v1' })
    const rendered2 = renderFiche(sections, ctx, { livrable_id: 'liv_dr2', skill_version: 'v1' })
    // Même contenu, livrable_id différent
    expect(rendered1.contenu_final.markdown).toBe(rendered2.contenu_final.markdown)
  })

  it('les exports peuvent être régénérés à partir d\'un livrable', async () => {
    const ctx = makeCtx()
    const sections = makeSections()
    const rendered = renderFiche(sections, ctx, { livrable_id: 'liv_export_dr', skill_version: 'v1' })
    for (const fmt of ['markdown', 'html', 'docx', 'pdf'] as const) {
      const result = await exportLivrable(rendered, fmt)
      expect(result.data).toBeDefined()
      expect(result.filename).toBeTruthy()
    }
  })
})

describe('Disaster Recovery — LLM indisponible', () => {
  it('le validateur structurel fonctionne sans LLM (TypeScript pur)', () => {
    const ctx = makeCtx()
    const result = validateStructurel(makeSections(), ctx)
    expect(result.structurel_pass).toBe(true)
    expect(result.couche_declenchee).toBe('structurel')
  })

  it('le pipeline peut détecter une fiche dégradée (contenu de secours)', () => {
    const ctx = makeCtx()
    const degradedSections: SectionContent[] = [{
      section_id: 'objectifs',
      contenu: 'LLM indisponible — contenu de secours pour cette section.',
      methode: null,
    }, ...makeSections().slice(1)]
    const result = validateStructurel(degradedSections, ctx)
    expect(result.structurel_pass).toBe(false)
    expect(result.structurel_raisons.some((r) => r.includes('contenu de secours'))).toBe(true)
  })
})

describe('Disaster Recovery — Outbox recovery', () => {
  it('les events restent en DB même si le worker ne tourne pas', async () => {
    await db.eventOutbox.create({
      data: {
        batchId: 'dr-test-batch', agent: 'redacteur', phase: 'start',
        message: 'DR test event', status: 'pending', attempts: 0, maxAttempts: 3, nextRetryAt: new Date(),
      },
    })
    const evt = await db.eventOutbox.findFirst({ where: { batchId: 'dr-test-batch' } })
    expect(evt).not.toBeNull()
    expect(evt?.status).toBe('pending')
    // Cleanup
    await db.eventOutbox.deleteMany({ where: { batchId: 'dr-test-batch' } })
  })

  it('les events failed_delivery restent traçables en DB', async () => {
    await db.eventOutbox.create({
      data: {
        batchId: 'dr-test-failed', agent: 'critique', phase: 'error',
        message: 'Failed delivery DR test', status: 'failed_delivery', attempts: 3, maxAttempts: 3, nextRetryAt: new Date(),
      },
    })
    const evt = await db.eventOutbox.findFirst({ where: { batchId: 'dr-test-failed' } })
    expect(evt?.status).toBe('failed_delivery')
    expect(evt?.attempts).toBe(3)
    // Cleanup
    await db.eventOutbox.deleteMany({ where: { batchId: 'dr-test-failed' } })
  })
})

describe('Disaster Recovery — Cache corrompu', () => {
  it('un GenerationContext avec payload corrompu est recompilé automatiquement', async () => {
    const seq = await db.sequence.findFirst({ where: { statut: 'en_cours' }, include: { notions: true } })
    if (!seq) return
    // Corrompt le payload
    await db.generationContext.upsert({
      where: { sequenceId: seq.id },
      create: { sequenceId: seq.id, payloadJson: 'CORRUPTED_JSON{{{' },
      update: { payloadJson: 'CORRUPTED_JSON{{{' },
    })
    // Recompile — doit détecter la corruption et recompiler
    const ctx = await compileGenerationContext(seq, { forceRecompile: false })
    expect(ctx.notions.length).toBeGreaterThan(0)
    expect(ctx.compiled_at).toBeDefined()
  })
})
