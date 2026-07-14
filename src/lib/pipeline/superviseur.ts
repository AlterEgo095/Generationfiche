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

  const doc: RenderedDocument = {
    livrable_id: opts.livrable_id,
    sequence_id: ctx.sequence_id,
    format: 'markdown',
    contenu_final,
    valide: true,
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
// ============================================================
export async function commitBatch(batchId: string): Promise<{
  committed: number
  escalated: number
  items: Array<{ sequence_id: string; livrable_id?: string; statut: string }>
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

  let committed = 0
  let escalated = 0
  const items: Array<{ sequence_id: string; livrable_id?: string; statut: string }> = []

  for (const seqId of seqIds) {
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
      await db.livrable.update({
        where: { id: livrable.id },
        data: { valide: !hasError },
      })
      await db.sequence.update({
        where: { id: seqId },
        data: { statut: hasError ? 'en_cours' : 'validee' },
      })
      if (!hasError) committed++
      items.push({
        sequence_id: seqId,
        livrable_id: livrable.id,
        statut: hasError ? 'en_cours' : 'validee',
      })
    } else {
      items.push({ sequence_id: seqId, statut: 'echec' })
    }

    // Agent run de commit
    await db.agentRun.create({
      data: {
        sequenceId: seqId,
        batchId,
        agent: 'superviseur',
        skill: 'commit_batch_v1',
        input: JSON.stringify({ batch_id: batchId, sequence_id: seqId, livrable_id: livrable?.id }),
        output: JSON.stringify({ committed: !hasError, livrable_id: livrable?.id }),
        decision: hasEscalade ? 'escalade_humaine' : !hasError ? 'continue' : 'fail',
        durationMs: lastSuperviseur?.durationMs ?? 0,
        statut: hasError ? 'warning' : 'ok',
      },
    })
  }

  return { committed, escalated, items }
}
