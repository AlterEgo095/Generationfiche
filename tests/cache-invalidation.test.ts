// Tests — Cache Intelligent (P1-6 Sprint 3)
// Vérifie que le cache GenerationContext est invalidé quand les dépendances changent.

import { describe, it, expect } from 'vitest'
import './setup'
import { db } from '@/lib/db'
import { compileGenerationContext } from '@/lib/pipeline/knowledge-compiler'

describe('Cache Intelligent — Invalidation par hash de dépendances', () => {
  it('le GenerationContext contient un dependency_hash', async () => {
    const seq = await db.sequence.findFirst({ where: { statut: 'en_cours' }, include: { notions: true } })
    if (!seq) throw new Error('no seq')
    
    const ctx = await compileGenerationContext(seq, { forceRecompile: true })
    expect(ctx.dependency_hash).toBeDefined()
    expect(typeof ctx.dependency_hash).toBe('string')
    expect(ctx.dependency_hash!.length).toBe(16) // SHA-256 tronqué à 16 chars
  })

  it('cache valide : si dépendances inchangées, forceRecompile=false retourne le même contexte', async () => {
    const seq = await db.sequence.findFirst({ where: { statut: 'en_cours' }, include: { notions: true } })
    if (!seq) throw new Error('no seq')
    
    const ctx1 = await compileGenerationContext(seq, { forceRecompile: true })
    const ctx2 = await compileGenerationContext(seq, { forceRecompile: false })
    
    // Même hash de dépendance → cache réutilisé
    expect(ctx2.dependency_hash).toBe(ctx1.dependency_hash)
    expect(ctx2.compiled_at).toBe(ctx1.compiled_at) // pas de recompilation
  })

  it('cache invalidé : si le corpus change, le contexte est recompilé', async () => {
    const seq = await db.sequence.findFirst({ where: { statut: 'en_cours' }, include: { notions: true } })
    if (!seq) throw new Error('no seq')
    
    // Compile une fois
    const ctx1 = await compileGenerationContext(seq, { forceRecompile: true })
    const hash1 = ctx1.dependency_hash
    
    // Modifie le corpus (ajout d'une entrée)
    const testEntry = await db.corpusVectoriel.create({
      data: {
        contenu: 'Test entry for cache invalidation',
        type: 'exemple_pedagogique',
        niveau: '4e', chapitre: 'Test',
        statut: 'brouillon', exemplaire: false,
        embedding: 'pending',
      },
    })
    
    // Recompile — le hash devrait changer car le corpus a changé
    const ctx2 = await compileGenerationContext(seq, { forceRecompile: true })
    expect(ctx2.dependency_hash).not.toBe(hash1)
    
    // Nettoie
    await db.corpusVectoriel.delete({ where: { id: testEntry.id } })
  })

  it('cache invalidé : si le template change, le hash change', async () => {
    const seq = await db.sequence.findFirst({ where: { statut: 'en_cours' }, include: { notions: true } })
    if (!seq) throw new Error('no seq')
    
    const ctx1 = await compileGenerationContext(seq, { forceRecompile: true })
    const hash1 = ctx1.dependency_hash
    
    // Modifie le template
    const template = await db.ficheTemplate.findFirst({ where: { version: 'v1' } })
    if (template) {
      const originalStructure = template.structure
      await db.ficheTemplate.update({
        where: { id: template.id },
        data: { structure: JSON.stringify({ ...JSON.parse(template.structure), modified: true }) },
      })
      
      const ctx2 = await compileGenerationContext(seq, { forceRecompile: true })
      expect(ctx2.dependency_hash).not.toBe(hash1)
      
      // Restaure
      await db.ficheTemplate.update({
        where: { id: template.id },
        data: { structure: originalStructure },
      })
    }
  })

  it('replay identique : si aucune dépendance ne change, le hash est identique', async () => {
    const seq = await db.sequence.findFirst({ where: { statut: 'en_cours' }, include: { notions: true } })
    if (!seq) throw new Error('no seq')
    
    const ctx1 = await compileGenerationContext(seq, { forceRecompile: true })
    const ctx2 = await compileGenerationContext(seq, { forceRecompile: true })
    
    expect(ctx1.dependency_hash).toBe(ctx2.dependency_hash)
  })
})
