// Outbox worker — P1-3 (Sprint 3)
// Extrait de l'orchestrateur pour éviter les dépendances circulaires et alléger les imports API.

import { db } from '@/lib/db'
import type { PipelineEvent } from '@/lib/contracts'

const PIPELINE_WS_URL = 'http://127.0.0.1:3004/emit'
const BACKOFF_DELAYS_MS = [1000, 3000, 10000]

// ============================================================
// processOutbox — worker qui délivre les events en attente
// Appelé périodiquement par l'API ou manuellement.
// ============================================================
export async function processOutbox(limit = 20): Promise<{ processed: number; delivered: number; failed: number }> {
  const pending = await db.eventOutbox.findMany({
    where: {
      status: 'pending',
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let delivered = 0
  let failed = 0

  for (const evt of pending) {
    const attempts = evt.attempts + 1
    const payload: PipelineEvent = {
      batch_id: evt.batchId || '',
      sequence_id: evt.sequenceId ?? undefined,
      agent: evt.agent as PipelineEvent['agent'],
      skill: evt.skill ?? undefined,
      phase: evt.phase as PipelineEvent['phase'],
      message: evt.message,
      payload: evt.payload ? JSON.parse(evt.payload) : undefined,
      timestamp: evt.createdAt.toISOString(),
    }

    try {
      const resp = await fetch(PIPELINE_WS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: evt.batchId, event: payload }),
        signal: AbortSignal.timeout(3000),
      })
      if (resp.ok) {
        await db.eventOutbox.update({
          where: { id: evt.id },
          data: { status: 'delivered', attempts, deliveredAt: new Date() },
        })
        delivered++
      } else {
        throw new Error(`WS returned ${resp.status}`)
      }
    } catch {
      if (attempts >= evt.maxAttempts) {
        await db.eventOutbox.update({
          where: { id: evt.id },
          data: { status: 'failed_delivery', attempts },
        })
        failed++
      } else {
        const delayMs = BACKOFF_DELAYS_MS[attempts - 1] ?? 10000
        await db.eventOutbox.update({
          where: { id: evt.id },
          data: { attempts, nextRetryAt: new Date(Date.now() + delayMs) },
        })
      }
    }
  }

  return { processed: pending.length, delivered, failed }
}
