// Helpers API typés — Architecture Élite v2.
// Toutes les routes sont en chemins relatifs. Pour le WebSocket, on passe
// par /?XTransformPort=3003 (Caddy forward).

import type {
  AgentName,
  AgentRun,
  CorpusItem,
  DashboardData,
  FicheTemplate,
  ListResponse,
  PipelineBatch,
  PipelineGenerateResponse,
  Referentiel,
  SequenceDetail,
  SequenceListItem,
  SkillDescriptor,
  StatutSequence,
} from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  return (await res.json()) as T
}

// ============================================================
// Dashboard
// ============================================================
export const fetchDashboard = () => request<DashboardData>('/api/dashboard')

// ============================================================
// Séquences
// ============================================================
export interface SequenceFilters {
  statut?: StatutSequence | string
  niveau?: string
  chapitre?: string
}

export function fetchSequences(filters: SequenceFilters = {}): Promise<ListResponse<SequenceListItem>> {
  const params = new URLSearchParams()
  if (filters.statut) params.set('statut', filters.statut)
  if (filters.niveau) params.set('niveau', filters.niveau)
  if (filters.chapitre) params.set('chapitre', filters.chapitre)
  const qs = params.toString()
  return request<ListResponse<SequenceListItem>>(`/api/sequences${qs ? `?${qs}` : ''}`)
}

export const fetchSequence = (id: string) =>
  request<SequenceDetail>(`/api/sequences/${encodeURIComponent(id)}`)

// ============================================================
// Corpus
// ============================================================
export interface CorpusFilters {
  type?: string
  niveau?: string
  chapitre?: string
  statut?: string
  exemplaire?: boolean
}

export function fetchCorpus(filters: CorpusFilters = {}): Promise<ListResponse<CorpusItem>> {
  const params = new URLSearchParams()
  if (filters.type) params.set('type', filters.type)
  if (filters.niveau) params.set('niveau', filters.niveau)
  if (filters.chapitre) params.set('chapitre', filters.chapitre)
  if (filters.statut) params.set('statut', filters.statut)
  if (typeof filters.exemplaire === 'boolean') params.set('exemplaire', String(filters.exemplaire))
  const qs = params.toString()
  return request<ListResponse<CorpusItem>>(`/api/corpus${qs ? `?${qs}` : ''}`)
}

export function createCorpus(body: {
  contenu: string
  type: string
  niveau: string
  chapitre: string
  notionId?: string
  exemplaire?: boolean
}) {
  return request<CorpusItem>('/api/corpus', { method: 'POST', body: JSON.stringify(body) })
}

export function patchCorpus(id: string, body: Partial<Pick<CorpusItem, 'statut' | 'exemplaire' | 'contenu'>>) {
  return request<CorpusItem>(`/api/corpus/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

// ============================================================
// Agent runs
// ============================================================
export interface AgentRunFilters {
  agent?: AgentName | string
  batchId?: string
  sequenceId?: string
  decision?: string
  statut?: string
  limit?: number
}

export function fetchAgentRuns(filters: AgentRunFilters = {}): Promise<ListResponse<AgentRun>> {
  const params = new URLSearchParams()
  if (filters.agent) params.set('agent', filters.agent)
  if (filters.batchId) params.set('batchId', filters.batchId)
  if (filters.sequenceId) params.set('sequenceId', filters.sequenceId)
  if (filters.decision) params.set('decision', filters.decision)
  if (filters.statut) params.set('statut', filters.statut)
  if (filters.limit) params.set('limit', String(filters.limit))
  const qs = params.toString()
  return request<ListResponse<AgentRun>>(`/api/agent-runs${qs ? `?${qs}` : ''}`)
}

// ============================================================
// Skills
// ============================================================
export const fetchSkills = () => request<ListResponse<SkillDescriptor>>('/api/skills')

// ============================================================
// Templates
// ============================================================
export const fetchTemplates = () => request<ListResponse<FicheTemplate>>('/api/templates')

// ============================================================
// Référentiel
// ============================================================
export const fetchReferentiel = () => request<Referentiel>('/api/referentiel')

// ============================================================
// Pipeline
// ============================================================
export function generatePipeline(body: {
  mode: 'single' | 'batch'
  sequenceId?: string
  demande?: string
  skillVersion: 'v1' | 'v2'
  validateVersion: 'v1' | 'v2'
}) {
  return request<PipelineGenerateResponse>('/api/pipeline/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export const fetchBatch = (batchId: string) =>
  request<PipelineBatch>(`/api/pipeline/batch/${encodeURIComponent(batchId)}`)
