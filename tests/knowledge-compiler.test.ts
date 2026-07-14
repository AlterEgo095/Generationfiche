// Tests unitaires — Knowledge Compiler (P0-4)
// Vérifie : déterminisme, rejouabilité, validation Zod, guards d'entrée.

import { describe, it, expect } from 'vitest'
import './setup'
import { db } from '@/lib/db'
import { compileGenerationContext, retrieve_style_reference } from '@/lib/pipeline/knowledge-compiler'

// ============================================================
// compileGenerationContext — déterminisme + rejouabilité
// ============================================================
describe('Knowledge Compiler — déterminisme et rejouabilité', () => {
  it('produit un GenerationContext identique en deux compilations (hors compiled_at)', async () => {
    const seq = await db.sequence.findFirst({
      where: { statut: 'validee' },
      include: { notions: true },
    })
    if (!seq) throw new Error('Aucune séquence validée en DB pour le test')

    const ctx1 = await compileGenerationContext(seq, { forceRecompile: true })
    const ctx2 = await compileGenerationContext(seq, { forceRecompile: true })

    // On exclut compiled_at (timestamp non-déterministe — P2, pas P0)
    const { compiled_at: _c1, ...rest1 } = ctx1
    const { compiled_at: _c2, ...rest2 } = ctx2

    expect(JSON.stringify(rest1)).toBe(JSON.stringify(rest2))
  })

  it('le GenerationContext contient les notions du référentiel', async () => {
    const seq = await db.sequence.findFirst({
      where: { statut: 'validee' },
      include: { notions: { include: { notion: true } } },
    })
    if (!seq) throw new Error('Aucune séquence validée')

    const ctx = await compileGenerationContext(seq, { forceRecompile: true })

    expect(ctx.notions.length).toBeGreaterThan(0)
    // Les objectifs proviennent du référentiel (P0 : "le fait ne se génère jamais")
    for (const n of ctx.notions) {
      expect(n.objectifs.length).toBeGreaterThan(0)
      expect(n.competences.length).toBeGreaterThan(0)
    }
  })

  it('le GenerationContext est persisté en DB (figé, rejouable)', async () => {
    const seq = await db.sequence.findFirst({
      where: { statut: 'validee' },
      include: { notions: true },
    })
    if (!seq) throw new Error('Aucune séquence validée')

    await compileGenerationContext(seq, { forceRecompile: true })

    const persisted = await db.generationContext.findUnique({
      where: { sequenceId: seq.id },
    })
    expect(persisted).not.toBeNull()
    expect(persisted!.payloadJson.length).toBeGreaterThan(0)
  })

  it('le cache est réutilisé sans recompilation quand forceRecompile=false', async () => {
    const seq = await db.sequence.findFirst({
      where: { statut: 'validee' },
      include: { notions: true },
    })
    if (!seq) throw new Error('Aucune séquence validée')

    // Première compilation (force)
    const ctx1 = await compileGenerationContext(seq, { forceRecompile: true })
    // Deuxième lecture (cache) — compiled_at doit être identique
    const ctx2 = await compileGenerationContext(seq, { forceRecompile: false })

    expect(ctx2.compiled_at).toBe(ctx1.compiled_at)
  })

  it('les références de style respectent le filtre strict (P0-2)', async () => {
    const seq = await db.sequence.findFirst({
      where: { statut: 'validee' },
      include: { notions: { include: { notion: true } } },
    })
    if (!seq) throw new Error('Aucune séquence validée')

    const ctx = await compileGenerationContext(seq, { forceRecompile: true })

    // Toutes les références de style DOIVENT être du niveau+chapitre de la séquence
    for (const ref of ctx.references_style) {
      expect(ref.niveau).toBe(seq.niveau)
      expect(ref.chapitre).toBe(seq.chapitre)
    }
  })

  it('rejette une séquence null avec une erreur explicite (P0-5)', async () => {
    await expect(compileGenerationContext(null as unknown as never, {})).rejects.toThrow(
      /sequence.*manquant|sequence.*invalide/i,
    )
  })

  it('rejette une séquence avec id vide (P0-5)', async () => {
    await expect(
      compileGenerationContext(
        { id: '', titre: 'x', niveau: '4e', chapitre: 'x', templateVersion: 'v1', curriculumVersion: 'v1', notions: [] },
        {},
      ),
    ).rejects.toThrow(/sequence\.id.*invalide/i)
  })
})

// ============================================================
// retrieve_style_reference — test direct (P0-2)
// ============================================================
describe('retrieve_style_reference — test direct du filtre strict', () => {
  it('jamais de fallback vers un autre niveau (P0-2)', async () => {
    // 6e/Nombres et calculs n'a pas de fiche exemplaire → doit retourner []
    const refs = await retrieve_style_reference('6e', 'Nombres et calculs', 3)
    expect(refs).toEqual([])
    // Si on avait un fallback, on aurait des refs de 5e ou 4e
  })

  it('jamais de fallback vers un autre chapitre (P0-2)', async () => {
    // 5e/Le vivant a ref_photo_1, mais 5e/Organisation n'a rien
    const refs = await retrieve_style_reference('5e', 'Organisation et gestion de données', 3)
    expect(refs).toEqual([])
  })
})
