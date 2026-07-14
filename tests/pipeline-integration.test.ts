// Tests d'intégration — Pipeline complet (P0-4)
// Vérifie : Planificateur → Knowledge Compiler → Rédacteur → Critique → Superviseur → Export → Commit
// Test de non-régression : replay d'un GenerationContext historique.

import { describe, it, expect } from 'vitest'
import './setup'
import { db } from '@/lib/db'
import { resolve_batch_plan } from '@/lib/pipeline/planificateur'
import { compileGenerationContext } from '@/lib/pipeline/knowledge-compiler'
import { generateSectionPair } from '@/lib/pipeline/redacteur'
import { validateStructurel, validatePedagogique } from '@/lib/pipeline/critique'
import { renderFiche } from '@/lib/pipeline/superviseur'
import { exportLivrable } from '@/lib/export'
import { FICHE_TEMPLATE_V1_SECTIONS } from '@/lib/contracts'
import type { GenerationContext } from '@/lib/contracts'

// ============================================================
// Test d'intégration : pipeline complet (sans LLM — fallback dégradé)
// On appelle chaque étape manuellement pour vérifier la chaîne.
// ============================================================
describe("Pipeline complet — intégration", () => {
  it("chaîne complète : Planificateur → KC → Rédacteur → Critique → Superviseur → Export", async () => {
    // 1. Planificateur
    const plan = await resolve_batch_plan('Géométrie 4e', { max_par_batch: 2 })
    expect(plan.batch_id).toMatch(/^batch-/)
    expect(plan.items.length).toBeGreaterThan(0)
    const item = plan.items[0]
    expect(item.notions.length).toBeGreaterThan(0)

    // 2. Knowledge Compiler — récupère la séquence complète depuis DB
    const seq = await db.sequence.findUnique({
      where: { id: item.sequence_id },
      include: { notions: true },
    })
    expect(seq).not.toBeNull()
    const ctx = await compileGenerationContext(seq!, { forceRecompile: true })
    expect(ctx.notions.length).toBeGreaterThan(0)
    expect(ctx.template_version).toBe('v1')

    // 3. Rédacteur — génère au moins la section 'objectifs'
    //    Note: le LLM peut être rate-limité (429) → on teste le fallback
    const { content: sectionObjectifs, ok } = await generateSectionPair('objectifs', ctx, 'v1')
    expect(sectionObjectifs.section_id).toBe('objectifs')
    expect(sectionObjectifs.contenu).toBeDefined()
    // Si ok=false (LLM KO), le contenu de secours est présent (mais sera rejeté par le critique)
    // Si ok=true, le contenu doit être substantiel
    if (ok) {
      expect(sectionObjectifs.contenu.length).toBeGreaterThan(50)
    }

    // 4. Critique — validation structurelle
    //    On construit des sections valides (assez longues pour chaque seuil min_mots)
    const wordCounts: Record<string, number> = {
      objectifs: 50, prerequis: 50, deroulement: 130, activites: 90,
      differentiation: 50, evaluation: 50, prolongement: 45,
    }
    const validSections = FICHE_TEMPLATE_V1_SECTIONS.map((sid) => ({
      section_id: sid,
      contenu: `Contenu substantiel pour la section ${sid}. `.repeat(Math.ceil((wordCounts[sid] || 50) / 6) + 2),
      methode: null,
    }))
    const structResult = validateStructurel(validSections, ctx)
    expect(structResult.structurel_pass).toBe(true)

    // 5. Superviseur — render
    const rendered = renderFiche(validSections, ctx, { livrable_id: 'liv_test', skill_version: 'v1' })
    expect(rendered.valide).toBe(true)
    expect(rendered.contenu_final.markdown).toBeDefined()

    // 6. Export — 4 formats
    for (const format of ['markdown', 'html', 'docx', 'pdf'] as const) {
      const result = await exportLivrable(rendered, format)
      expect(result.data).toBeDefined()
      expect(result.filename).toBeTruthy()
    }
  }, 60000) // 60s timeout — le LLM peut être lent

  it("Planificateur rejette une demande vide (P0-5)", async () => {
    await expect(resolve_batch_plan('', {})).rejects.toThrow(/demande.*vide/i)
  })

  it("Planificateur ordonne par semaine ASC puis priorite DESC", async () => {
    const plan = await resolve_batch_plan('Géométrie 4e', { max_par_batch: 10 })
    for (let i = 1; i < plan.items.length; i++) {
      const prev = plan.items[i - 1]
      const curr = plan.items[i]
      // semaine ASC : prev.semaine <= curr.semaine
      expect(prev.semaine).toBeLessThanOrEqual(curr.semaine)
      // si même semaine, priorite DESC : prev.priorite >= curr.priorite
      if (prev.semaine === curr.semaine) {
        expect(prev.priorite).toBeGreaterThanOrEqual(curr.priorite)
      }
    }
  })
})

// ============================================================
// Test de non-régression — replay d'un GenerationContext historique
// ============================================================
describe('Non-régression — replay GenerationContext', () => {
  it('un GenerationContext historique peut être rejoué et produit le même render', async () => {
    // Récupère un GenerationContext persisté en DB
    const gcRow = await db.generationContext.findFirst({
      orderBy: { compiledAt: 'desc' },
    })
    if (!gcRow) throw new Error('Aucun GenerationContext en DB')

    const ctx1 = JSON.parse(gcRow.payloadJson) as GenerationContext

    // Reconstruit un render à partir du ctx figé
    const wordCounts: Record<string, number> = {
      objectifs: 50, prerequis: 50, deroulement: 130, activites: 90,
      differentiation: 50, evaluation: 50, prolongement: 45,
    }
    const validSections = FICHE_TEMPLATE_V1_SECTIONS.map((sid) => ({
      section_id: sid,
      contenu: `Contenu replay pour la section ${sid}. `.repeat(Math.ceil((wordCounts[sid] || 50) / 6) + 2),
      methode: null,
    }))

    const rendered1 = renderFiche(validSections, ctx1, { livrable_id: 'liv_replay_1', skill_version: 'v1' })
    const rendered2 = renderFiche(validSections, ctx1, { livrable_id: 'liv_replay_2', skill_version: 'v1' })

    // Les deux renders doivent être identiques (hors livrable_id)
    const { livrable_id: _l1, ...r1rest } = rendered1
    const { livrable_id: _l2, ...r2rest } = rendered2
    expect(JSON.stringify(r1rest)).toBe(JSON.stringify(r2rest))
  })

  it('un GenerationContext figé ne change pas après recompilation (hors compiled_at)', async () => {
    const seq = await db.sequence.findFirst({
      where: { statut: 'validee' },
      include: { notions: true },
    })
    if (!seq) throw new Error('Aucune séquence validée')

    const ctx1 = await compileGenerationContext(seq, { forceRecompile: true })
    const ctx2 = await compileGenerationContext(seq, { forceRecompile: true })

    const { compiled_at: _a1, ...rest1 } = ctx1
    const { compiled_at: _a2, ...rest2 } = ctx2

    expect(JSON.stringify(rest1)).toBe(JSON.stringify(rest2))
  })
})

// ============================================================
// Test de la couche Critique 2 — pédagogique (v1/v2)
// ============================================================
describe('Critique pédagogique — 2 couches', () => {
  it('la couche structurel est toujours exécutée avant la pédagogique', () => {
    // On ne peut pas tester directement l'ordre depuis l'extérieur,
    // mais on peut vérifier que validatePedagogique n'est jamais appelée
    // si structurel fail — c'est l'orchestrateur qui gère ça.
    // Ici on vérifie juste que validateStructurel est synchrone (pas d'await LLM).
    const ctx: GenerationContext = {
      sequence_id: 's1',
      sequence_titre: 't',
      notions: [{ notion_id: 'n', nom: 'n', competences: ['c'], objectifs: ['o'], prerequis_ids: [], niveau: '4e', chapitre: 'G' }],
      exemples_pedagogiques: [],
      references_style: [],
      regles: {},
      contexte_classe: null,
      template_version: 'v1',
      curriculum_version: 'v1',
      compiled_at: '2026-01-01T00:00:00.000Z',
    }
    const sections = [{ section_id: 'objectifs', contenu: 'trop court', methode: null }]
    const result = validateStructurel(sections, ctx)
    expect(result.structurel_pass).toBe(false)
    expect(result.couche_declenchee).toBe('structurel')
    expect(result.pedagogique_pass).toBeNull() // pas exécutée
  })
})
