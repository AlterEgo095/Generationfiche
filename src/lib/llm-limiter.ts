// LLM Rate Limiter + Circuit Breaker — P1-5 (Sprint 3 Phase 5)
// Protège contre les 429 et les pannes LLM.
//
// Architecture :
//   - Rate limiter : max N appels simultanés, queue FIFO
//   - Circuit breaker : 3 erreurs consécutives → OPEN (pause 30s) → HALF-OPEN (1 test) → CLOSED
//   - Retry avec backoff exponentiel : 1s, 2s, 4s (max 3 retries)
//
// R-12 (Fermé F-33) : PACING GLOBAL INTÉGRÉ — espacement minimum entre les
// DÉBUTS d'appels LLM (LLM_MIN_SPACING_MS, défaut 2500ms). Preuve d'audit :
// paced 2.5s → p50 3.9s / p95 5.2s, 24/24 OK, 0 tempête 429 ; non-paced →
// p95 12.7s, 30/56 échecs, circuit breaker OPEN. Le pacing s'applique au
// singleton partagé : le débit est borné à l'échelle PLATEFORME, quel que
// soit le nombre de pipelines en vol (complément du PipelineGate).
//
// R-12 v2 — PACING ADAPTATIF AIMD (revalidation v3 à frais nouveaux) : le
// pacing FIXE 2.5s reste insuffisant quand le quota glissant du fournisseur
// est entamé : 7× 429 réels ("Too many requests") → 3 échecs consécutifs →
// circuit OPEN → escalade. Or un 429 n'est pas une PANNE, c'est un SIGNAL
// DE RÉGULATION. Correctif :
//   1. Un 429 fournisseur ne compte PLUS dans consecutiveErrors (circuit
//      breaker réservé aux pannes systémiques : 5xx, réseau, timeout).
//   2. Chaque 429 DOUBLE l'espacement adaptatif (AIMD, cap 30s) — le débit
//      s'effondre doucement jusqu'à passer sous la limite réelle.
//   3. Sur 429, le backoff de retry devient max(backoff standard, espacement
//      adaptatif courant) → retries espacés au lieu de re-tempête (1/2/4s),
//      et le budget de retries est étendu à 5 (vs 3) pour absorber une
//      fenêtre de quota sec de ~2,5 min sans escalader de section saine.
//   4. Chaque succès redescent l'espacement de 500ms vers le plancher
//      (minSpacingMs) — auto-calibration permanente.
// Réversibilité : LLM_GOVERNOR=off → pacing 0 (comportement antérieur).

// Détecte une erreur de RATE-LIMIT fournisseur (régulation de débit),
// à distinguer d'une panne systémique (5xx, réseau, timeout).
export function isRateLimitError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  const m = msg.toLowerCase()
  return m.includes('429') || m.includes('too many requests') || m.includes('rate limit')
}

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
  // R-12 : pacing global (espacement minimal entre débuts d'appels)
  private readonly minSpacingMs: number
  // R-12 v2 : espacement ADAPTATIF courant (AIMD : ×2 sur 429, −500ms par succès)
  private adaptiveSpacingMs: number
  private rateLimitHits = 0
  private readonly maxAdaptiveSpacingMs = 30000
  private lastStartAt = 0

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent
    const governorOff = (process.env.LLM_GOVERNOR || 'on') === 'off'
    this.minSpacingMs = governorOff
      ? 0
      : Math.max(0, parseInt(process.env.LLM_MIN_SPACING_MS || '2500', 10))
    this.adaptiveSpacingMs = this.minSpacingMs
  }

  // R-12 v2 : espacement effectivement appliqué = max(plancher, adaptatif)
  private get currentSpacingMs(): number {
    return Math.max(this.minSpacingMs, this.adaptiveSpacingMs)
  }

  // Acquiert un slot — bloque si max concurrent atteint ou circuit OPEN
  // R-12 : applique ensuite le pacing global (espacement entre débuts d'appels)
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

    // R-12 : pacing — attends l'espacement minimum depuis le dernier DÉBUT d'appel
    // R-12 v2 : espacement ADAPTATIF (monte sur 429, descend sur succès)
    const spacing = this.currentSpacingMs
    if (spacing > 0) {
      const now = Date.now()
      const earliestAllowed = this.lastStartAt + spacing
      if (now < earliestAllowed) {
        await new Promise((r) => setTimeout(r, earliestAllowed - now))
      }
      this.lastStartAt = Date.now()
    }
  }

  // Libère le slot et enregistre le succès/échec
  // R-12 v2 : rateLimited=true → 429 fournisseur = signal de régulation :
  //   double l'espacement adaptatif (AIMD, cap 30s), ne touche PAS le circuit.
  release(success: boolean, rateLimited = false): void {
    this.active--
    if (rateLimited) {
      this.rateLimitHits++
      this.adaptiveSpacingMs = Math.min(
        Math.max(this.adaptiveSpacingMs, this.minSpacingMs) * 2,
        this.maxAdaptiveSpacingMs,
      )
    } else if (success) {
      this.consecutiveErrors = 0
      // R-12 v2 : redescente additive (−500ms/succès) vers le plancher
      if (this.adaptiveSpacingMs > this.minSpacingMs) {
        this.adaptiveSpacingMs = Math.max(this.minSpacingMs, this.adaptiveSpacingMs - 500)
      }
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
  // R-12 v2 : la boucle est bornée par le budget ÉTENDU (5 retries sur 429).
  // Le tri standard/étendu se fait dans le catch : une panne (500, réseau)
  // épuise le budget standard (maxRetries), un 429 bénéficie du budget étendu.
  async execute<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null
    const backoffMs = [1000, 2000, 4000]
    const hardMaxAttempts = Math.max(maxRetries, 5)

    for (let attempt = 0; attempt <= hardMaxAttempts; attempt++) {
      try {
        await this.acquire()
        try {
          const result = await fn()
          this.release(true)
          return result
        } catch (e) {
          // R-12 v2 : un 429 fournisseur est une régulation, pas une panne
          this.release(false, isRateLimitError(e))
          throw e
        }
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        const rateLimited = isRateLimitError(lastError)
        // Circuit breaker OPEN → pas de retry
        if (lastError.message.includes('Circuit breaker OPEN')) {
          throw lastError
        }
        // R-12 v2 : budget de retries ÉTENDU sur 429 (5 au lieu de 3) :
        // à 30s d'espacement adaptatif (cap), ça donne jusqu'à ~2,5 min de
        // patience par appel — une fenêtre de quota sec est absorbée au lieu
        // d'escalader une section saine. Revalidation v3b : 4 escalades à
        // 12:09 causées par 3 retries × ~30s insuffisants face à une fenêtre
        // de quota épuisé > 90s (sections vides → échec structurel → escalade).
        const effectiveMaxRetries = rateLimited ? Math.max(maxRetries, 5) : maxRetries
        // Dernier essai → lance l'erreur
        if (attempt >= effectiveMaxRetries) {
          throw lastError
        }
        // Backoff avant retry
        // R-12 v2 : sur 429, backoff long = espacement adaptatif courant
        // (déjà doublé par release) → retries espacés, pas de re-tempête
        const delay = rateLimited
          ? Math.max(backoffMs[attempt] ?? 4000, this.currentSpacingMs)
          : backoffMs[attempt] ?? 4000
        await new Promise((r) => setTimeout(r, delay))
      }
    }
    throw lastError!
  }

  // État du circuit (pour monitoring)
  // R-12 v2 : expose l'espacement adaptatif courant + nb de 429 absorbés
  getStatus(): {
    state: CircuitState
    active: number
    queued: number
    consecutiveErrors: number
    pacingMs: number
    adaptiveSpacingMs: number
    rateLimitHits: number
  } {
    return {
      state: this.circuitState,
      active: this.active,
      queued: this.queue.length,
      consecutiveErrors: this.consecutiveErrors,
      pacingMs: this.minSpacingMs,
      adaptiveSpacingMs: this.adaptiveSpacingMs,
      rateLimitHits: this.rateLimitHits,
    }
  }

  // Reset complet (pour tests)
  reset(): void {
    this.queue = []
    this.active = 0
    this.consecutiveErrors = 0
    this.circuitState = 'CLOSED'
    this.circuitOpenedAt = 0
    this.lastStartAt = 0
    this.adaptiveSpacingMs = this.minSpacingMs
    this.rateLimitHits = 0
  }
}

// Singleton — partagé entre tous les agents LLM
export const llmRateLimiter = new LLMRateLimiter(
  parseInt(process.env.MAX_CONCURRENT_LLM || '3', 10),
)
