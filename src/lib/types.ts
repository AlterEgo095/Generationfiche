// Types dérivés de l'API Élite v2 (consommés côté client uniquement).

export type Section = 'dashboard' | 'sequences' | 'corpus' | 'generations' | 'traces' | 'skills' | 'templates' | 'referentiel'

export type StatutSequence = 'validee' | 'en_cours' | 'planifiee' | 'en_attente' | 'echec'
export type AgentName = 'planificateur' | 'knowledge_compiler' | 'redacteur' | 'critique' | 'superviseur'
export type Decision = 'continue' | 'retry' | 'fail' | 'escalade_humaine'
export type StatutRun = 'ok' | 'warning' | 'error'
export type Phase = 'start' | 'progress' | 'done' | 'error' | 'retry' | 'escalade'

export interface Notion {
  id: string
  nom: string
  description: string
  niveau: string
  chapitre: string
  competences: string[]
  objectifs: string[]
  prerequisPour?: { id: string; obligation: string; prerequis: { id: string; nom: string; niveau: string } }[]
  prerequisDe?: { id: string; obligation: string; prerequis: { id: string; nom: string; niveau: string } }[]
}

export interface Progression {
  id: string
  niveau: string
  chapitre: string
  semaine: number
  dureeMin: number
  notionId: string
  notion: { id: string; nom: string }
}

export interface Regle {
  id: string
  niveau: string
  cle: string
  valeur: unknown // string ou objet JSON
  active: boolean
}

export interface SequenceListItem {
  id: string
  titre: string
  niveau: string
  chapitre: string
  semaine: number
  priorite: number
  statut: StatutSequence
  templateVersion: string
  curriculumVersion: string
  contexteClasse: string | null
  notionIds: string[]
  notions: { notionId: string; nom: string; niveau: string; chapitre: string }[]
  progression: { id: string; semaine: number; dureeMin: number } | null
  livrables_count: number
  agentRuns_count: number
  createdAt: string
  updatedAt: string
}

export interface LivrableContenuSection {
  section_id: string
  label?: string
  contenu: string
  methode?: string | null
}

export interface Livrable {
  id: string
  type: string
  format: string
  valide: boolean
  skillVersion: string
  createdAt: string
  contenu: {
    markdown?: string
    sections?: LivrableContenuSection[]
    meta?: Record<string, unknown>
  }
  validations: ValidationResult[]
}

export interface ValidationResult {
  id: string
  structurelPass: boolean
  structurelRaisons: string[]
  pedagogiquePass: boolean | null
  pedagogiqueRaisons: string[] | null
  sectionARegenerer: string | null
  coucheDeclenchee: string
  skillVersion: string
  createdAt: string
}

export interface GenerationContextPayload {
  sequence_id: string
  sequence_titre: string
  notions: {
    notion_id: string
    nom: string
    competences: string[]
    objectifs: string[]
    prerequis_ids: string[]
    niveau: string
    chapitre: string
  }[]
  exemples_pedagogiques: { id?: string; contenu: string; score?: number }[]
  references_style: { fiche_id: string; extrait: string; niveau: string; chapitre: string }[]
  regles: Record<string, unknown>
  contexte_classe: Record<string, unknown> | null
  template_version: string
  curriculum_version: string
  compiled_at: string
}

export interface SequenceDetail extends Omit<SequenceListItem, 'livrables_count' | 'agentRuns_count'> {
  notions: (Notion & { prerequis?: Notion[] })[]
  generationContext: {
    id: string
    compiledAt: string
    payload: GenerationContextPayload
  } | null
  livrables: Livrable[]
  agentRuns: AgentRun[]
}

export interface AgentRun {
  id: string
  sequenceId: string | null
  batchId: string | null
  agent: AgentName
  skill: string | null
  input: Record<string, unknown>
  output: Record<string, unknown>
  decision: Decision
  durationMs: number
  statut: StatutRun
  timestamp: string
  sequence_titre?: string
}

export interface CorpusItem {
  id: string
  contenu: string
  type: 'exemple_pedagogique' | 'fiche_reference' | string
  niveau: string
  chapitre: string
  statut: 'validee' | 'brouillon' | string
  exemplaire: boolean
  notionId: string | null
  notion: { id: string; nom: string } | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface SkillDescriptor {
  id: string
  nom: string
  version: string
  agent: AgentName
  description: string
  critique: string
  active: boolean
  parametres: { cle: string; type: 'int' | 'string' | 'bool'; defaut: string; description: string }[]
}

export interface FicheTemplate {
  id: string
  version: string
  nom: string
  active: boolean
  structure: {
    sections: { id: string; label: string; obligatoire: boolean; min_mots: number; duree_min?: number }[]
    contraintes: { ton: string; format_questions: string }
  }
  createdAt: string
}

export interface DashboardData {
  counts: { sequences: number; livrables: number; corpus: number; notions: number; agentRuns: number }
  byStatut: Record<StatutSequence, number>
  funnel: { generees: number; structurel_ok: number; pedagogique_ok: number; validees: number }
  recentRuns: AgentRun[]
  recentLivrables: (Livrable & { sequence: { titre: string; niveau: string; chapitre: string } })[]
}

export interface BatchPlanItem {
  sequence_id: string
  sequence_titre: string
  semaine: number
  priorite: number
  notions: { notion_id: string; nom: string; niveau: string; chapitre: string }[]
  prerequis_couverts: boolean
  ready: boolean
}

export interface PipelineGenerateResponse {
  batch_id: string
  items: BatchPlanItem[]
  started_at: string
  ws_room?: string
  status?: string
}

export interface PipelineBatchItem {
  sequence_id: string
  sequence_titre: string
  statut: StatutSequence | string
  livrable_id: string | null
  livrable_valide: boolean | null
  runs_count: number
  last_decision: string | null
  last_skill: string | null
  runs: {
    id: string
    agent: AgentName
    skill: string | null
    decision: Decision
    statut: StatutRun
    durationMs: number
    timestamp: string
  }[]
}

export interface PipelineBatch {
  batch_id: string
  items: PipelineBatchItem[]
  stats?: { validees?: number; en_cours?: number; echec?: number; escalade?: number }
}

export interface PipelineEvent {
  batch_id: string
  sequence_id?: string | null
  agent: AgentName | string
  skill?: string | null
  phase: Phase | string
  message: string
  payload?: Record<string, unknown>
  timestamp: string
  duration_ms?: number | null
}

// Référentiel
export interface Referentiel {
  notions: Notion[]
  progressions: Progression[]
  regles: Regle[]
}

// List response wrapper (used by most GET endpoints)
export interface ListResponse<T> {
  items: T[]
  total: number
}
