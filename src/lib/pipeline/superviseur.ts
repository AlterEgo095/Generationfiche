// Agent Superviseur — Architecture Élite v2 §4 + §5
// Périmètre d'autonomie : gestion des retries, escalade.
// JAMAIS autonome sur : coordination pure (orchestration gérée par l'orchestrateur).
//
// Rendu :
//   - renderFiche(sections, ctx) → RenderedDocument (assemblage Markdown selon template)
//   - exportRender(rendered, format) → string (markdown par défaut)
//   - commitBatch(batchId) → marque les livrables validés, clôture le batch
//
// Retry loop : max 2 par section, escalade_humaine après.

import { db } from '@/lib/db'
import {
  FICHE_TEMPLATE_V1_SECTIONS,
  SECTION_LABELS,
  type FicheSectionId,
  type GenerationContext,
  type RenderedDocument,
  type SectionContent,
} from '@/lib/contracts'
import { validateRenderedDocument, validateOrThrow } from '@/lib/validate'
import { computePedagogicalScore, isPublishable, PUBLICATION_THRESHOLD, type PedagogicalScore } from '@/lib/quality-gate'

// ============================================================
// renderFiche — assemble les SectionContent[] en un RenderedDocument
// selon le template_version. Ajoute en-tête, numérotation, cohérence.
// ============================================================
export function renderFiche(
  sections: SectionContent[],
  ctx: GenerationContext,
  opts: { livrable_id: string; skill_version: string },
): RenderedDocument {
  // Guard P0-5 : validation des entrées
  if (!sections || !Array.isArray(sections)) {
    throw new Error(`renderFiche: paramètre 'sections' doit être un tableau (reçu: ${typeof sections})`)
  }
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('renderFiche: paramètre "ctx" (GenerationContext) manquant ou invalide')
  }
  if (!opts || !opts.livrable_id || typeof opts.livrable_id !== 'string') {
    throw new Error('renderFiche: opts.livrable_id invalide')
  }
  if (!opts.skill_version || typeof opts.skill_version !== 'string') {
    throw new Error('renderFiche: opts.skill_version invalide')
  }

  const sectionsById = new Map<string, SectionContent>()
  for (const s of sections) sectionsById.set(s.section_id, s)

  // Assemblage Markdown structuré
  const lines: string[] = []
  lines.push(`# Fiche pédagogique — ${ctx.sequence_titre}`)
  lines.push('')
  lines.push(`- **Niveau** : ${ctx.notions.map((n) => n.niveau).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`)
  lines.push(`- **Chapitre** : ${ctx.notions.map((n) => n.chapitre).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`)
  lines.push(`- **Notions** : ${ctx.notions.map((n) => n.nom).join(', ')}`)
  if (ctx.contexte_classe) {
    lines.push(`- **Contexte classe** : effectif ${ctx.contexte_classe.effectif ?? '?'}, durée ${ctx.contexte_classe.duree_min ?? '?'} min`)
  }
  lines.push(`- **Template** : ${ctx.template_version}  |  **Curriculum** : ${ctx.curriculum_version}  |  **Skill** : ${opts.skill_version}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const sid of FICHE_TEMPLATE_V1_SECTIONS) {
    const s = sectionsById.get(sid)
    const label = SECTION_LABELS[sid as FicheSectionId] || sid
    lines.push(`## ${label}`)
    lines.push('')
    if (s) {
      lines.push(s.contenu)
      if (s.methode) {
        lines.push('')
        lines.push(`> **Méthode** : ${s.methode}`)
      }
    } else {
      lines.push(`_(section non produite)_`)
    }
    lines.push('')
  }

  const contenu_final = {
    markdown: lines.join('\n'),
    sections: sections.map((s) => ({
      section_id: s.section_id,
      label: SECTION_LABELS[s.section_id as FicheSectionId] || s.section_id,
      contenu: s.contenu,
      methode: s.methode ?? null,
    })),
    meta: {
      sequence_titre: ctx.sequence_titre,
      template_version: ctx.template_version,
      curriculum_version: ctx.curriculum_version,
      compiled_at: ctx.compiled_at,
      notions_count: ctx.notions.length,
      exemples_count: ctx.exemples_pedagogiques.length,
      references_count: ctx.references_style.length,
    },
  }

  // P4-6 (Sprint 4) : Quality Gate pédagogique — bloque la publication si score < 80
  const pedagogicalScore = computePedagogicalScore(sections, ctx)
  const publishable = isPublishable(pedagogicalScore)

  const doc: RenderedDocument = {
    livrable_id: opts.livrable_id,
    sequence_id: ctx.sequence_id,
    format: 'markdown',
    contenu_final: { ...contenu_final, pedagogical_score: pedagogicalScore },
    valide: publishable, // P4-6 : valide seulement si score >= 80
    skill_version: opts.skill_version,
  }

  // P0-1 : validation Zod du RenderedDocument avant retour (et avant commit DB)
  return validateOrThrow(validateRenderedDocument(doc), 'Superviseur.renderFiche')
}

// ============================================================
// exportRender — exporte le livrable dans le format demandé
// (markdown natif ; HTML simple ; PDF = HTML enveloppé pour aperçu)
// ============================================================
export function exportRender(rendered: RenderedDocument, format: 'markdown' | 'html' = 'markdown'): string {
  // Guard P0-5 : validation des entrées
  if (!rendered || typeof rendered !== 'object') {
    throw new Error('exportRender: paramètre "rendered" manquant ou invalide')
  }
  if (!rendered.contenu_final || typeof rendered.contenu_final !== 'object') {
    throw new Error('exportRender: rendered.contenu_final invalide')
  }
  if (format !== 'markdown' && format !== 'html') {
    throw new Error(`exportRender: format doit être "markdown" ou "html" (reçu: "${format}")`)
  }
  if (format === 'markdown') {
    return rendered.contenu_final.markdown as string
  }
  // HTML simple
  const md = rendered.contenu_final.markdown as string
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${rendered.sequence_id}</title>
<style>
body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a1a; }
h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
h2 { margin-top: 28px; color: #2a2a2a; }
blockquote { border-left: 4px solid #888; padding-left: 12px; color: #444; font-style: italic; }
code, pre { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
</style>
</head>
<body>
<pre>${escapeHtml(md)}</pre>
</body>
</html>`
  return html
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ============================================================
// commitBatch — marque les livrables validés, clôture le batch.
// Atomicité par séquence (un livrable valide = une séquence validee).
//
// F-31 (audit 360°, EXP C3) — AVANT : commitBatch marquait valide = !hasError,
// ignorant le score pédagogique ET pedagogique_pass → une fiche vidée/verbeuse
// ou mathématiquement fausse passait la publication si aucun agent_run n'avait
// statut "error". LE GATE ÉTAIT CONTOURNÉ AU COMMIT.
//
// R-31 : le commit rejoue la chaîne complète des gates et ne valide QUE si :
//   1. aucun agent_run en erreur dans le batch (inchangé)
//   2. validationResult du livrable : structurelPass = true
//   3. validationResult du livrable : pedagogiquePass = true (veto critique LLM)
//   4. score pédagogique (quality-gate) >= PUBLICATION_THRESHOLD
// Sinon : livrable.valide=false et séquence en_attente (revue humaine).
//
// Idempotence (même finding EXP C3) : si un commit existe déjà pour
// (batchId, sequence), la séquence est sautée — rejouer un batch ne duplique
// plus les agent_runs de commit.
// ============================================================
export async function commitBatch(batchId: string): Promise<{
  committed: number
  escalated: number
  items: Array<{
    sequence_id: string
    livrable_id?: string
    statut: string
    gate?: { ok: boolean; score: number | null; reasons: string[] }
  }>
}> {
  // Guard P0-5 : validation des entrées
  if (!batchId || typeof batchId !== 'string') {
    throw new Error(`commitBatch: paramètre 'batchId' invalide (reçu: ${typeof batchId})`)
  }

  // Récupère tous les agent_runs du batch, groupés par séquence
  const runs = await db.agentRun.findMany({
    where: { batchId },
    orderBy: { timestamp: 'asc' },
  })
  const seqIds = Array.from(new Set(runs.map((r) => r.sequenceId).filter(Boolean))) as string[]

  // F-31 — Idempotence : les séquences déjà committées dans ce batch sont sautées
  const priorCommits = await db.agentRun.findMany({
    where: { batchId, agent: 'superviseur', skill: 'commit_batch_v1' },
    select: { sequenceId: true },
  })
  const alreadyCommitted = new Set(priorCommits.map((r) => r.sequenceId))

  let committed = 0
  let escalated = 0
  const items: Array<{
    sequence_id: string
    livrable_id?: string
    statut: string
    gate?: { ok: boolean; score: number | null; reasons: string[] }
  }> = []

  for (const seqId of seqIds) {
    if (alreadyCommitted.has(seqId)) {
      items.push({ sequence_id: seqId, statut: 'deja_committed' })
      continue
    }

    const seqRuns = runs.filter((r) => r.sequenceId === seqId)
    const hasEscalade = seqRuns.some((r) => r.decision === 'escalade_humaine')
    const hasError = seqRuns.some((r) => r.statut === 'error')
    const lastSuperviseur = [...seqRuns].reverse().find((r) => r.agent === 'superviseur')

    if (hasEscalade) {
      escalated++
      await db.sequence.update({ where: { id: seqId }, data: { statut: 'en_attente' } })
      items.push({ sequence_id: seqId, statut: 'escalade_humaine' })
      continue
    }

    // Cherche le livrable le plus récent
    const livrable = await db.livrable.findFirst({
      where: { sequenceId: seqId },
      orderBy: { createdAt: 'desc' },
    })
    if (livrable) {
      // F-31 — Rejoue la chaîne complète des gates au lieu de faire confiance à !hasError
      let score: number | null = null
      try {
        const parsed = JSON.parse(livrable.contenuJson || '{}') as {
          pedagogical_score?: { score?: number }
          contenu_final?: { pedagogical_score?: { score?: number } }
        }
        const ps = parsed?.pedagogical_score?.score ?? parsed?.contenu_final?.pedagogical_score?.score
        if (typeof ps === 'number' && Number.isFinite(ps)) score = ps
      } catch {
        // contenuJson non parsable → score inconnu → gate échoue (pessimiste)
      }
      const vr = await db.validationResult.findFirst({
        where: { livrableId: livrable.id },
        orderBy: { createdAt: 'desc' },
      })

      const gateReasons: string[] = []
      if (hasError) gateReasons.push('agent_run en erreur dans le batch')
      if (!vr || vr.structurelPass !== true) gateReasons.push('validation structurelle absente ou FAIL')
      if (!vr || vr.pedagogiquePass !== true) gateReasons.push('validation pédagogique absente ou FAIL (veto critique)')
      if (score === null) gateReasons.push('score pédagogique absent du rendu')
      else if (score < PUBLICATION_THRESHOLD) gateReasons.push(`score pédagogique ${score} < seuil ${PUBLICATION_THRESHOLD}`)
      const gateOK = gateReasons.length === 0

      await db.livrable.update({
        where: { id: livrable.id },
        data: { valide: gateOK },
      })
      const statut = gateOK ? 'validee' : hasError ? 'en_cours' : 'en_attente'
      await db.sequence.update({
        where: { id: seqId },
        data: { statut },
      })
      if (gateOK) committed++
      items.push({
        sequence_id: seqId,
        livrable_id: livrable.id,
        statut,
        gate: { ok: gateOK, score, reasons: gateReasons },
      })

      // Agent run de commit
      await db.agentRun.create({
        data: {
          sequenceId: seqId,
          batchId,
          agent: 'superviseur',
          skill: 'commit_batch_v1',
          input: JSON.stringify({ batch_id: batchId, sequence_id: seqId, livrable_id: livrable.id }),
          output: JSON.stringify({ committed: gateOK, livrable_id: livrable.id, gate: { ok: gateOK, score, reasons: gateReasons } }),
          decision: gateOK ? 'continue' : hasError ? 'fail' : 'retry',
          durationMs: lastSuperviseur?.durationMs ?? 0,
          statut: gateOK ? 'ok' : 'warning',
        },
      })
    } else {
      items.push({ sequence_id: seqId, statut: 'echec' })
    }
  }

  return { committed, escalated, items }
}
