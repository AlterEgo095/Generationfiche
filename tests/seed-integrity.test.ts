// Tests — Seed Data Integrity (P1-1 Sprint 3)
// Vérifie qu'aucun livrable seed n'est marqué valide sans validation réelle.

import { describe, it, expect } from 'vitest'
import './setup'
import { db } from '@/lib/db'
import { validateStructurel } from '@/lib/pipeline/critique'
import type { GenerationContext, SectionContent } from '@/lib/contracts'

// ============================================================
// Seed livrables — doivent être des placeholders, pas des fiches validées
// ============================================================
describe('Seed Data Integrity — Aucune donnée fictive comme production', () => {
  it('aucun livrable seed n\'est marqué valide=true', async () => {
    const livrables = await db.livrable.findMany()
    const valides = livrables.filter((l) => l.valide === true)
    expect(valides.length).toBe(0)
  })

  it('les livrables seed ont type="placeholder" (pas "fiche")', async () => {
    const livrables = await db.livrable.findMany()
    for (const l of livrables) {
      expect(l.type).toBe('placeholder')
    }
  })

  it('les livrables seed ont valide=false', async () => {
    const livrables = await db.livrable.findMany()
    for (const l of livrables) {
      expect(l.valide).toBe(false)
    }
  })

  it('les validations associées sont honnêtes (structurelPass=false pour placeholder)', async () => {
    const livrables = await db.livrable.findMany({ include: { validations: true } })
    for (const l of livrables) {
      if (l.type === 'placeholder') {
        const v = l.validations[0]
        expect(v).toBeDefined()
        expect(v.structurelPass).toBe(false)
        expect(v.pedagogiquePass).toBeNull()
      }
    }
  })

  it('aucune séquence n\'est marquée "validee" sans livrable valide', async () => {
    const seqs = await db.sequence.findMany({ include: { livrables: true } })
    for (const s of seqs) {
      if (s.statut === 'validee') {
        const hasValideLivrable = s.livrables.some((l) => l.valide === true)
        expect(hasValideLivrable).toBe(true)
      }
    }
  })

  it('le contenu des livrables placeholder contient le mot "Placeholder"', async () => {
    const livrables = await db.livrable.findMany()
    for (const l of livrables) {
      const c = JSON.parse(l.contenuJson)
      const markdown = c.markdown || ''
      const sections = c.sections || []
      const allText = markdown + sections.map((s: any) => s.contenu || '').join(' ')
      expect(allText).toMatch(/[Pp]laceholder/)
    }
  })

  it('les agent_runs de trace existent pour les livrables placeholder', async () => {
    const seqs = await db.sequence.findMany({ where: { statut: 'en_cours' }, include: { livrables: true } })
    for (const s of seqs) {
      if (s.livrables.length > 0) {
        const runs = await db.agentRun.findMany({ where: { sequenceId: s.id } })
        expect(runs.length).toBeGreaterThanOrEqual(5) // 5 étapes du pipeline
      }
    }
  })
})
