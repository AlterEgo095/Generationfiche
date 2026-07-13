'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { AppShell } from '@/components/app-shell'
import { useStore } from '@/lib/store'
import { DashboardSection } from '@/components/sections/dashboard-section'
import { SequencesSection } from '@/components/sections/sequences-section'
import { CorpusSection } from '@/components/sections/corpus-section'
import { GenerationsSection } from '@/components/sections/generations-section'
import { TracesSection } from '@/components/sections/traces-section'
import { SkillsSection } from '@/components/sections/skills-section'
import { TemplatesSection } from '@/components/sections/templates-section'
import { ReferentielSection } from '@/components/sections/referentiel-section'
import type { Section } from '@/lib/types'

const SECTIONS: Record<Section, React.FC> = {
  dashboard: DashboardSection,
  sequences: SequencesSection,
  corpus: CorpusSection,
  generations: GenerationsSection,
  traces: TracesSection,
  skills: SkillsSection,
  templates: TemplatesSection,
  referentiel: ReferentielSection,
}

export default function HomePage() {
  const activeSection = useStore((s) => s.activeSection)
  const ActiveSection = SECTIONS[activeSection]

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <ActiveSection />
        </motion.div>
      </AnimatePresence>
    </AppShell>
  )
}
