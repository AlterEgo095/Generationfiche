# Production Documentation — Architecture Élite v2

> Sprint 4 — Production Certification

## Architecture

### Composants

| Composant | Rôle | Fichier(s) |
|-----------|------|------------|
| **Planificateur** | Décompose batch, ordonnance, vérifie prérequis | `src/lib/pipeline/planificateur.ts` |
| **Knowledge Compiler** | Étape déterministe, GenerationContext figé + cache intelligent | `src/lib/pipeline/knowledge-compiler.ts` |
| **Rédacteur** | LLM v1/v2, rate limiter + circuit breaker | `src/lib/pipeline/redacteur.ts` |
| **Critique** | 2 couches (structurel TS + pédagogique LLM), fail-safe | `src/lib/pipeline/critique.ts` |
| **Superviseur** | Render, export, quality gate (score ≥ 80) | `src/lib/pipeline/superviseur.ts` |
| **Orchestrateur** | Pipeline parallèle (MAX_CONCURRENT=3) | `src/lib/pipeline/orchestrator.ts` |
| **LLM Rate Limiter** | Queue FIFO, circuit breaker, backoff | `src/lib/llm-limiter.ts` |
| **Event Outbox** | Persistance DB, retry 1s/3s/10s | `src/lib/outbox-worker.ts` |
| **Quality Gate** | Score pédagogique, bloque si < 80 | `src/lib/quality-gate.ts` |
| **Metrics** | Compteurs + latences P50/P95/P99 | `src/lib/metrics.ts` |

### Stack

- Next.js 16, TypeScript 5, Tailwind 4, shadcn/ui
- Prisma (SQLite), z-ai-web-dev-sdk, docx, pdf-lib
- Socket.IO (port 3003/3004), Vitest (152 tests)

---

## Runbook

### Incident API
1. `GET /api/system/health` → si 503, DB down
2. `GET /api/system` → vérifier errors_24h, latences
3. Si DB down : `bun run db:push && bun run db:seed && bun run prisma/seed-enrichment.ts`

### Incident LLM
1. `GET /api/system` → `llm_limiter.state`
2. Si OPEN : attendre 30s (cooldown auto)
3. Si 429 : réduire `MAX_CONCURRENT_LLM`
4. Pipeline dégrade : fallback → critique rejette → escalade

### Incident DB
1. Backup : `cp db/custom.db db/custom.db.backup`
2. Reset : `rm db/custom.db && bun run db:push`
3. Restore : `bun run db:seed && bun run prisma/seed-enrichment.ts`
4. GenerationContext se recompile automatiquement (cache intelligent)

### Incident WebSocket
1. `curl http://localhost:3004/health`
2. Si down : `cd mini-services/pipeline-service && bun run dev`
3. Events dans outbox DB → `GET /api/system/outbox`
4. Worker : `POST /api/system/outbox`

### Rollback
1. `git checkout <commit>`
2. `bun install && bun run db:push`
3. `bun run db:seed && bun run prisma/seed-enrichment.ts`
4. Relancer serveur + mini-service

---

## SLA

| Métrique | Cible |
|----------|-------|
| Disponibilité API | 99.5% |
| Génération fiche (P95) | < 30s |
| Knowledge Compiler | < 100ms |
| Export PDF | < 500ms |
| Taux erreur pipeline | < 1% |
| Event delivery rate | > 99% |

### Limites

| Ressource | Limite | Config |
|-----------|--------|--------|
| Concurrence génération | 3 | `MAX_CONCURRENT_GENERATION` |
| Concurrence LLM | 3 | `MAX_CONCURRENT_LLM` |
| Retries LLM | 3 | `LLMRateLimiter` |
| Retries WS | 3 (1s/3s/10s) | `EventOutbox` |
| Quality gate | score ≥ 80 | `PUBLICATION_THRESHOLD` |
| Payload corpus | 10000 chars | Zod |

---

## Monitoring

| Endpoint | Usage |
|----------|-------|
| `GET /api/system/health` | Health check |
| `GET /api/system` | Dashboard complet |
| `GET /api/system/outbox` | Outbox stats |
| `POST /api/system/outbox` | Trigger worker |

---

## Sécurité

### Headers (proxy.ts)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy: frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Validation
- Zod sur tous les POST/PATCH (enum type/statut/niveau/skillVersion)
- Pré-validation FK (notionIds existence)
- Guards sur tous les skills
- XSS : React escape + escapeHtml export
- SQL : Prisma paramétré (0 raw query)
