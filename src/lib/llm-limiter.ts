// LLM Rate Limiter + Circuit Breaker — P1-5 (Sprint 3 Phase 5)
// Protège contre les 429 et les pannes LLM.
//
// Architecture :
//   - Rate limiter : max N appels simultanés, queue FIFO
//   - Circuit breaker : 3 erreurs consécutives → OPEN (pause 30s) → HALF-OPEN (1 test) → CLOSED
//   - Retry avec backoff exponentiel : 1s, 2s, 4s (max 3 retries)

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export class LLMRateLimiter {
  private queue: Array<() => void> = []
  private active = 0
  private consecutiveErrors = 0
  private circuitState: CircuitState = 'CLOSED'
  private circuitOpenedAt = 0
  private readonly maxConcurrent: number
  private readonly circuitThreshold = 3
  private readonly circuitCooldownMs = 30000

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent
  }

  // Acquiert un slot — bloque si max concurrent atteint ou circuit OPEN
  async acquire(): Promise<void> {
    // Circuit breaker check
    if (this.circuitState === 'OPEN') {
      const elapsed = Date.now() - this.circuitOpenedAt
      if (elapsed > this.circuitCooldownMs) {
        this.circuitState = 'HALF_OPEN'
      } else {
        throw new Error(`Circuit breaker OPEN — LLM indisponible (pause ${Math.ceil((this.circuitCooldownMs - elapsed) / 1000)}s)`)
      }
    }

    // Rate limiter
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.active++
  }

  // Libère le slot et enregistre le succès/échec
  release(success: boolean): void {
    this.active--
    if (success) {
      this.consecutiveErrors = 0
      if (this.circuitState === 'HALF_OPEN') {
        this.circuitState = 'CLOSED'
      }
    } else {
      this.consecutiveErrors++
      if (this.consecutiveErrors >= this.circuitThreshold) {
        this.circuitState = 'OPEN'
        this.circuitOpenedAt = Date.now()
      }
    }
    // Débloque le suivant dans la queue
    const next = this.queue.shift()
    if (next) next()
  }

  // Exécute une fonction LLM avec rate limiting, retry et circuit breaker
  async execute<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null
    const backoffMs = [1000, 2000, 4000]

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.acquire()
        try {
          const result = await fn()
          this.release(true)
          return result
        } catch (e) {
          this.release(false)
          throw e
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        // Circuit breaker OPEN → pas de retry
        if (lastError.message.includes('Circuit breaker OPEN')) {
          throw lastError
        }
        // Dernier essai → lance l'erreur
        if (attempt >= maxRetries) {
          throw lastError
        }
        // Backoff avant retry
        const delay = backoffMs[attempt] ?? 4000
        await new Promise((r) => setTimeout(r, delay))
      }
    }
    throw lastError!
  }

  // État du circuit (pour monitoring)
  getStatus(): { state: CircuitState; active: number; queued: number; consecutiveErrors: number } {
    return {
      state: this.circuitState,
      active: this.active,
      queued: this.queue.length,
      consecutiveErrors: this.consecutiveErrors,
    }
  }

  // Reset complet (pour tests)
  reset(): void {
    this.queue = []
    this.active = 0
    this.consecutiveErrors = 0
    this.circuitState = 'CLOSED'
    this.circuitOpenedAt = 0
  }
}

// Singleton — partagé entre tous les agents LLM
export const llmRateLimiter = new LLMRateLimiter(
  parseInt(process.env.MAX_CONCURRENT_LLM || '3', 10),
)
