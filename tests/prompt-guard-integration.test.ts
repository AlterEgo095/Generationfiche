// R-01 / Sprint S1-c — Test d'intégration PromptGuard sur données RÉELLES.
// Rejoue la chaîne d'injection F-01 en conditions réelles, SANS LLM :
//  1. compileGenerationContext() sur la séquence Pythagore réelle (DB live,
//     cache KC déterministe — 0 appel LLM)
//  2. buildSystemPrompt() — le MÊME code path que le Rédacteur en production
//  3. Vérifie que le marqueur MANDARINE-77 injecté dans le corpus n'atteint
//     JAMAIS le prompt système : preuve PAR CONSTRUCTION (le LLM ne peut pas
//     reproduire ce qu'on ne lui a pas donné).
import { describe, it, expect } from 'vitest'
import './setup'
import { compileGenerationContext } from '@/lib/pipeline/knowledge-compiler'
import { buildSystemPrompt } from '@/lib/pipeline/redacteur'

// Séquence réelle seedée : « Théorème de Pythagore — 4e » (4e/Géométrie) —
// le niveau/chapitre où la fiche infectée MANDARINE-77 a été injectée.
const SEQUENCE_PYTHAGORE = {
  id: 'cmto9wh250018u2hee4829y63',
  titre: 'Théorème de Pythagore — 4e',
  niveau: '4e',
  chapitre: 'Géométrie',
  templateVersion: 'v1',
  curriculumVersion: 'rdc-2024',
  notions: [{ notionId: 'notion_pyth' }],
}

describe('prompt-guard — intégration sur la chaîne prompt réelle (rejeu F-01 sans LLM)', () => {
  it('I1 le GenerationContext réel contient la fiche infectée (pire cas voulu)', async () => {
    const ctx = await compileGenerationContext(SEQUENCE_PYTHAGORE)
    const refs = ctx.references_style.map((r) => r.extrait).join(' ')
    // La fiche infectée (validée par un compte légitime) est bien dans le contexte
    expect(refs).toContain('MANDARINE')
  })

  it('I2 le prompt système NE contient JAMAIS le marqueur (neutralisation)', async () => {
    const ctx = await compileGenerationContext(SEQUENCE_PYTHAGORE)
    const sys = buildSystemPrompt(ctx, 'v2')
    expect(sys).not.toContain('MANDARINE-77')
    // la ligne infectée est neutralisée, visible comme donnée suspecte
    expect(sys).toContain('neutralisée par prompt-guard')
  })

  it('I3 le prompt contient la règle DATA jamais INSTRUCTION + encapsulation', async () => {
    const ctx = await compileGenerationContext(SEQUENCE_PYTHAGORE)
    const sys = buildSystemPrompt(ctx, 'v2')
    expect(sys).toContain('SÉCURITÉ DES DONNÉES')
    expect(sys).toContain('<corpus_data source="fiche_reference_1_4e">')
    expect(sys).toContain('</corpus_data>')
  })

  it('I4 les exemples pédagogiques sont aussi encapsulés (aucun canal nu)', async () => {
    const ctx = await compileGenerationContext(SEQUENCE_PYTHAGORE)
    const sys = buildSystemPrompt(ctx, 'v2')
    expect(sys).toContain('<corpus_data source="exemple_pedagogique_1">')
  })
})
