// Tests — Critique LLM Fail-Safe (P1-2 Sprint 3)
// Vérifie qu'aucune fiche non évaluée ne peut être acceptée (pedagogique_pass=false si LLM KO).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validatePedagogique } from '@/lib/pipeline/critique'
import { llmRateLimiter } from '@/lib/llm-limiter'
import type { GenerationContext, SectionContent } from '@/lib/contracts'
import { FICHE_TEMPLATE_V1_SECTIONS } from '@/lib/contracts'

// Mock du SDK LLM pour simuler les pannes
vi.mock('z-ai-web-dev-sdk', () => ({
  default: {
    create: vi.fn(),
  },
}))

import ZAI from 'z-ai-web-dev-sdk'

// Reset du rate limiter entre les tests (évite que le circuit breaker reste OPEN)
beforeEach(() => {
  vi.clearAllMocks()
  llmRateLimiter.reset()
})

// ============================================================
// Helpers
// ============================================================
function makeCtx(): GenerationContext {
  return {
    sequence_id: 'seq_test',
    sequence_titre: 'Test',
    notions: [{
      notion_id: 'n1', nom: 'Test', competences: ['c1'], objectifs: ['o1'],
      prerequis_ids: [], niveau: '4e', chapitre: 'Géométrie',
    }],
    exemples_pedagogiques: [],
    references_style: [],
    regles: {},
    contexte_classe: null,
    template_version: 'v1',
    curriculum_version: 'v1',
    compiled_at: '2026-01-01T00:00:00.000Z',
  }
}

function makeSections(): SectionContent[] {
  return FICHE_TEMPLATE_V1_SECTIONS.map((sid) => ({
    section_id: sid,
    contenu: `Contenu substantiel pour la section ${sid}. `.repeat(15),
    methode: null,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// Scénarios de panne LLM — tous doivent donner pedagogique_pass=false
// ============================================================
describe('Critique LLM Fail-Safe — Aucune validation automatique', () => {
  it('timeout LLM → pedagogique_pass=false', async () => {
    vi.mocked(ZAI.create).mockRejectedValueOnce(new Error('Request timeout after 30000ms'))
    const result = await validatePedagogique(makeSections(), makeCtx(), 'v1')
    expect(result.pedagogique_pass).toBe(false)
    expect(result.pedagogique_raisons?.[0]).toMatch(/service critique indisponible|timeout/i)
    expect(result.ok).toBe(false)
    expect(result.section_a_regenerer).not.toBeNull()
  })

  it('429 rate limit → pedagogique_pass=false', async () => {
    vi.mocked(ZAI.create).mockRejectedValueOnce(new Error('API request failed with status 429: Too many requests'))
    const result = await validatePedagogique(makeSections(), makeCtx(), 'v1')
    expect(result.pedagogique_pass).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('500 server error → pedagogique_pass=false', async () => {
    vi.mocked(ZAI.create).mockRejectedValueOnce(new Error('API request failed with status 500: Internal Server Error'))
    const result = await validatePedagogique(makeSections(), makeCtx(), 'v1')
    expect(result.pedagogique_pass).toBe(false)
  })

  it('réponse LLM vide → pedagogique_pass=false (scores à 0)', async () => {
    vi.mocked(ZAI.create).mockResolvedValueOnce({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
            choices: [{ message: { content: '' } }],
          }),
        },
      },
    } as any)
    const result = await validatePedagogique(makeSections(), makeCtx(), 'v1')
    // Réponse vide → parseCritiqueJSON retourne {scores:{}} → dimensions manquantes notées 0 (pas 4 !)
    // Puisque 0 < 3 → allSufficient=false → pedagogique_pass=false
    expect(result.pedagogique_pass).toBe(false)
  })

  it('JSON invalide → pedagogique_pass=false (scores à 0)', async () => {
    vi.mocked(ZAI.create).mockResolvedValueOnce({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({
            choices: [{ message: { content: 'ceci n est pas du json {{{{' } }],
          }),
        },
      },
    } as any)
    const result = await validatePedagogique(makeSections(), makeCtx(), 'v1')
    expect(result.pedagogique_pass).toBe(false)
  })

  it('réseau coupé (fetch failed) → pedagogique_pass=false', async () => {
    vi.mocked(ZAI.create).mockRejectedValueOnce(new Error('fetch failed'))
    const result = await validatePedagogique(makeSections(), makeCtx(), 'v1')
    expect(result.pedagogique_pass).toBe(false)
  })

  it('JAMAIS pedagogique_pass=true quand LLM indisponible — invariant absolu', async () => {
    // On teste 5 erreurs différentes
    const erreurs = [
      new Error('timeout'),
      new Error('429 rate limit'),
      new Error('500 server'),
      new Error('ECONNREFUSED'),
      new Error('socket hang up'),
    ]
    for (const err of erreurs) {
      vi.mocked(ZAI.create).mockRejectedValueOnce(err)
      const result = await validatePedagogique(makeSections(), makeCtx(), 'v1')
      expect(result.pedagogique_pass).toBe(false)
    }
  })

  it('traçabilité conservée : ok=false, error message, section_a_regenerer présent', async () => {
    vi.mocked(ZAI.create).mockRejectedValue(new Error('test error'))
    const result: any = await validatePedagogique(makeSections(), makeCtx(), 'v1')
    expect(result.ok).toBe(false)
    // R-12 v2 : l'invariant « traçabilité conservée » = un message d'erreur NON VIDE
    // est toujours capté (le message exact dépend du chemin de panne simulée et du
    // nombre de tentatives du gouverneur : 'test error', 'Circuit breaker OPEN',
    // ou l'erreur de la dernière tentative de la file de mock).
    expect(typeof result.error).toBe('string')
    expect(result.error.length).toBeGreaterThan(0)
    expect(result.section_a_regenerer).not.toBeNull()
    expect(result.couche_declenchee).toBe('pedagogique')
  })
})
