// Knowledge Compiler — Architecture Élite v2 §4
// ÉTAPE DÉTERMINISTE (PAS un agent, PAS de LLM).
// - fetch_curriculum_spec pour chaque notion
// - retrieve_pedagogical_examples (k=5, TF-IDF cosine via src/lib/retrieval.ts buildIndex)
// - retrieve_style_reference (k=3, filtre strict type='fiche_reference' AND statut='validee' AND exemplaire=true AND niveau=X AND chapitre=Y)
// - charge regles(niveau) + contexte_classe si renseigné
// → GenerationContext figé, versionné, rejouable — persisté en DB

import { db } from '@/lib/db'
import { buildIndex } from '@/lib/retrieval'
import { fetchCurriculumSpec } from './planificateur'
import type { GenerationContext, StyleReference, CurriculumSpec } from '@/lib/contracts'
import { validateGenerationContext, validateOrThrow } from '@/lib/validate'
import * as crypto from 'crypto'

// ============================================================
// Cache intelligent — P1-6 (Sprint 3)
// Hash des dépendances : template_version + curriculum_version + corpus_version
// Si le hash change, le cache est invalidé (recompilation automatique).
// ============================================================

// Calcule le hash des dépendances d'un GenerationContext
async function computeDependencyHash(
  templateVersion: string,
  curriculumVersion: string,
): Promise<string> {
  // Corpus version : basée sur le count + dernier updatedAt
  const corpusCount = await db.corpusVectoriel.count()
  const lastCorpusUpdate = await db.corpusVectoriel.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  })
  const corpusVersion = `${corpusCount}-${lastCorpusUpdate?.updatedAt?.getTime() ?? 0}`

  // Template version : hash du template actif
  const activeTemplate = await db.ficheTemplate.findFirst({
    where: { active: true, version: templateVersion },
    select: { id: true, structure: true },
  })
  const templateHash = activeTemplate
    ? crypto.createHash('md5').update(activeTemplate.structure).digest('hex').slice(0, 8)
    : 'none'

  const composite = `${templateVersion}:${templateHash}|${curriculumVersion}|${corpusVersion}`
  return crypto.createHash('sha256').update(composite).digest('hex').slice(0, 16)
}

// ============================================================
// retrieve_pedagogical_examples — recherche TF-IDF large sur type='exemple_pedagogique'
// (k=5 par défaut). Pas de filtre niveau (volontairement large).
// ============================================================
export async function retrieve_pedagogical_examples(
  query: string,
  k = 5,
): Promise<Array<{ id: string; contenu: string; score: number }>> {
  // Guard P0-5 : validation des entrées
  if (!query || typeof query !== 'string') {
    throw new Error(`retrieve_pedagogical_examples: paramètre 'query' invalide (reçu: ${typeof query})`)
  }
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`retrieve_pedagogical_examples: paramètre 'k' doit être un entier positif (reçu: ${k})`)
  }

  const docs = await db.corpusVectoriel.findMany({
    where: { type: 'exemple_pedagogique' },
    select: { id: true, contenu: true },
  })
  if (docs.length === 0) return []
  const index = buildIndex(docs.map((d) => ({ id: d.id, contenu: d.contenu })))
  const top = index.query(query, k)
  const byId = new Map(docs.map((d) => [d.id, d.contenu]))
  return top.map((t) => ({ id: t.id, contenu: byId.get(t.id) || '', score: t.score }))
}

// ============================================================
// retrieve_style_reference — filtre STRICT (baseline §2) :
// type='fiche_reference' AND statut='validee' AND exemplaire=true AND niveau=X AND chapitre=Y
// Tri par récence, top k.
// AUCUN fallback. Aucune relaxation du filtre.
// Si aucune fiche n'existe pour ce (niveau, chapitre), retourne [].
// Le Rédacteur doit savoir travailler avec references_style = [].
// ============================================================
export async function retrieve_style_reference(
  niveau: string,
  chapitre: string,
  k = 3,
): Promise<StyleReference[]> {
  // Guard P0-5 : validation des entrées
  if (!niveau || typeof niveau !== 'string') {
    throw new Error(`retrieve_style_reference: paramètre 'niveau' invalide (reçu: ${typeof niveau})`)
  }
  if (!chapitre || typeof chapitre !== 'string') {
    throw new Error(`retrieve_style_reference: paramètre 'chapitre' invalide (reçu: ${typeof chapitre})`)
  }
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`retrieve_style_reference: paramètre 'k' doit être un entier positif (reçu: ${k})`)
  }

  const fiches = await db.corpusVectoriel.findMany({
    where: {
      type: 'fiche_reference',
      statut: 'validee',
      exemplaire: true,
      niveau,
      chapitre,
    },
    orderBy: { createdAt: 'desc' },
    take: k,
  })

  // PAS DE FALLBACK. Filtre strict respecté.
  // Si [] → le Rédacteur reçoit references_style: [] et produit du contenu sans
  // référence de style. Le prompt du Rédacteur gère déjà ce cas ("(aucune référence disponible)").
  return fiches.map((f) => ({
    fiche_id: f.id,
    extrait: f.contenu.slice(0, 1200),
    niveau: f.niveau,
    chapitre: f.chapitre,
  }))
}

// ============================================================
// compileGenerationContext — étape 100% déterministe
// Produit un GenerationContext figé, versionné, rejouable.
// Persiste en DB (table GenerationContext). Si déjà compilé pour cette séquence,
// on retourne le contexte existant (FIGÉ — pas de recompilation).
// ============================================================
export async function compileGenerationContext(
  sequence: {
    id: string
    titre: string
    niveau: string
    chapitre: string
    templateVersion: string
    curriculumVersion: string
    contexteClasse?: string | null
    notions: Array<{ notionId: string }>
  },
  opts: { forceRecompile?: boolean } = {},
): Promise<GenerationContext> {
  // Guard P0-5 : validation des entrées
  if (!sequence || typeof sequence !== 'object') {
    throw new Error('compileGenerationContext: paramètre "sequence" manquant ou invalide')
  }
  if (!sequence.id || typeof sequence.id !== 'string') {
    throw new Error(`compileGenerationContext: sequence.id invalide (reçu: ${typeof sequence.id})`)
  }
  if (!sequence.notions || !Array.isArray(sequence.notions)) {
    throw new Error(`compileGenerationContext: sequence.notions doit être un tableau (reçu: ${typeof sequence.notions})`)
  }

  // 1. Cache intelligent — P1-6 (Sprint 3)
  // Si déjà compilé ET le hash des dépendances n'a pas changé → retourne le contexte existant.
  // Si le hash a changé (template, curriculum, corpus modifiés) → recompile automatiquement.
  if (!opts.forceRecompile) {
    const existing = await db.generationContext.findUnique({
      where: { sequenceId: sequence.id },
    })
    if (existing) {
      try {
        const cached = JSON.parse(existing.payloadJson) as GenerationContext & { dependency_hash?: string }
        // Calcule le hash actuel et compare avec le hash enregistré
        const currentHash = await computeDependencyHash(sequence.templateVersion, sequence.curriculumVersion)
        if (cached.dependency_hash === currentHash) {
          // Cache valide — retourne le contexte figé
          return cached
        }
        // Cache invalide (dépendances modifiées) → recompile
      } catch {
        // payload corrompu → on recompile
      }
    }
  }

  // 2. fetch_curriculum_spec pour chaque notion
  const notions: CurriculumSpec[] = []
  for (const sn of sequence.notions) {
    const spec = await fetchCurriculumSpec(sn.notionId)
    if (spec) notions.push(spec)
  }

  // 3. retrieve_pedagogical_examples (k=5) — query large sur les notions
  const queryText = `${sequence.titre} ${sequence.chapitre} ${notions.map((n) => n.nom).join(' ')} ${notions.map((n) => n.objectifs.join(' ')).join(' ')}`
  const exemples = await retrieve_pedagogical_examples(queryText, 5)
  const exemples_pedagogiques = exemples.map((e) => ({
    id: e.id,
    contenu: e.contenu,
    score: Number(e.score.toFixed(4)),
  }))

  // 4. retrieve_style_reference (k=3, filtre strict)
  const references_style = await retrieve_style_reference(sequence.niveau, sequence.chapitre, 3)

  // 5. charge regles(niveau)
  const reglesRows = await db.regle.findMany({
    where: { niveau: sequence.niveau, active: true },
  })
  const regles: Record<string, unknown> = {}
  for (const r of reglesRows) {
    try {
      regles[r.cle] = JSON.parse(r.valeur)
    } catch {
      regles[r.cle] = r.valeur
    }
  }

  // 6. contexte_classe si renseigné
  let contexte_classe: Record<string, unknown> | null = null
  if (sequence.contexteClasse) {
    try {
      contexte_classe = JSON.parse(sequence.contexteClasse)
    } catch {
      contexte_classe = null
    }
  }

  // 7. GenerationContext figé
  const ctx: GenerationContext = {
    sequence_id: sequence.id,
    sequence_titre: sequence.titre,
    notions,
    exemples_pedagogiques,
    references_style,
    regles,
    contexte_classe,
    template_version: sequence.templateVersion,
    curriculum_version: sequence.curriculumVersion,
    compiled_at: new Date().toISOString(),
  }

  // P1-6 (Sprint 3) : calcule le hash des dépendances et l'ajoute au contexte
  const dependencyHash = await computeDependencyHash(sequence.templateVersion, sequence.curriculumVersion)
  const ctxWithHash = { ...ctx, dependency_hash: dependencyHash }

  // P0-1 : validation Zod avant persistance — aucun objet invalide ne doit entrer en DB
  const validated = validateOrThrow(validateGenerationContext(ctxWithHash), 'KnowledgeCompiler.compileGenerationContext')

  // 8. Persiste en DB (upsert — un seul context par séquence)
  await db.generationContext.upsert({
    where: { sequenceId: sequence.id },
    create: {
      sequenceId: sequence.id,
      payloadJson: JSON.stringify(validated),
    },
    update: {
      payloadJson: JSON.stringify(validated),
      compiledAt: new Date(),
    },
  })

  return validated
}
