// Pipeline Admission Gate — R-12 (Fermé F-33)
// ============================================================
// PROBLÈME (F-33, audit 360°) : plusieurs pipelines lancés en parallèle
// (ex. 2 POST /api/pipeline/generate, ou un batch multi-séquences) se
// partagent le même quota LLM. Sans contrôle d'admission, ils se
// déclarent mutuellement des 429 → circuit breaker OPEN (auto-agressif)
// → escalades en cascade. Le système se tirait dessus lui-même.
//
// CORRECTIF R-12 : admission control à l'entrée — un nombre limité de
// pipelines peut s'exécuter simultanément (défaut 1). Tout excédent est
// refusé DÉTERMINISTEMENT (HTTP 429 + Retry-After) au lieu de provoquer
// une tempête 429 côté fournisseur LLM.
//
// Combiné au pacing global intégré dans LLMRateLimiter (LLM_MIN_SPACING_MS),
// le débit LLM devient borné à l'échelle de la PLATEFORME entière :
//   débit max ≈ 60 000 / LLM_MIN_SPACING_MS appels/min, quel que soit
//   le nombre de pipelines ou de sections en vol.
//
// Réversibilité : LLM_GOVERNOR=off désactive le gate (comportement
// antérieur restauré), sans suppression de code.
// ============================================================

type GateStatus = {
  enabled: boolean
  active: number
  max: number
  queued: number
  lastAdmissionAt: number
  totalAdmitted: number
  totalRefused: number
}

class PipelineGate {
  private active = 0
  private readonly max: number
  private readonly enabled: boolean
  private lastAdmissionAt = 0
  private totalAdmitted = 0
  private totalRefused = 0
  private waiters: Array<() => void> = []

  constructor() {
    this.enabled = (process.env.LLM_GOVERNOR || 'on') !== 'off'
    this.max = Math.max(1, parseInt(process.env.MAX_PARALLEL_PIPELINES || '1', 10))
  }

  /**
   * Tente d'acquérir un permis de pipeline.
   * - Gate désactivé → toujours admis (mode réversible).
   * - Slot libre → admis immédiatement.
   * - Saturation → attend jusqu'à `waitMs` puis refuse (retour false).
   * @param waitMs durée max d'attente en file (0 = refus immédiat)
   */
  async tryAcquire(waitMs = 0): Promise<boolean> {
    if (!this.enabled) {
      this.totalAdmitted++
      return true
    }
    const deadline = Date.now() + waitMs
    // Boucle d'attente bornée : anti-réveil sporieux (spurious wakeup)
    while (this.active >= this.max) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        this.totalRefused++
        return false
      }
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    }
    this.active++
    this.lastAdmissionAt = Date.now()
    this.totalAdmitted++
    return true
  }

  /** Libère le permis et réveille un éventuel candidat en file. */
  release(): void {
    this.active = Math.max(0, this.active - 1)
    const next = this.waiters.shift()
    if (next) next()
  }

  getStatus(): GateStatus {
    return {
      enabled: this.enabled,
      active: this.active,
      max: this.max,
      queued: this.waiters.length,
      lastAdmissionAt: this.lastAdmissionAt,
      totalAdmitted: this.totalAdmitted,
      totalRefused: this.totalRefused,
    }
  }

  reset(): void {
    this.active = 0
    this.waiters = []
    this.totalAdmitted = 0
    this.totalRefused = 0
    this.lastAdmissionAt = 0
  }
}

// Singleton — partagé par toutes les routes qui lancent un pipeline
export const pipelineGate = new PipelineGate()
