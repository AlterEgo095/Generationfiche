// Système — Observabilité production (P4-1 + P4-4 Sprint 4)
// Métriques en mémoire pour monitoring temps réel.

import { llmRateLimiter } from '@/lib/llm-limiter'

interface MetricEntry {
  timestamp: number
  value: number
  metadata?: Record<string, unknown>
}

class MetricsStore {
  private counters: Map<string, number> = new Map()
  private latencies: Map<string, MetricEntry[]> = new Map()
  private readonly maxLatencyEntries = 1000

  // Compteurs
  incrementCounter(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + by)
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0
  }

  getAllCounters(): Record<string, number> {
    return Object.fromEntries(this.counters)
  }

  // Latences
  recordLatency(name: string, ms: number, metadata?: Record<string, unknown>): void {
    if (!this.latencies.has(name)) this.latencies.set(name, [])
    const entries = this.latencies.get(name)!
    entries.push({ timestamp: Date.now(), value: ms, metadata })
    if (entries.length > this.maxLatencyEntries) {
      entries.splice(0, entries.length - this.maxLatencyEntries)
    }
  }

  getLatencyStats(name: string): { p50: number; p95: number; p99: number; count: number; avg: number } | null {
    const entries = this.latencies.get(name)
    if (!entries || entries.length === 0) return null
    const values = entries.map((e) => e.value).sort((a, b) => a - b)
    const count = values.length
    const avg = values.reduce((a, b) => a + b, 0) / count
    return {
      p50: values[Math.floor(count * 0.5)] || 0,
      p95: values[Math.floor(count * 0.95)] || 0,
      p99: values[Math.floor(count * 0.99)] || 0,
      count,
      avg: Math.round(avg),
    }
  }

  getAllLatencyStats(): Record<string, ReturnType<MetricsStore['getLatencyStats']>> {
    const result: Record<string, unknown> = {}
    for (const name of this.latencies.keys()) {
      result[name] = this.getLatencyStats(name)
    }
    return result
  }

  // Snapshot complet
  snapshot() {
    return {
      counters: this.getAllCounters(),
      latencies: this.getAllLatencyStats(),
      llm_limiter: llmRateLimiter.getStatus(),
      timestamp: new Date().toISOString(),
    }
  }

  reset(): void {
    this.counters.clear()
    this.latencies.clear()
  }
}

export const metrics = new MetricsStore()

// Helpers pour mesurer une fonction async
export async function measure<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    metrics.recordLatency(name, Date.now() - start, metadata)
    metrics.incrementCounter(`${name}_completed`)
    return result
  } catch (e) {
    metrics.recordLatency(name, Date.now() - start, { ...metadata, error: e instanceof Error ? e.message : String(e) })
    metrics.incrementCounter(`${name}_failed`)
    throw e
  }
}

export function measureSync<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
  const start = Date.now()
  try {
    const result = fn()
    metrics.recordLatency(name, Date.now() - start, metadata)
    metrics.incrementCounter(`${name}_completed`)
    return result
  } catch (e) {
    metrics.recordLatency(name, Date.now() - start, { ...metadata, error: e instanceof Error ? e.message : String(e) })
    metrics.incrementCounter(`${name}_failed`)
    throw e
  }
}
