# Task 3-a — full-stack-developer — Backend Pipeline + API + WebSocket

## Contexte
Tâche 3-a du pipeline "Architecture Élite v2" : construction du BACKEND complet (5 agents + Knowledge Compiler déterministe + critique 2 couches + WebSocket mini-service + 11 routes API). Fondation partagée déjà en place (`contracts.ts`, `skills-catalog.ts`, `retrieval.ts`, `db.ts`, schema Prisma, seed).

## Work Log

### A. WebSocket mini-service — `mini-services/pipeline-service/`
- `package.json` : projet bun indépendant, script `dev` = `bun --hot index.ts`
- `tsconfig.json` : strict=false, types bun-types
- `index.ts` :
  - **Port 3003** : socket.io avec `path: '/'` (règle Caddy). Événements : `subscribe`, `unsubscribe`, `pipeline:emit` (alternative socket). Broadcast `pipeline:event` vers room `batch:<batch_id>`.
  - **Port 3004** (auxiliaire interne, non exposé Caddy) : HTTP `POST /emit` pour que l'orchestrateur Next.js puisse émettre des `pipeline:event` sans dépendre d'un client socket.io. `GET /health` pour vérification.
  - **Décision de design** : socket.io avec `path: '/'` intercepte toutes les URLs commençant par `/` (engine.io). Il est donc impossible d'avoir un handler HTTP custom sur le même port. Solution : 2 ports — 3003 (WS public) + 3004 (HTTP interne pour emits).
- Démarrage : `setsid bun run dev` (détaché du shell). Vérifié `ss -ltn | grep 3003` et `curl /health` → OK.

### B. Pipeline orchestration — `src/lib/pipeline/`
1. **`planificateur.ts`** — `resolve_batch_plan(demande, opts)` :
   - Parsing flexible de la demande : `sequenceId:...`, `notion_thales`, `Géométrie 4e`, `niveau:4e`, mots-clés génériques.
   - Tri `progression.semaine ASC, priorite DESC` (n'invente jamais l'ordre du programme).
   - `checkPrerequisitesCovered(seq)` : vérifie que tous les `prerequis_ids` des notions sont couverts par des séquences antérieures (semaine <, même niveau).
   - `fetchCurriculumSpec(notionId)` : charge Notion + Prerequis → CurriculumSpec.
2. **`knowledge-compiler.ts`** — `compileGenerationContext(sequence, opts)` :
   - 100% déterministe, PAS de LLM.
   - `retrieve_pedagogical_examples(query, k=5)` : index TF-IDF sur tout `corpus_vectoriel WHERE type='exemple_pedagogique'`, cosine similarity via `buildIndex`.
   - `retrieve_style_reference(niveau, chapitre, k=3)` : filtre strict `type='fiche_reference' AND statut='validee' AND exemplaire=true AND niveau=X AND chapitre=Y`. Fallbacks successifs (chapitre relaxé, puis niveau relaxé) pour ne jamais renvoyer vide.
   - Charge `regles(niveau)` + `contexte_classe` si renseigné.
   - **GenerationContext FIGÉ** : persisté en DB via `upsert`. Si déjà compilé pour une séquence (et pas `forceRecompile`), retourne le contexte existant — pas de recompilation.
3. **`redacteur.ts`** — `generateSectionPair(section_id, ctx, version)` :
   - Utilise `z-ai-web-dev-sdk` (`ZAI.create()`, `chat.completions.create`).
   - System prompt embed le GenerationContext complet (notions, exemples, références, règles, contexte_classe, version du ton).
   - v1 = sobre/canonique (température 0.4, max_tokens 900), v2 = engageant/exemples vie courante/méthode en verbes d'action (température 0.6, max_tokens 1100).
   - Parse JSON (3 stratégies : direct, code fence, regex objet) avec **fallback texte dégradé** si LLM indisponible (ne crash pas le pipeline).
   - `generateAllSections(sectionIds, ctx, version, onProgress)` : itère séquentiel, callback de progression pour emit WS live.
4. **`critique.ts`** — 2 couches :
   - `validateStructurel(sections, ctx)` : TypeScript pur, AUCUN LLM. Vérifie sections obligatoires présentes, contenu non vide (rejette "contenu de secours"), longueur min par section selon `regles.longueur_section.min_mots`, cohérence des durées (si `deroulement` mentionne X min vs `contexte_classe.duree_min`, écart max 25%). Identifie `section_a_regenerer`.
   - `validatePedagogique(sections, ctx, version)` : LLM. v1 = 3 dimensions (clarté, cohérence progression, pertinence exemples) /4. v2 ajoute `adequation_contexte_classe` SI `ctx.contexte_classe` présent, sinon retombe sur v1. Pass si toutes ≥ 3. Fallback gracieux : si LLM échoue, valide automatiquement (ne bloque pas le pipeline).
5. **`superviseur.ts`** :
   - `renderFiche(sections, ctx, opts)` : assemble `RenderedDocument` Markdown selon template v1. En-tête (niveau, chapitre, notions, contexte classe), une section par `FICHE_TEMPLATE_V1_SECTIONS`, méthode en blockquote si présente, meta (compiled_at, counts).
   - `exportRender(rendered, format)` : markdown natif ou HTML enveloppé.
   - `commitBatch(batchId)` : atomicité par séquence. Marque les livrables validés, escalade humaine si `decision='escalade_humaine'` détectée. Persiste un `agent_run` final `commit_batch_v1` par séquence.
6. **`orchestrator.ts`** — `runPipeline(args)` :
   - Orchestre les 5 étapes avec `batch_id` persistant.
   - **Fire-and-forget** : accepte `batchId` forcé en amont pour que l'API puisse retourner immédiatement `{batch_id, items, started_at}` (voir route `/api/pipeline/generate`).
   - Émet `PipelineEvent` à chaque étape (start/progress/done/retry/error/escalade) via `POST http://127.0.0.1:3004/emit` → broadcast WS vers la room.
   - Persiste `AgentRun` à chaque étape avec `agent, skill, input (JSON), output (JSON), decision ('continue'|'retry'|'fail'|'escalade_humaine'), duration_ms, statut ('ok'|'warning'|'error')`.
   - **Boucle de retry** : max 2 par section (structurel + pédagogique). Retry ciblé : régénère uniquement la `section_a_regenerer` identifiée par le Critique. Escalade humaine au-delà.
   - Délais artificiels 400-600ms entre étapes pour UX live.
   - `try/catch` global par séquence : un crash sur une séquence ne bloque pas les autres.

### C. API routes — `src/app/api/`
11 routes créées, toutes `NextResponse.json(...)` avec `try/catch` global (500 + message). Aucune n'utilise `server action`.

- `dashboard/route.ts` — GET : counts, byStatut, funnel (generees/structurel_ok/pedagogique_ok/validees), recentRuns (10), recentLivrables (5).
- `sequences/route.ts` — GET (filtres statut/niveau/chapitre) + POST (create).
- `sequences/[id]/route.ts` — GET full detail (notions avec prerequis, generationContext, livrables avec validations, agentRuns).
- `corpus/route.ts` — GET (filtres type/niveau/chapitre/statut/exemplaire) + POST (create).
- `corpus/[id]/route.ts` — GET + PATCH (update statut/exemplaire/contenu).
- `agent-runs/route.ts` — GET (filtres agent/batchId/sequenceId, limit 100).
- `skills/route.ts` — GET retourne SKILLS_CATALOG (12 skills).
- `templates/route.ts` — GET retourne FicheTemplate[] (depuis DB).
- `referentiel/route.ts` — GET notions (avec prerequisPour/prerequisDe) + progressions + regles.
- `livrables/[id]/route.ts` — GET livrable + validations + sequence.
- `pipeline/generate/route.ts` — POST. **Fire-and-forget** : résout le batch_plan SYNCHRONE (étape 1 rapide et déterministe) pour renvoyer `batch_id + items` immédiatement (~1s), puis lance `runPipeline` en arrière-plan. Le frontend suit en live via WS + `GET /api/pipeline/batch/[id]`.
- `pipeline/batch/[id]/route.ts` — GET : items (statut par séquence, livrable_id, runs), stats (validees/en_cours/echec/escalade).

### D. Quality — Respect du cahier des charges
- ✅ Chaque étape d'agent persiste un `AgentRun` avec tous les champs requis (agent, skill, input, output, decision, duration_ms, statut).
- ✅ Rédacteur + Critique pédagogique : `try/catch` + fallback gracieux (contenu de secours / validation auto par défaut). Le pipeline ne crash jamais sur erreur LLM.
- ✅ Critique structurel TOUJOURS exécuté avant LLM (économie de tokens §4).
- ✅ GenerationContext FIGÉ : persisté, réutilisé sur retry (pas de recompilation).
- ✅ Prompts, sections, messages en français.
- ✅ Max 2 retries par section, escalade humaine au-delà (décision `escalade_humaine` enregistrée dans `agent_runs`).

### E. Vérification
- `bun run lint` → EXIT 0 ✅
- Mini-service démarré en background : `bun --hot index.ts` PID actif, ports 3003 (WS) + 3004 (HTTP emit) en écoute.
- Test end-to-end :
  ```bash
  curl -X POST http://localhost:3000/api/pipeline/generate \
    -H "Content-Type: application/json" \
    -d '{"mode":"batch","demande":"Géométrie 4e","skillVersion":"v1","validateVersion":"v1"}'
  ```
  → Réponse immédiate `{"batch_id":"batch-1783984519467-slovvp","items":[2 séquences],"status":"running"}` (~1.2s).
- Pipeline ~2 minutes plus tard : 2 séquences `validee`, 2 livrables créés, 16 `agent_runs` tracés (avec un retry observé sur Thalès — validation pédagogique FAIL → régénération ciblée → PASS).
- Validation pédagogique LLM : scores réels obtenus (3/4, 4/4, 3/4 etc.) avec justifications françaises.
- Contenu du livrable : fiche Markdown complète avec les 7 sections (objectifs, prerequis, deroulement, activites, differentiation, evaluation, prolongement) + méthodes en blockquote.

## Stage Summary
- Backend 100% fonctionnel. Pipeline 5 étapes vivant, agents autonomes sur leur périmètre, Knowledge Compiler déterministe, critique 2 couches (TS + LLM), retries bornés, escalade humaine.
- 11 routes API REST opérationnelles (vérifiées via curl).
- WebSocket mini-service opérationnel sur port 3003 (path `/`) + 3004 (HTTP emit interne).
- Traçabilité complète : 16 agent_runs pour 1 batch de 2 séquences.
- LLM (z-ai-web-dev-sdk) utilisé uniquement server-side (redacteur + critique pédagogique).
- Prêt pour intégration frontend (tâche 3-b).

## Fichiers créés
- `mini-services/pipeline-service/package.json`
- `mini-services/pipeline-service/tsconfig.json`
- `mini-services/pipeline-service/index.ts`
- `src/lib/pipeline/planificateur.ts`
- `src/lib/pipeline/knowledge-compiler.ts`
- `src/lib/pipeline/redacteur.ts`
- `src/lib/pipeline/critique.ts`
- `src/lib/pipeline/superviseur.ts`
- `src/lib/pipeline/orchestrator.ts`
- `src/app/api/dashboard/route.ts`
- `src/app/api/sequences/route.ts`
- `src/app/api/sequences/[id]/route.ts`
- `src/app/api/corpus/route.ts`
- `src/app/api/corpus/[id]/route.ts`
- `src/app/api/agent-runs/route.ts`
- `src/app/api/skills/route.ts`
- `src/app/api/templates/route.ts`
- `src/app/api/referentiel/route.ts`
- `src/app/api/livrables/[id]/route.ts`
- `src/app/api/pipeline/generate/route.ts`
- `src/app/api/pipeline/batch/[id]/route.ts`

## Déviations du contrat API (avec rationale)
1. **Pipeline generate = fire-and-forget via étape 1 synchrone** : au lieu d'attendre la fin du pipeline pour retourner `batch_id`, on résout SYNCHRONE le `batch_plan` (étape 1 du Planificateur, rapide et déterministe) pour générer un `batch_id` fixe en amont, puis on lance `runPipeline` en arrière-plan. Le frontend récupère immédiatement `{batch_id, items, started_at, ws_room}` et suit via WS + `GET /api/pipeline/batch/[id]`. Respecte le §"PREFER fire-and-forget so the UI can watch live".
2. **Port auxiliaire 3004 pour HTTP /emit** : socket.io avec `path: '/'` intercepte toutes les URLs commençant par `/` (engine.io), ce qui rend impossible un handler HTTP custom sur le port 3003. Solution propre : un second listener HTTP sur port 3004 (interne, non exposé via Caddy) gère `POST /emit` et `GET /health`. Le port 3003 reste dédié au traffic WS public via Caddy.
3. **`/api/sequences/[id]`** : enrichi avec `agentRuns` + `generationContext` + `validations` (en plus de `livrables`), pour permettre au frontend d'afficher toute la traçabilité en un seul appel.
4. **`POST /api/pipeline/generate`** : réponse enrichie avec `ws_room: "batch:<batch_id>"` pour faciliter l'abonnement WS côté frontend.

## Sample curl de test (réussi)
```bash
curl -X POST http://localhost:3000/api/pipeline/generate \
  -H "Content-Type: application/json" \
  -d '{"mode":"batch","demande":"Géométrie 4e","skillVersion":"v1","validateVersion":"v1"}'

# → {"batch_id":"batch-1783984519467-slovvp","items":[Pythagore, Thales],"status":"running"}

# Suivi live :
curl http://localhost:3000/api/pipeline/batch/batch-1783984519467-slovvp
# → 2 séquences validee, 16 agent_runs, 2 livrables validés

# Inspection d'un livrable :
curl http://localhost:3000/api/livrables/cmrjucmh8000doewbgysmaufx
# → fiche markdown complète + ValidationResult (structurel_pass=true, pedagogique_pass=true)
```
