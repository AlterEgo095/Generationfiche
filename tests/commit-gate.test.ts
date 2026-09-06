// Tests — Commit Gate (F-31) : le commit rejoue la chaîne complète des gates
// et devient idempotent (EXP C3 : valide=!hasError contournait le quality gate).

import { describe, it, expect, afterAll } from 'vitest'
import './setup'
import { db } from '@/lib/db'
import { commitBatch } from '@/lib/pipeline/superviseur'
import { PUBLICATION_THRESHOLD } from '@/lib/quality-gate'

const createdSequenceIds: string[] = []
const createdBatchIds: string[] = []

async function seedScenario(p: {
  batchId: string
  score: number | null
  structurelPass: boolean
  pedagogiquePass: boolean | null
  agentRunError: boolean
}): Promise<{ sequenceId: string; livrableId: string }> {
  const seq = await db.sequence.create({
    data: {
      titre: `Test commit gate ${p.batchId}`,
      notionIds: '[]',
      niveau: '4e',
      chapitre: 'Géométrie',
      semaine: 1,
      statut: 'en_cours',
    },
  })
  createdSequenceIds.push(seq.id)

  const contenuJson = p.score === null
    ? JSON.stringify({ sections: [] })
    : JSON.stringify({ pedagogical_score: { score: p.score } })

  const livrable = await db.livrable.create({
    data: {
      sequenceId: seq.id,
      type: 'fiche',
      contenuJson,
      format: 'markdown',
      valide: false,
      skillVersion: 'v1',
    },
  })

  await db.validationResult.create({
    data: {
      livrableId: livrable.id,
      structurelPass: p.structurelPass,
      structurelRaisons: '[]',
      pedagogiquePass: p.pedagogiquePass,
      pedagogiqueRaisons: '[]',
      sectionARegenerer: null,
      coucheDeclenchee: p.pedagogiquePass === null ? 'structurel' : 'pedagogique',
      skillVersion: 'v1',
    },
  })

  // Runs du batch : redacteur (ok ou error) + critique (ok)
  await db.agentRun.create({
    data: {
      sequenceId: seq.id,
      batchId: p.batchId,
      agent: 'redacteur',
      skill: 'generate_section_pair_v1',
      input: '{}',
      output: '{}',
      decision: 'continue',
      durationMs: 10,
      statut: p.agentRunError ? 'error' : 'ok',
    },
  })
  await db.agentRun.create({
    data: {
      sequenceId: seq.id,
      batchId: p.batchId,
      agent: 'critique',
      skill: 'validate_pedagogique_v1',
      input: '{}',
      output: '{}',
      decision: 'continue',
      durationMs: 10,
      statut: 'ok',
    },
  })

  return { sequenceId: seq.id, livrableId: livrable.id }
}

afterAll(async () => {
  // Cleanup explicite (cascades : validationResult et agentRuns via livrable/séquence)
  for (const bid of createdBatchIds) {
    await db.agentRun.deleteMany({ where: { batchId: bid } })
  }
  for (const sid of createdSequenceIds) {
    await db.validationResult.deleteMany({ where: { livrable: { sequenceId: sid } } })
    await db.livrable.deleteMany({ where: { sequenceId: sid } })
    await db.sequence.deleteMany({ where: { id: sid } }).catch(() => {})
  }
})

describe('Commit Gate — F-31 (valide ≠ !hasError)', () => {
  it('toutes gates OK → livrable validé, séquence validée, committed=1', async () => {
    const batchId = `batch-test-ok-${Date.now()}`
    createdBatchIds.push(batchId)
    const { sequenceId, livrableId } = await seedScenario({
      batchId,
      score: 95,
      structurelPass: true,
      pedagogiquePass: true,
      agentRunError: false,
    })

    const res = await commitBatch(batchId)
    expect(res.committed).toBe(1)
    const item = res.items.find((i) => i.sequence_id === sequenceId)
    expect(item?.statut).toBe('validee')
    expect(item?.gate?.ok).toBe(true)

    const livrable = await db.livrable.findUnique({ where: { id: livrableId } })
    expect(livrable?.valide).toBe(true)
    const seq = await db.sequence.findUnique({ where: { id: sequenceId } })
    expect(seq?.statut).toBe('validee')
  })

  it('critique LLM veto (pedagogiquePass=false) → NON validé malgré 0 erreur, en_attente', async () => {
    const batchId = `batch-test-veto-${Date.now()}`
    createdBatchIds.push(batchId)
    const { sequenceId, livrableId } = await seedScenario({
      batchId,
      score: 100, // même un score parfait…
      structurelPass: true,
      pedagogiquePass: false, // …la critique LLM dit NON
      agentRunError: false,
    })

    const res = await commitBatch(batchId)
    expect(res.committed).toBe(0)
    const item = res.items.find((i) => i.sequence_id === sequenceId)
    expect(item?.statut).toBe('en_attente')
    expect(item?.gate?.ok).toBe(false)
    expect(item?.gate?.reasons.join(' ')).toContain('pédagogique')

    const livrable = await db.livrable.findUnique({ where: { id: livrableId } })
    expect(livrable?.valide).toBe(false)
  })

  it('score pédagogique < seuil → NON validé (quality gate rejoué au commit)', async () => {
    const batchId = `batch-test-score-${Date.now()}`
    createdBatchIds.push(batchId)
    const { sequenceId } = await seedScenario({
      batchId,
      score: PUBLICATION_THRESHOLD - 1, // 79
      structurelPass: true,
      pedagogiquePass: true,
      agentRunError: false,
    })

    const res = await commitBatch(batchId)
    expect(res.committed).toBe(0)
    const item = res.items.find((i) => i.sequence_id === sequenceId)
    expect(item?.statut).toBe('en_attente')
    expect(item?.gate?.reasons.join(' ')).toContain('score pédagogique')
  })

  it('score absent du rendu → NON validé (pessimiste)', async () => {
    const batchId = `batch-test-noscore-${Date.now()}`
    createdBatchIds.push(batchId)
    const { sequenceId } = await seedScenario({
      batchId,
      score: null,
      structurelPass: true,
      pedagogiquePass: true,
      agentRunError: false,
    })

    const res = await commitBatch(batchId)
    expect(res.committed).toBe(0)
    const item = res.items.find((i) => i.sequence_id === sequenceId)
    expect(item?.gate?.reasons.join(' ')).toContain('absent')
  })

  it('agent_run en erreur → NON validé, séquence en_cours (comportement antérieur préservé)', async () => {
    const batchId = `batch-test-err-${Date.now()}`
    createdBatchIds.push(batchId)
    const { sequenceId } = await seedScenario({
      batchId,
      score: 90,
      structurelPass: true,
      pedagogiquePass: true,
      agentRunError: true,
    })

    const res = await commitBatch(batchId)
    expect(res.committed).toBe(0)
    const item = res.items.find((i) => i.sequence_id === sequenceId)
    expect(item?.statut).toBe('en_cours')
  })

  it('idempotence : rejouer le batch ne duplique pas les commits (EXP C3)', async () => {
    const batchId = `batch-test-idem-${Date.now()}`
    createdBatchIds.push(batchId)
    await seedScenario({
      batchId,
      score: 90,
      structurelPass: true,
      pedagogiquePass: true,
      agentRunError: false,
    })

    const first = await commitBatch(batchId)
    expect(first.committed).toBe(1)

    const second = await commitBatch(batchId)
    expect(second.committed).toBe(0) // rien de nouveau commité
    expect(second.items.every((i) => i.statut === 'deja_committed')).toBe(true)

    const commitRuns = await db.agentRun.findMany({
      where: { batchId, agent: 'superviseur', skill: 'commit_batch_v1' },
    })
    expect(commitRuns).toHaveLength(1) // un seul run de commit malgré 2 appels
  })
})
