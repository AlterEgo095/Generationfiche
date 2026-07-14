// Tests — Knowledge Coverage (P1-4 Sprint 3)
// Vérifie que retrieve_style_reference ne retourne JAMAIS [] pour une discipline supportée.

import { describe, it, expect } from 'vitest'
import './setup'
import { db } from '@/lib/db'
import { retrieve_style_reference } from '@/lib/pipeline/knowledge-compiler'

// ============================================================
// Couverture du corpus — 6 disciplines
// ============================================================
describe('Knowledge Base Coverage — 6 disciplines', () => {
  it('contient au moins 6 disciplines différentes', async () => {
    const notions = await db.notion.findMany()
    const chapitres = new Set(notions.map((n) => n.chapitre))
    // Maths (3 chapitres) + SVT + Français + Histoire + Géo + Physique
    expect(chapitres.size).toBeGreaterThanOrEqual(10)
  })

  it('couvre les 3 niveaux (6e, 5e, 4e)', async () => {
    const notions = await db.notion.findMany()
    const niveaux = new Set(notions.map((n) => n.niveau))
    expect(niveaux.has('6e')).toBe(true)
    expect(niveaux.has('5e')).toBe(true)
    expect(niveaux.has('4e')).toBe(true)
  })

  it('chaque combo (niveau, chapitre) a au moins 1 fiche exemplaire — retrieve_style_reference ne retourne JAMAIS []', async () => {
    const notions = await db.notion.findMany()
    const combos = new Set(notions.map((n) => `${n.niveau}/${n.chapitre}`))
    
    for (const combo of combos) {
      const [niveau, chapitre] = combo.split('/')
      const refs = await retrieve_style_reference(niveau, chapitre, 3)
      expect(refs.length, `Combo ${combo} devrait avoir au moins 1 exemplaire`).toBeGreaterThan(0)
      // Toutes les refs doivent être du bon niveau et chapitre (filtre strict P0-2)
      for (const r of refs) {
        expect(r.niveau).toBe(niveau)
        expect(r.chapitre).toBe(chapitre)
      }
    }
  })

  it('les références retournées sont cohérentes avec la discipline', async () => {
    // Français 6e/Grammaire → la référence doit parler de grammaire/mots
    const refs = await retrieve_style_reference('6e', 'Grammaire', 3)
    expect(refs.length).toBeGreaterThan(0)
    const contenu = refs[0].extrait.toLowerCase()
    expect(contenu).toMatch(/grammaire|mot|classe|phrase|verbe|nom/)
  })

  it('les références Histoire parlent d\'histoire', async () => {
    const refs = await retrieve_style_reference('4e', 'Révolution et Empire', 3)
    expect(refs.length).toBeGreaterThan(0)
    const contenu = refs[0].extrait.toLowerCase()
    expect(contenu).toMatch(/révolution|1789|droits|privilèges|bastille/)
  })

  it('les références Physique parlent de physique', async () => {
    const refs = await retrieve_style_reference('4e', 'Énergie', 3)
    expect(refs.length).toBeGreaterThan(0)
    const contenu = refs[0].extrait.toLowerCase()
    expect(contenu).toMatch(/énergie|cinétique|potentielle|conversion|joule/)
  })

  it('chaque discipline a des exemples pédagogiques', async () => {
    const chapitresAvecExemples = await db.corpusVectoriel.findMany({
      where: { type: 'exemple_pedagogique' },
      select: { chapitre: true, niveau: true },
    })
    const combos = new Set(chapitresAvecExemples.map((e) => `${e.niveau}/${e.chapitre}`))
    // Au moins 6 disciplines représentées
    expect(combos.size).toBeGreaterThanOrEqual(8)
  })

  it('le corpus contient au moins 10 fiches exemplaires (référence de style)', async () => {
    const count = await db.corpusVectoriel.count({
      where: { type: 'fiche_reference', exemplaire: true, statut: 'validee' },
    })
    expect(count).toBeGreaterThanOrEqual(10)
  })
})
