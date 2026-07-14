// Helpers UI partagés — couleurs par agent/statut/decision.

import type { AgentName, Decision, Phase, StatutRun, StatutSequence } from '@/lib/types'

// ============================================================
// AGENTS — couleur + label FR
// ============================================================
export const AGENT_COLORS: Record<AgentName, { bg: string; text: string; dot: string; border: string }> = {
  planificateur: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-700 dark:text-slate-200',
    dot: 'bg-slate-500',
    border: 'border-slate-300 dark:border-slate-700',
  },
  knowledge_compiler: {
    bg: 'bg-teal-100 dark:bg-teal-900/40',
    text: 'text-teal-700 dark:text-teal-200',
    dot: 'bg-teal-500',
    border: 'border-teal-300 dark:border-teal-700',
  },
  redacteur: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-200',
    dot: 'bg-emerald-500',
    border: 'border-emerald-300 dark:border-emerald-700',
  },
  critique: {
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-200',
    dot: 'bg-amber-500',
    border: 'border-amber-300 dark:border-amber-700',
  },
  superviseur: {
    bg: 'bg-violet-100 dark:bg-violet-900/40',
    text: 'text-violet-700 dark:text-violet-200',
    dot: 'bg-violet-500',
    border: 'border-violet-300 dark:border-violet-700',
  },
}

export const AGENT_LABELS: Record<AgentName, string> = {
  planificateur: 'Planificateur',
  knowledge_compiler: 'Knowledge Compiler',
  redacteur: 'Rédacteur',
  critique: 'Critique',
  superviseur: 'Superviseur',
}

export function agentColor(agent: string) {
  return AGENT_COLORS[agent as AgentName] ?? AGENT_COLORS.planificateur
}
export function agentLabel(agent: string) {
  return AGENT_LABELS[agent as AgentName] ?? agent
}

// ============================================================
// STATUT SÉQUENCE
// ============================================================
export const STATUT_COLORS: Record<StatutSequence, { bg: string; text: string; dot: string }> = {
  validee: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  en_cours: {
    bg: 'bg-teal-100 dark:bg-teal-900/40',
    text: 'text-teal-700 dark:text-teal-300',
    dot: 'bg-teal-500',
  },
  planifiee: {
    bg: 'bg-sky-100 dark:bg-sky-900/40',
    text: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  en_attente: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500',
  },
  echec: {
    bg: 'bg-rose-100 dark:bg-rose-900/40',
    text: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
}

export const STATUT_LABELS: Record<StatutSequence, string> = {
  validee: 'Validée',
  en_cours: 'En cours',
  planifiee: 'Planifiée',
  en_attente: 'En attente',
  echec: 'Échec',
}

export function statutColor(s: string) {
  return STATUT_COLORS[s as StatutSequence] ?? STATUT_COLORS.en_attente
}
export function statutLabel(s: string) {
  return STATUT_LABELS[s as StatutSequence] ?? s
}

// ============================================================
// DÉCISION
// ============================================================
export const DECISION_COLORS: Record<Decision, { bg: string; text: string }> = {
  continue: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
  retry: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  fail: { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300' },
  escalade_humaine: {
    bg: 'bg-rose-200 dark:bg-rose-900/60',
    text: 'text-rose-800 dark:text-rose-200',
  },
}

export const DECISION_LABELS: Record<Decision, string> = {
  continue: 'Continue',
  retry: 'Retry',
  fail: 'Échec',
  escalade_humaine: 'Escalade humaine',
}

export function decisionColor(d: string) {
  return DECISION_COLORS[d as Decision] ?? DECISION_COLORS.continue
}
export function decisionLabel(d: string) {
  return DECISION_LABELS[d as Decision] ?? d
}

// ============================================================
// PHASE (pipeline event)
// ============================================================
export const PHASE_COLORS: Record<Phase, { bg: string; text: string; dot: string }> = {
  start: { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
  progress: {
    bg: 'bg-teal-100 dark:bg-teal-900/40',
    text: 'text-teal-700 dark:text-teal-300',
    dot: 'bg-teal-500',
  },
  done: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  error: { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  retry: {
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  escalade: {
    bg: 'bg-rose-200 dark:bg-rose-900/60',
    text: 'text-rose-800 dark:text-rose-200',
    dot: 'bg-rose-600',
  },
}

export const PHASE_LABELS: Record<Phase, string> = {
  start: 'Démarrage',
  progress: 'En cours',
  done: 'Terminé',
  error: 'Erreur',
  retry: 'Re-tentative',
  escalade: 'Escalade',
}

export function phaseColor(p: string) {
  return PHASE_COLORS[p as Phase] ?? PHASE_COLORS.progress
}
export function phaseLabel(p: string) {
  return PHASE_LABELS[p as Phase] ?? p
}

// ============================================================
// STATUT RUN (ok/warning/error)
// ============================================================
export const RUN_STATUT_COLORS: Record<StatutRun, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
}

export function runStatutColor(s: string) {
  return RUN_STATUT_COLORS[s as StatutRun] ?? 'bg-slate-400'
}

// ============================================================
// UTILS TEMPORELS
// ============================================================
export function timeAgo(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = Math.max(0, now - d.getTime())
  const s = Math.floor(diff / 1000)
  if (s < 60) return `il y a ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const days = Math.floor(h / 24)
  if (days < 7) return `il y a ${days}j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}min${s.toString().padStart(2, '0')}`
}
