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

// ============================================================
// retrieve_pedagogical_examples — recherche TF-IDF large sur type='exemple_pedagogique'
// (k=5 par défaut). Pas de filtre niveau (volontairement large).
// ============================================================
export async function retrieve_pedagogical_examples(
  query: string,
  k = 5,
): Promise<Array<{ id: string; contenu: string; score: number }>> {
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
// retrieve_style_reference — filtre strict :
// type='fiche_reference' AND statut='validee' AND exemplaire=true AND niveau=X AND chapitre=Y
// Tri par récence, top 3.
// ============================================================
export async function retrieve_style_reference(
  niveau: string,
  chapitre: string,
  k = 3,
): Promise<StyleReference[]> {
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

  // Fallback : si aucune fiche exemplaire pour ce (niveau, chapitre), on relaxe le filtre chapitre
  let final = fiches
  if (final.length === 0) {
    final = await db.corpusVectoriel.findMany({
      where: {
        type: 'fiche_reference',
        statut: 'validee',
        exemplaire: true,
        niveau,
      },
      orderBy: { createdAt: 'desc' },
      take: k,
    })
  }
  // Fallback 2 : encore rien → on prend toutes les exemplaires tous niveaux confondus
  if (final.length === 0) {
    final = await db.corpusVectoriel.findMany({
      where: { type: 'fiche_reference', statut: 'validee', exemplaire: true },
      orderBy: { createdAt: 'desc' },
      take: k,
    })
  }

  return final.map((f) => ({
    fiche_id: f.id,
    extrait: f.contenu.slice(0, 1200), // extrait utilisable par le Rédacteur
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
  // 1. Si déjà compilé et pas de forceRecompile → retourne le contexte existant
  if (!opts.forceRecompile) {
    const existing = await db.generationContext.findUnique({
      where: { sequenceId: sequence.id },
    })
    if (existing) {
      try {
        return JSON.parse(existing.payloadJson) as GenerationContext
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

  // 8. Persiste en DB (upsert — un seul context par séquence)
  await db.generationContext.upsert({
    where: { sequenceId: sequence.id },
    create: {
      sequenceId: sequence.id,
      payloadJson: JSON.stringify(ctx),
    },
    update: {
      payloadJson: JSON.stringify(ctx),
      compiledAt: new Date(),
    },
  })

  return ctx
}
