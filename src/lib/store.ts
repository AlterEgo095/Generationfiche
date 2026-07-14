// Zustand store — Élite v2.
// Section navigation (single-page app), génération preset, batch actif.

'use client'

import { create } from 'zustand'
import type { Section } from './types'

interface AppState {
  // Navigation SPA
  activeSection: Section
  setSection: (s: Section) => void

  // Preset pour la génération (séquence préselectionnée depuis détail)
  generationPreset: { sequenceId?: string } | null
  setGenerationPreset: (p: { sequenceId?: string } | null) => void

  // Batch actif (pour live indicator + auto reconnexion WS)
  activeBatchId: string | null
  setActiveBatchId: (id: string | null) => void

  // Mobile sidebar (sheet)
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  activeSection: 'dashboard',
  setSection: (s) => set({ activeSection: s }),

  generationPreset: null,
  setGenerationPreset: (p) => set({ generationPreset: p }),

  activeBatchId: null,
  setActiveBatchId: (id) => set({ activeBatchId: id }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))

// Métadonnées de section (titre, description, icône)
export const SECTION_META: Record<Section, { title: string; description: string }> = {
  dashboard: {
    title: 'Tableau de bord',
    description: "Vue d'ensemble de l'activité agentique",
  },
  sequences: {
    title: 'Séquences',
    description: 'Catalogue des séquences pédagogiques',
  },
  corpus: {
    title: 'Corpus vectoriel',
    description: 'Exemples pédagogiques et fiches de référence',
  },
  generations: {
    title: 'Générations',
    description: 'Lancer et suivre un pipeline agentique en direct',
  },
  traces: {
    title: 'Traces agents',
    description: 'Journal complet des exécutions AgentRun',
  },
  skills: {
    title: 'Skills catalog',
    description: 'Compétences versionnées par agent',
  },
  templates: {
    title: 'Templates',
    description: 'Structure des fiches pédagogiques',
  },
  referentiel: {
    title: 'Référentiel',
    description: 'Notions, prérequis, progressions, règles',
  },
}
