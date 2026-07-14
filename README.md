# Élite v2 — Plateforme pédagogique agentique

> Architecture Élite v2 — agents autonomes, savoir maîtrisé.
> Plateforme de génération de séquences pédagogiques avec 4 agents à autonomie bornée, un Knowledge Compiler déterministe, une critique à deux couches, et une base de connaissances vectorielle unique.

---

## 📋 Table des matières

- [Vision](#-vision)
- [Architecture](#-architecture)
- [Stack technique](#-stack-technique)
- [Prérequis](#-prérequis)
- [Installation & démarrage](#-installation--démarrage)
- [Structure du projet](#-structure-du-projet)
- [Le pipeline en 5 étapes](#-le-pipeline-en-5-étapes)
- [Les 4 agents + le Knowledge Compiler](#-les-4-agents--le-knowledge-compiler)
- [Skills versionnées](#-skills-versionnées)
- [Base de connaissances](#-base-de-connaissances)
- [API REST](#-api-rest)
- [WebSocket (temps réel)](#-websocket-temps-réel)
- [Interface utilisateur](#-interface-utilisateur)
- [Données seedées](#-données-seedées)
- [Scripts disponibles](#-scripts-disponibles)
- [Roadmap](#-roadmap)

---

## 🎯 Vision

Une plateforme, pas un générateur de fiches. La base de connaissances unique est la source de tout contenu généré. Les agents sont autonomes sur le **comment**, jamais sur le **quoi**. Production à la demande, à l'unité ou en volume.

### Principes directeurs

1. **Le fait ne se génère jamais** — programme, prérequis, progression viennent toujours de données structurées.
2. **La séquence est l'objet central**, pas la fiche — et une séquence peut couvrir plusieurs notions (`notion_ids[]`).
3. **Complexité proportionnelle à la preuve** — rien n'est construit avant qu'un besoin réel ne l'ait justifié.
4. **Autonomie bornée** — chaque agent a un périmètre explicite ; il ne peut pas en sortir.
5. **Contrats explicites entre étapes** — chaque objet échangé entre agents est un schéma Zod validé, jamais un `dict` libre.

---

## 🏛️ Architecture

```
Demande (fiche unique OU batch : « génère le chapitre X »)
  │
  ▼
Agent Planificateur
  - resolve_batch_plan()
  - tri : progression.semaine ASC, priorite DESC
  - check_prerequisites_covered() par séquence
  │
  ▼ (file de Sequence — parallélisable)
Knowledge Compiler  ← DÉTERMINISTE, PAS un agent (pas de LLM)
  - fetch_curriculum_spec()
  - fetch_prerequisites()
  - retrieve_pedagogical_examples()
  - retrieve_style_reference()
  - charge regles(niveau) + contexte_classe si renseigné
  → GenerationContext (figé, versionné, rejouable)
  │
  ▼
Agent Rédacteur  ← reçoit un contexte déjà prêt, ne fait plus de retrieval
  - generate_section_pair_v{n}(section, GenerationContext) → SectionContent[]
  │
  ▼
Agent Critique — DEUX COUCHES
  1. validate_structurel()  — TypeScript pur, rapide, TOUJOURS exécuté
     → FAIL : retour ciblé au Rédacteur, AUCUN appel LLM
  2. validate_pedagogique() — LLM, SEULEMENT si (1) PASS
     → FAIL : retour ciblé au Rédacteur (section_a_regenerer)
     → PASS : ValidationResult(valide=true)
  │
  ▼
Agent Superviseur
  - render_fiche() → export_render() → commit_batch()
  - retries bornés (max 2 par section), escalade humaine si échec persistant
```

### Autonomie bornée (§5)

| Agent | Autonome sur | JAMAIS autonome sur |
|---|---|---|
| **Planificateur** | décomposition du batch, ordonnancement simple, existence des prérequis | ordre du programme |
| **Rédacteur** | formulation, choix des exemples (dans le contexte fourni), style des questions | objectifs, notions à couvrir |
| **Critique** | décision pass/fail, ciblage de la régénération | les critères eux-mêmes (fixes) |
| **Superviseur** | gestion des retries, escalade | coordination pure (tout le reste) |

> Le Knowledge Compiler n'est **pas** un agent : c'est une étape 100 % déterministe (agrégation de skills existants), sans décision autonome.

---

## 🛠️ Stack technique

| Couches | Technologie |
|---|---|
| **Framework** | Next.js 16 (App Router) + TypeScript 5 |
| **UI** | Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons + Framer Motion |
| **Base de données** | SQLite + Prisma ORM |
| **Recherche vectorielle** | TF-IDF + similarité cosinus (alternative légère à pgvector) |
| **State (client)** | Zustand (navigation) + TanStack Query (server state) |
| **Temps réel** | Socket.IO (mini-service dédié, port 3003) |
| **LLM** | `z-ai-web-dev-sdk` (Rédacteur + Critique pédagogique) |
| **Validation** | Zod (contrats de données entre agents) |
| **Thème** | Light/Dark via `next-themes` |

### Mapping stack PDF → implémentée

| PDF (§9) | Implémenté |
|---|---|
| LangGraph | Orchestrateur TypeScript custom (graphe explicite par étapes) |
| Pydantic | Zod |
| Postgres + pgvector | SQLite + Prisma + TF-IDF cosinus |
| Redis + RQ | File en mémoire + WebSocket (Socket.IO) |
| Jinja2 | Templates JSON + rendu TypeScript |
| FastAPI | Next.js API Routes (App Router) |

---

## ✅ Prérequis

- **[Bun](https://bun.sh)** >= 1.3 (runtime + package manager)
- **Node.js** >= 20 (pour le mini-service Socket.IO si lancé séparément)

---

## 🚀 Installation & démarrage

### 1. Cloner le dépôt

```bash
git clone https://github.com/AlterEgo095/Generationfiche.git
cd Generationfiche
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Le fichier `.env` contient une seule variable :

```env
DATABASE_URL=file:/home/z/my-project/db/custom.db
```

> Adaptez le chemin selon votre environnement si nécessaire.

### 3. Installation complète (une commande)

```bash
bun run setup
```

Cette commande :
- installe les dépendances du projet principal (`bun install`)
- pousse le schéma Prisma vers la base SQLite (`prisma db push`)
- seed la base avec le curriculum français (`bun run prisma/seed.ts`)
- installe les dépendances du mini-service WebSocket

### 4. Démarrer la plateforme

Vous devez lancer **deux processus** (dans deux terminaux séparés) :

**Terminal 1 — Mini-service WebSocket (port 3003) :**

```bash
bun run mini-service
```

**Terminal 2 — Application Next.js (port 3000) :**

```bash
bun run dev
```

Puis ouvrez [http://localhost:3000](http://localhost:3000).

### 5. Vérification

- Page d'accueil : tableau de bord avec 8 séquences, 9 livrables, 16 entrées de corpus
- API : `curl http://localhost:3000/api/dashboard` → statistiques complètes
- WebSocket : `curl http://localhost:3004/health` → `{"ok":true,...}`

---

## 📁 Structure du projet

```
.
├── prisma/
│   ├── schema.prisma          # Schéma complet (12 modèles)
│   └── seed.ts                # Seed : 8 notions, 16 corpus, 8 séquences, traces
├── src/
│   ├── app/
│   │   ├── api/               # 11 routes API REST
│   │   │   ├── dashboard/
│   │   │   ├── sequences/      # GET, POST, [id] GET
│   │   │   ├── corpus/         # GET, POST, [id] PATCH
│   │   │   ├── agent-runs/     # GET (traçabilité)
│   │   │   ├── skills/         # GET (catalogue)
│   │   │   ├── templates/      # GET (fiche_template)
│   │   │   ├── referentiel/    # GET (notions, prerequis, progressions, regles)
│   │   │   ├── livrables/[id]/ # GET
│   │   │   └── pipeline/       # generate POST (fire-and-forget), batch/[id] GET
│   │   ├── layout.tsx          # ThemeProvider + Toaster + Sonner
│   │   ├── providers.tsx       # QueryClient + ThemeProvider (client)
│   │   ├── page.tsx            # Route unique — router de sections (Zustand)
│   │   └── globals.css         # Palette emerald/teal + scrollbar custom
│   ├── components/
│   │   ├── app-shell.tsx       # Layout : sidebar + topbar + main + footer sticky
│   │   ├── sections/           # 8 sections UI
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   ├── dashboard-section.tsx
│   │   │   ├── sequences-section.tsx
│   │   │   ├── corpus-section.tsx
│   │   │   ├── generations-section.tsx   # ← pipeline live (killer feature)
│   │   │   ├── traces-section.tsx
│   │   │   ├── skills-section.tsx
│   │   │   ├── templates-section.tsx
│   │   │   ├── referentiel-section.tsx
│   │   │   └── states.tsx      # Loading/Error/Empty states
│   │   └── ui/                 # shadcn/ui (37 composants) + json-viewer + status-badge
│   ├── hooks/
│   │   ├── use-pipeline-events.ts  # Hook WebSocket (socket.io-client)
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   └── lib/
│       ├── contracts.ts        # Zod schemas (CurriculumSpec, GenerationContext, etc.)
│       ├── skills-catalog.ts   # 12 skills versionnées (v1/v2)
│       ├── retrieval.ts        # TF-IDF + cosine (alternative pgvector)
│       ├── db.ts               # Prisma client
│       ├── api.ts              # Fetch helpers typés
│       ├── store.ts            # Zustand (activeSection, generationPreset)
│       ├── types.ts            # Types TypeScript pour toutes les réponses API
│       ├── ui.ts               # Maps de couleurs/labels par agent/statut/decision
│       ├── utils.ts            # cn() helper
│       └── pipeline/           # Les 5 étapes du pipeline
│           ├── planificateur.ts
│           ├── knowledge-compiler.ts
│           ├── redacteur.ts    # LLM (z-ai-web-dev-sdk)
│           ├── critique.ts     # 2 couches (TS + LLM)
│           ├── superviseur.ts
│           └── orchestrator.ts # runPipeline() — orchestre tout + WS events
├── mini-services/
│   └── pipeline-service/       # Mini-service Socket.IO (port 3003 + 3004)
│       ├── index.ts
│       ├── package.json
│       └── tsconfig.json
├── examples/
│   └── websocket/              # Démo WebSocket de référence
├── public/
│   ├── logo.svg
│   └── robots.txt
├── .env.example                # Template de configuration
├── .gitignore
├── Caddyfile                   # Gateway (port 81 → 3000, XTransformPort)
├── package.json                # Scripts : dev, setup, db:seed, mini-service, etc.
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.ts
├── eslint.config.mjs
├── components.json             # Config shadcn/ui
└── README.md                   # Ce fichier
```

---

## ⚙️ Le pipeline en 5 étapes

Le pipeline est orchestre par `src/lib/pipeline/orchestrator.ts` via `runPipeline()`.

### 1. Agent Planificateur (`planificateur.ts`)
- `resolve_batch_plan(demande)` : parse la demande (« Géométrie 4e », « notion_thales », etc.)
- Tri : `progression.semaine ASC, priorite DESC`
- `check_prerequisites_covered(seq)` : vérifie que les prérequis sont en semaine antérieure

### 2. Knowledge Compiler (`knowledge-compiler.ts`) — DÉTERMINISTE
- `compile_generation_context(sequence)` :
  - `fetch_curriculum_spec()` : charge la notion + compétences + objectifs
  - `fetch_prerequisites()` : charge les prérequis
  - `retrieve_pedagogical_examples()` : recherche sémantique TF-IDF (k=5)
  - `retrieve_style_reference()` : filtre strict (k=3, `exemplaire=true`)
  - Charge `regles(niveau)` + `contexte_classe` si présent
- Produit un **GenerationContext figé** (persisté en DB, rejouable pour debug/A-B)

### 3. Agent Rédacteur (`redacteur.ts`) — LLM
- `generate_section_pair(section_id, ctx, version)` :
  - **v1** : sobre, exemples canoniaques
  - **v2** : ton engageant, exemples vie courante, méthode en verbes d'action
- Reçoit le contexte déjà prêt — **ne fait plus de retrieval lui-même**
- Fallback gracieux si l'LLM échoue (429, timeout, etc.)

### 4. Agent Critique (`critique.ts`) — 2 COUCHES
- **Couche 1 — Structurel** (TypeScript pur, toujours exécuté) :
  - Sections présentes / format / champs obligatoires
  - Longueurs minimales (depuis `regles.longueur_section`)
  - Durées cohérentes
  - → FAIL : retour ciblé, **AUCUN appel LLM**
- **Couche 2 — Pédagogique** (LLM, seulement si couche 1 PASS) :
  - **v1** : 3 dimensions notées /4 (clarté, cohérence progression, pertinence exemples)
  - **v2** : ajoute l'adéquation au `contexte_classe` si présent
  - → FAIL : `section_a_regenerer` retournée au Rédacteur

> L'économie : la majorité des échecs (section manquante, template mal rempli) sont attrapés en TypeScript avant tout coût d'LLM.

### 5. Agent Superviseur (`superviseur.ts`)
- `render_fiche()` : assemble les `SectionContent[]` en `RenderedDocument` (template v1)
- `export_render()` : format markdown (HTML/PDF possibles)
- `commit_batch()` : marque les livrables validés, enregistre les `agent_run`
- **Retries bornés** : max 2 par section, **escalade humaine** si échec persistant

---

## 🤖 Les 4 agents + le Knowledge Compiler

Chaque étape persiste un `AgentRun` avec : `agent`, `skill`, `input`, `output`, `decision` (`continue` | `retry` | `fail` | `escalade_humaine`), `duration_ms`, `statut` (`ok` | `warning` | `error`).

| Étape | Type | LLM ? | Skill(s) |
|---|---|---|---|
| Planificateur | Agent | Non | `resolve_batch_plan_v1`, `check_prerequisites_covered_v1` |
| Knowledge Compiler | Étape déterministe | Non | `fetch_curriculum_spec_v1`, `retrieve_pedagogical_examples_v1`, `retrieve_style_reference_v1` |
| Rédacteur | Agent | **Oui** | `generate_section_pair_v1` / `v2` |
| Critique (structurel) | Agent | Non | `validate_structurel` (TypeScript pur) |
| Critique (pédagogique) | Agent | **Oui** | `validate_pedagogique_v1` / `v2` |
| Superviseur | Agent | Non | `render_fiche_v1`, `export_render_v1`, `commit_batch_v1` |

---

## 📦 Skills versionnées

Les skills les plus critiques sont versionnées pour permettre la **comparaison A/B** sans casser les générations déjà commises et signées.

| Skill | v1 | v2 |
|---|---|---|
| `generate_section_pair` | Sobre, exemples canoniaques (référence A/B) | Ton engageant, exemples vie courante, méthode en verbes d'action |
| `validate_pedagogique` | 3 dimensions /4 (clarté, progression, pertinence) | Ajoute l'adéquation au `contexte_classe` si présent |

Chaque livrable stocke le `skill_version` utilisé → comparaison A/B possible.

Catalogue complet : `src/lib/skills-catalog.ts` (12 skills).

---

## 📚 Base de connaissances

Une seule table vectorielle `corpus_vectoriel`, deux façons d'y accéder :

```sql
-- Exemples pédagogiques (recherche large)
retrieve_pedagogical_examples(notion, k=5)
  → type = 'exemple_pedagogique'
  → tri par similarité cosinus (TF-IDF)

-- Références de style (filtre strict)
retrieve_style_reference(niveau, chapitre, k=3)
  → type = 'fiche_reference'
  AND statut = 'validee'
  AND exemplaire = true
  AND niveau = X
  AND chapitre = Y
  → tri par récence
```

> Seules les fiches explicitement marquées **exemplaires** nourrissent le style. Ça évite la dérive de style : pas toutes les fiches produites.

**Référentiel structurel** : `notion`, `prerequis`, `progression`, `regle` + templates versionnés (`fiche_template_v1`).

---

## 🔌 API REST

Base URL : `http://localhost:3000/api`

| Méthode | Route | Description |
|---|---|---|
| GET | `/dashboard` | KPIs, funnel, byStatut, recentRuns, recentLivrables |
| GET | `/sequences` | Liste filtrée (statut, niveau, chapitre) |
| POST | `/sequences` | Créer une séquence manuellement |
| GET | `/sequences/[id]` | Détail : notions + generationContext + livrables + agentRuns |
| GET | `/corpus` | Liste filtrée (type, niveau, chapitre, statut, exemplaire) |
| POST | `/corpus` | Ajouter une entrée |
| PATCH | `/corpus/[id]` | Modifier (statut, exemplaire, contenu) |
| GET | `/agent-runs` | Traces (filtres : agent, batchId, sequenceId) |
| GET | `/skills` | Catalogue des 12 skills |
| GET | `/templates` | FicheTemplate[] |
| GET | `/referentiel` | { notions, prerequis, progressions, regles } |
| GET | `/livrables/[id]` | Livrable + validations |
| POST | `/pipeline/generate` | Lancer le pipeline (fire-and-forget) |
| GET | `/pipeline/batch/[id]` | Statut d'un batch |

### POST `/api/pipeline/generate`

```json
{
  "mode": "batch",
  "demande": "Géométrie 4e",
  "skillVersion": "v1",
  "validateVersion": "v1"
}
```

Réponse immédiate :

```json
{
  "batch_id": "batch-1783984519467-abc",
  "items": [...],
  "started_at": "...",
  "ws_room": "batch:batch-1783984519467-abc"
}
```

---

## ⚡ WebSocket (temps réel)

Le mini-service Socket.IO tourne sur le **port 3003** (plus un auxiliaire HTTP sur le **port 3004** pour l'émission d'événements depuis l'API).

### Connexion (frontend)

```typescript
import { io } from 'socket.io-client'
const socket = io("/?XTransformPort=3003")
socket.emit("subscribe", { batch_id })
socket.on("pipeline:event", (event) => { ... })
```

### PipelineEvent

```typescript
{
  batch_id: string,
  sequence_id?: string,
  agent: 'planificateur' | 'knowledge_compiler' | 'redacteur' | 'critique' | 'superviseur',
  skill?: string,
  phase: 'start' | 'progress' | 'done' | 'error' | 'retry' | 'escalade',
  message: string,
  payload?: object,
  timestamp: string,
  duration_ms?: number
}
```

> Le gateway Caddy (port 81) forward les requêtes WebSocket vers le port 3003 via le query param `XTransformPort`.

---

## 🖥️ Interface utilisateur

Application monopage (route `/` unique) avec navigation par **Zustand** (8 sections) :

| Section | Description |
|---|---|
| **Tableau de bord** | KPIs, funnel de validation, donut par statut, runs récents, livrables récents |
| **Séquences** | Grille filtrée + drawer détail (4 onglets : Contexte, Livrable, Validation, Traces) |
| **Corpus vectoriel** | Table filtrée + toggle exemplaire + ajout d'entrées |
| **Générations** | Lanceur + **pipeline live** (5 étapes animées + flux d'événements temps réel) |
| **Traces agents** | Timeline filtrée des `agent_run` avec input/output JSON expandable |
| **Skills catalog** | 12 skills groupés par agent, comparaison v1 vs v2 |
| **Templates** | Structure du `fiche_template_v1` (sections, contraintes) |
| **Référentiel** | Notions, Prérequis, Progressions, Règles (4 onglets) |

### Design system

- **Couleurs** : Emerald/Teal (primary), Amber (warnings), Rose (errors), Slate (neutres)
- **Thème** : Light/Dark via `next-themes`
- **Responsive** : Mobile-first, sidebar collapse en Sheet sur petits écrans
- **Footer** : Sticky en bas (`min-h-screen flex flex-col` + `mt-auto`)
- **Langue** : Français partout

---

## 🌱 Données seedées

Le script `prisma/seed.ts` (`bun run db:seed`) crée :

| Entité | Quantité | Détail |
|---|---|---|
| **Notions** | 8 | Maths (décimaux, fractions, prop, Pythagore, Thalès, équations) + Sciences (cellule, photosynthèse) |
| **Prérequis** | 5 | Graphe de dépendances |
| **Progressions** | 8 | Semaines 3 à 18, niveaux 6e/5e/4e |
| **Règles** | 10 | Style/longueur/format par niveau |
| **Exemples pédagogiques** | 13 | Dans `corpus_vectoriel` (`type=exemple_pedagogique`) |
| **Fiches de référence** | 3 | Marquées `exemplaire=true` (fractions, Pythagore, photosynthèse) |
| **Séquences** | 8 | Statuts variés (validée, en_cours, planifiée, en_attente) |
| **Livrables** | 4 | Séquences validées avec contenu + validation_result |
| **Traces agent_run** | 20 | 5 par séquence validée (5 étapes du pipeline) |
| **Fiche template** | 1 | `v1` avec 7 sections |

---

## 📜 Scripts disponibles

| Script | Commande | Description |
|---|---|---|
| **Setup complet** | `bun run setup` | Install + db push + seed + mini-service install |
| **Dev (Next.js)** | `bun run dev` | Serveur de développement port 3000 |
| **Mini-service** | `bun run mini-service` | Socket.IO port 3003 (+ HTTP 3004) |
| **Lint** | `bun run lint` | ESLint |
| **DB push** | `bun run db:push` | Synchronise le schéma Prisma |
| **DB seed** | `bun run db:seed` | Peuple la base (curriculum français) |
| **DB setup** | `bun run db:setup` | `db:push` + `db:seed` |
| **Build** | `bun run build` | Build de production |
| **Start** | `bun run start` | Serveur de production |

---

## 🗺️ Roadmap

| Phase | Contenu | Statut |
|---|---|---|
| **1 — MVP** | 4 agents + Knowledge Compiler + Critique 2 couches + contrats Zod + `priorite`/`contexte_classe` simples | ✅ Livré |
| **2 — Volume** | Parallélisation batch, cache, comparaison A/B des skills versionnées | 🔄 À venir |
| **3 — Style affiné** | Corpus `fiche_reference` enrichi par l'usage réel, retrieval calibré | 🔄 À venir |
| **4 — Boucle d'apprentissage** | `agent_run` exploité pour ajuster les skills selon les taux de validation réels | 🔄 À venir |

---

## 📄 Licence

Projet privé. Tous droits réservés.

---

**Élite v2** — *agents autonomes, savoir maîtrisé.*
