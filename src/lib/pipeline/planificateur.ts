// Agent Planificateur — Architecture Élite v2 §4 + §5
// Périmètre d'autonomie : décomposition batch, ordonnancement simple (semaine ASC, priorite DESC),
//                         existence des prérequis couverts par les séquences antérieures.
// JAMAIS autonome sur : l'ordre du programme (la semaine vient du référentiel Progression).

import { db } from '@/lib/db'
import type { BatchPlan, BatchPlanItem, CurriculumSpec } from '@/lib/contracts'

// ============================================================
// fetchCurriculumSpec — charge la spec d'une notion depuis le référentiel
// ============================================================
export async function fetchCurriculumSpec(notionId: string): Promise<CurriculumSpec | null> {
  // Guard P0-5 : validation des entrées
  if (!notionId || typeof notionId !== 'string') {
    throw new Error(`fetchCurriculumSpec: paramètre 'notionId' invalide (reçu: ${typeof notionId})`)
  }
  const notion = await db.notion.findUnique({
    where: { id: notionId },
    include: { prerequisPour: true },
  })
  if (!notion) return null
  return {
    notion_id: notion.id,
    nom: notion.nom,
    competences: JSON.parse(notion.competences || '[]'),
    objectifs: JSON.parse(notion.objectifs || '[]'),
    prerequis_ids: notion.prerequisPour.map((p) => p.prerequisId),
    niveau: notion.niveau,
    chapitre: notion.chapitre,
  }
}

// ============================================================
// checkPrerequisitesCovered — pour une séquence, vérifie que tous les prerequis_ids
// de ses notions sont couverts par des séquences antérieures (semaine <).
// Couverture = présence en semaine antérieure (ne vérifie pas la validation du livrable).
// ============================================================
export async function checkPrerequisitesCovered(sequenceId: string): Promise<boolean> {
  // Guard P0-5 : validation des entrées
  if (!sequenceId || typeof sequenceId !== 'string') {
    throw new Error(`checkPrerequisitesCovered: paramètre 'sequenceId' invalide (reçu: ${typeof sequenceId})`)
  }
  const seq = await db.sequence.findUnique({
    where: { id: sequenceId },
    include: { notions: { include: { notion: { include: { prerequisPour: true } } } } },
  })
  if (!seq) return false

  const prerequisiteIds = new Set<string>()
  for (const sn of seq.notions) {
    for (const p of sn.notion.prerequisPour) {
      prerequisiteIds.add(p.prerequisId)
    }
  }
  if (prerequisiteIds.size === 0) return true

  // séquences antérieures (semaine <, même niveau) couvrant ces prérequis
  const anterieures = await db.sequence.findMany({
    where: { niveau: seq.niveau, semaine: { lt: seq.semaine } },
    include: { notions: true },
  })
  const coveredNotionIds = new Set<string>()
  for (const a of anterieures) {
    for (const sn of a.notions) coveredNotionIds.add(sn.notionId)
  }
  for (const pid of prerequisiteIds) {
    if (!coveredNotionIds.has(pid)) return false
  }
  return true
}

// ============================================================
// resolve_batch_plan — décompose une demande en file de Sequence ordonnée
// - accepte : "génère le chapitre Géométrie 4e", "notion_thales", "Géométrie 4e", "niveau:4e", "sequenceId:..."
// - ordonnancement : progression.semaine ASC, priorite DESC (jAMAIS ne modifie l'ordre du programme)
// - pour chaque séquence, vérifie prerequis couverts
// ============================================================
export async function resolve_batch_plan(
  demande: string,
  opts: { max_par_batch?: number } = {},
): Promise<BatchPlan> {
  // Guard P0-5 : validation des entrées
  if (typeof demande !== 'string') {
    throw new Error(`resolve_batch_plan: paramètre 'demande' doit être une string (reçu: ${typeof demande})`)
  }
  if (!demande || !demande.trim()) {
    throw new Error('resolve_batch_plan: paramètre "demande" est vide')
  }
  if (opts.max_par_batch !== undefined && (!Number.isInteger(opts.max_par_batch) || opts.max_par_batch <= 0)) {
    throw new Error(`resolve_batch_plan: max_par_batch doit être un entier positif (reçu: ${opts.max_par_batch})`)
  }
  const max = opts.max_par_batch ?? 20
  const demandeLower = (demande || '').trim().toLowerCase()

  // parsing : sequenceId direct
  let where: Record<string, unknown> = {}
  if (/^sequenceid:/i.test(demandeLower)) {
    const id = demandeLower.replace(/^sequenceid:\s*/i, '').trim()
    where = { id: id }
  } else if (/^notion_/i.test(demandeLower)) {
    // "notion_thales" → filtre par notion
    const notionId = demandeLower.trim()
    const sequences = await db.sequence.findMany({
      where: { notions: { some: { notionId } } },
      include: { notions: { include: { notion: true } }, progression: true },
      orderBy: [{ semaine: 'asc' }, { priorite: 'desc' }],
    })
    return buildPlan(demande, sequences, max)
  } else {
    // parsing "chapitre X niveau Y" — ex: "Géométrie 4e"
    const niveauMatch = demandeLower.match(/\b(6e|5e|4e|3e|2nde|1ere|term)\b/)
    const niveau = niveauMatch ? niveauMatch[1] : undefined
    // retirer le niveau de la demande pour trouver le chapitre
    const chapitreCandidate = demandeLower
      .replace(/\b(génère|genere|génére|le|la|les|chapitre|séquence|sequence|de|du|sur|pour)\b/gi, ' ')
      .replace(/\b(6e|5e|4e|3e|2nde|1ere|term)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const filters: Record<string, unknown> = {}
    if (niveau) filters.niveau = niveau
    if (chapitreCandidate && chapitreCandidate.length > 2) {
      // Recherche approximative chapitre : contient
      filters.chapitre = { contains: chapitreCandidate.replace(/^\w/, (c) => c.toUpperCase()) }
      // Si la recherche est large (ex: "géométrie"), on prend tel quel
      // Si on ne trouve rien, on retombe sur une recherche large niveau
    }
    where = filters
  }

  let sequences = await db.sequence.findMany({
    where,
    include: { notions: { include: { notion: true } }, progression: true },
    orderBy: [{ semaine: 'asc' }, { priorite: 'desc' }],
  })

  // fallback : si aucune séquence trouvée avec un filtre chapitre, retenter niveau seulement
  if (sequences.length === 0 && where.chapitre && where.niveau) {
    sequences = await db.sequence.findMany({
      where: { niveau: where.niveau as string },
      include: { notions: { include: { notion: true } }, progression: true },
      orderBy: [{ semaine: 'asc' }, { priorite: 'desc' }],
    })
  }
  // fallback 2 : si toujours rien, retombe sur tout
  if (sequences.length === 0) {
    sequences = await db.sequence.findMany({
      include: { notions: { include: { notion: true } }, progression: true },
      orderBy: [{ semaine: 'asc' }, { priorite: 'desc' }],
    })
  }

  return buildPlan(demande, sequences, max)
}

async function buildPlan(
  demande: string,
  sequences: Array<{
    id: string
    titre: string
    semaine: number
    priorite: number
    niveau: string
    chapitre: string
    notions: Array<{ notion: { id: string; nom: string; description: string; niveau: string; chapitre: string; competences: string; objectifs: string } }>
  }>,
  max: number,
): Promise<BatchPlan> {
  const batch_id = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const items: BatchPlanItem[] = []

  for (const s of sequences.slice(0, max)) {
    const notions: CurriculumSpec[] = []
    for (const sn of s.notions) {
      const spec = await fetchCurriculumSpec(sn.notion.id)
      if (spec) notions.push(spec)
    }
    const prerequis_couverts = await checkPrerequisitesCovered(s.id)
    items.push({
      sequence_id: s.id,
      sequence_titre: s.titre,
      semaine: s.semaine,
      priorite: s.priorite,
      notions,
      prerequis_couverts,
      ready: notions.length > 0,
    })
  }

  return {
    batch_id,
    demande,
    items,
    total: items.length,
  }
}
