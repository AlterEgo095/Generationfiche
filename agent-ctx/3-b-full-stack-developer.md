# Task 3-b — full-stack-developer — Frontend Architecture Élite v2

## Contexte
Tâche 3-b : construction du FRONTEND complet (8 sections, navigation SPA via Zustand, TanStack Query pour l'état serveur, WebSocket hook pour le live pipeline). Backend déjà livré par tâche 3-a.

## Work Log

### A. Vérification du contrat backend
- Lecture du worklog (contrat API complet + forme PipelineEvent + fire-and-forget generate).
- Curl live sur les 11 endpoints : tous répondent 200, structures confirmées :
  - `/api/dashboard` → `{counts, byStatut, funnel, recentRuns, recentLivrables}`
  - `/api/sequences` → `{items: SequenceListItem[], total}` (avec `livrables_count`, `agentRuns_count`, `notions`)
  - `/api/sequences/[id]` → détail enrichi (notions avec prerequis, generationContext.payload, livrables avec validations[], agentRuns[])
  - `/api/corpus` → `{items, total}` (avec `notion` nested)
  - `/api/agent-runs` → `{items, total}` (avec `sequence_titre`, `input`/`output` parsés en JSON)
  - `/api/skills` → `{items, total}` (12 skills, dont 2 paires versionnées v1/v2)
  - `/api/templates` → `{items, total}` (1 template v1 avec structure.sections + contraintes)
  - `/api/referentiel` → `{notions, progressions, regles}` (notions avec `prerequisPour`/`prerequisDe`)
  - `/api/pipeline/generate` → `{batch_id, items, started_at, status, ws_room}` (réponse immédiate ~38ms)
  - `/api/pipeline/batch/[id]` → `{batch_id, items[], stats}`

### B. Setup
- Installation de `socket.io-client` (manquant).
- Aucune autre dépendance ajoutée.

### C. Architecture frontend
- **Layout** (`src/app/layout.tsx` server + `src/app/providers.tsx` client) — séparation nécessaire car `QueryClient` est une instance de classe non-sérialisable côté Server Component. ThemeProvider + QueryClientProvider + Toaster + SonnerToaster dans Providers. `<html lang="fr">`, title FR.
- **AppShell** (`src/components/app-shell.tsx`) — `min-h-screen flex flex-col`, sidebar desktop 260px + Sheet mobile, topbar sticky, main content, footer `mt-auto` sticky.
- **Zustand store** (`src/lib/store.ts`) — `activeSection`, `generationPreset`, `activeBatchId`, `sidebarOpen`. Section meta (titres/descriptions FR).
- **API client** (`src/lib/api.ts`) — wrappers typés pour chaque endpoint, chemins relatifs uniquement.
- **UI helpers** (`src/lib/ui.ts`) — color maps par agent (planificateur=slate, knowledge_compiler=teal, redacteur=emerald, critique=amber, superviseur=violet), statuts, décisions, phases, run statuts. Helpers temporels FR (`timeAgo`, `formatDuration`, `formatTime`).
- **WebSocket hook** (`src/hooks/use-pipeline-events.ts`) — connecte `io('/?XTransformPort=3003')`, émet `subscribe {batch_id}`, écoute `pipeline:event`. Patterns React 19 idiomatiques (derived state pour reset, named handlers + `socket.off()` cleanup, ref stable via useEffect).

### D. 8 sections complètes
Voir worklog.md pour le détail de chaque section. Points saillants :
- **Dashboard** : 4 KPI gradient + funnel animé + donut SVG custom + table runs récents + cards livrables récents. Refetch 15s.
- **Séquences** : filtres sticky + grille responsive + Sheet détail avec 4 tabs (Contexte/Livrable/Validation/Traces). Markdown rendu via `react-markdown`, méthodes en blockquote emerald.
- **Corpus** : banner info + filtres + Table sticky + Switch exemplaire (PATCH) + dropdown statut + Dialog ajout.
- **Générations** (KILLER FEATURE) : Launcher (mode single/batch, version pickers v1/v2) → batch plan → live pipeline view (2 colonnes) avec stage pills animés (AnimatePresence), progress bars, event stream auto-scroll. Hook WS `usePipelineEvents`.
- **Traces** : 4 KPI + chips par agent (filtres cliquables) + timeline verticale + JSON collapsible + load more.
- **Skills** : groupé par agent (5 sections), paires versionnées en side-by-side VS.
- **Templates** : selector de version + structure visuelle (sections colorées par obligatoire) + JSON collapsible.
- **Référentiel** : 4 tabs (Notions/Prérequis/Progressions/Règles). Graphe prérequis simple (notion ← prerequis avec obligation colorée).

### E. Quality
- `bun run lint` → EXIT 0 ✅
- 3 fixes lint appliqués :
  1. `Providers.tsx` (client) pour QueryClient — ne peut pas être passé d'un Server Component.
  2. `useSyncExternalStore` pour `mounted` dans TopBar (évite setState-in-effect).
  3. `useEffect` pour updater `onEventRef` dans use-pipeline-events (évite refs-during-render). Derived state pattern pour reset events sur changement batch.
- Tous les endpoints curlés → 200 ✅
- Page SSR → 200 (37540 bytes) avec app shell (`<aside>`, `<main>`, `<footer>`, titre "Élite") ✅
- WebSocket mini-service (port 3004/health) → 200 ✅
- Test pipeline generate single → réponse immédiate avec `ws_room: "batch:<batch_id>"` ✅
- Test PATCH corpus exemplaire → toggle OK puis restauré ✅

## Stage Summary
- Frontend 100% fonctionnel, livré en 23 fichiers (8 sections + 5 shared UI + 4 lib + 1 hook + layout/providers/page/globals).
- Design system emerald/teal strict (zéro blue/indigo), dark sidebar permanente, glass topbar, scrollbar custom, animations pulse pour live.
- Live pipeline view opérationnel : hook WS se connecte, s'abonne, reçoit les events, met à jour les stage pills + progress + event stream en temps réel.
- Mobile responsive (sidebar en Sheet, grid 1→2→3, footer sticky).
- Aucune deviation majeure du cahier des charges (voir worklog.md pour les 5 micro-déviations avec rationale).
- Section la plus "lively" : Générations (live pipeline). Suivie de Dashboard (KPIs + funnel animé + refresh 15s) et Traces (timeline dense).

## Fichiers créés (23)
- src/lib/types.ts
- src/lib/api.ts
- src/lib/store.ts
- src/lib/ui.ts
- src/hooks/use-pipeline-events.ts
- src/components/ui/status-badge.tsx
- src/components/ui/json-viewer.tsx
- src/components/app-shell.tsx
- src/components/sections/sidebar.tsx
- src/components/sections/topbar.tsx
- src/components/sections/states.tsx
- src/components/sections/dashboard-section.tsx
- src/components/sections/sequences-section.tsx
- src/components/sections/corpus-section.tsx
- src/components/sections/generations-section.tsx
- src/components/sections/traces-section.tsx
- src/components/sections/skills-section.tsx
- src/components/sections/templates-section.tsx
- src/components/sections/referentiel-section.tsx
- src/app/providers.tsx
- src/app/layout.tsx (réécrit)
- src/app/page.tsx (réécrit)
- src/app/globals.css (réécrit — palette emerald/teal)
