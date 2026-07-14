// Agent Rédacteur — Architecture Élite v2 §4 + §5
// Périmètre d'autonomie : formulation, choix exemples (dans le contexte fourni), style questions.
// JAMAIS autonome sur : objectifs, notions à couvrir (venant du GenerationContext).
// Reçoit un GenerationContext déjà prêt — NE FAIT AUCUN retrieval.
// Skill versionné : generate_section_pair_v1 (sobre) / generate_section_pair_v2 (engageant).

import ZAI from 'z-ai-web-dev-sdk'
import type { GenerationContext, SectionContent, FicheSectionId } from '@/lib/contracts'
import { SECTION_LABELS } from '@/lib/contracts'
import { validateSectionContent, validateOrThrow } from '@/lib/validate'
import { llmRateLimiter } from '@/lib/llm-limiter'
import { metrics } from '@/lib/metrics'

// ============================================================
// Système prompt commun aux deux versions — embed le GenerationContext
// ============================================================
function buildSystemPrompt(ctx: GenerationContext, version: 'v1' | 'v2'): string {
  const notionsStr = ctx.notions
    .map(
      (n) =>
        `- ${n.nom} (niveau ${niveau(n)}, chapitre ${n.chapitre})\n  Compétences: ${n.competences.join(', ')}\n  Objectifs: ${n.objectifs.join(', ')}`,
    )
    .join('\n')

  const exemplesStr = ctx.exemples_pedagogiques
    .map((e, i) => `Exemple ${i + 1} (score ${e.score}): ${e.contenu}`)
    .join('\n\n')

  const refsStr = ctx.references_style
    .map((r, i) => `Référence ${i + 1} (${r.niveau} / ${r.chapitre}):\n${r.extrait}`)
    .join('\n\n---\n\n')

  const reglesStr = Object.entries(ctx.regles)
    .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
    .join('\n')

  const ctxClasseStr = ctx.contexte_classe
    ? `Contexte classe imposé (à intégrer obligatoirement) :\n${JSON.stringify(ctx.contexte_classe, null, 2)}`
    : 'Aucun contexte classe spécifique.'

  const tonInstruction =
    version === 'v1'
      ? `Style v1 (sobre, canonique) :
- Ton neutre et professionnel.
- Formulations classiques.
- Exemples canoniaux tirés du manuel.
- Méthode rédigée à l'infinitif.`
      : `Style v2 (engageant) :
- Ton vivant et engageant, accessible aux élèves.
- Exemples ancrés dans la vie courante (recette, sport, manga, jeux, etc.).
- Méthode reformulée en VERBES D'ACTION (Repérer, Calculer, Conclure...).
- Questions open qui suscitent la curiosity.`

  return `Tu es l'Agent Rédacteur d'une plateforme de génération de séquences pédagogiques francophones (collège/lycée).
Tu produis UNE section de fiche pédagogique à la fois, en français, à partir d'un GenerationContext fourni.

${tonInstruction}

=== SÉQUENCE ===
Titre : ${ctx.sequence_titre}
Template : ${ctx.template_version}
Curriculum : ${ctx.curriculum_version}

=== NOTIONS À COUVRIR (ne pas inventer d'autres notions) ===
${notionsStr}

=== EXEMPLES PÉDAGOGIQUES (puises tes exemples ici) ===
${exemplesStr || '(aucun exemple disponible — inventes-en en restant fidèle aux objectifs)'}

=== RÉFÉRENCES DE STYLE (imite la structure, pas le contenu) ===
${refsStr || '(aucune référence disponible)'}

=== RÈGLES PÉDAGOGIQUES DU NIVEAU ===
${reglesStr || '(aucune règle spécifique)'}

=== CONTEXTE CLASSE ===
${ctxClasseStr}

=== FORMAT DE SORTIE OBLIGATOIRE (JSON) ===
{
  "section_id": "<id de la section demandée>",
  "contenu": "<contenu rédigé en français, markdown, structuré>",
  "methode": "<résumé méthodologique en 1-3 phrases, peut être null pour les sections non-méthodologiques>"
}

RÈGLES :
- Réponds UNIQUEMENT avec le JSON, sans texte autour, sans markdown code fences.
- Le contenu doit être substantiel (60-300 mots selon la section).
- Tout doit être en français.
- N'invente jamais d'objectifs ou de notions non présents dans le contexte.`
}

function niveau(n: { niveau: string }): string {
  return n.niveau
}

// ============================================================
// User prompt pour une section donnée
// ============================================================
function buildUserPrompt(
  sectionId: FicheSectionId,
  ctx: GenerationContext,
): string {
  const label = SECTION_LABELS[sectionId]
  const conseils: Record<FicheSectionId, string> = {
    objectifs: `Liste 3 à 5 objectifs pédagogiques précis en utilisant des verbes d'action (Identifier, Calculer, Démontrer...). Formulation en "L'élève sera capable de..."`,
    prerequis: `Liste les prérequis mobilisés par les notions à couvrir, en distinguant prérequis obligatoires et recommandés.`,
    deroulement: `Déroule la séquence en 4 à 6 étapes chronologiques avec durée indicative (durée totale cohérente avec ${JSON.stringify(ctx.contexte_classe?.duree_min ?? 50)} min si contexte renseigné). Pour chaque étape : titre, durée, démarche.`,
    activites: `Décris 2 à 4 activités proposées (une d'introduction, une de recherche, une d'institutionnalisation). Chaque activité : but, modalité, supports.`,
    differentiation: `Propose au moins 2 axes de différenciation (par supports, par tâches, par groupes). Cible explicite des élèves fragiles et des élèves avancés.`,
    evaluation: `Construis une évaluation avec 3 à 5 critères de réussite explicites. Mixte ouvert/fermé.`,
    prolongement: `Ouvre vers 1 ou 2 prolongements interdisciplinaires ou notion suivante dans la progression.`,
  }
  return `Rédige la section "${sectionId}" (${label}).

${conseils[sectionId]}

Réponds avec le JSON imposé.`
}

// ============================================================
// parseLLMResponse — extrait le JSON de la sortie LLM, fallback texte
// P0-1 : validation Zod du SectionContent produit avant de le retourner
// ============================================================
function parseLLMResponse(
  sectionId: string,
  raw: string,
): SectionContent {
  let candidate: SectionContent | null = null

  // 1. Tentative : JSON direct
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.contenu === 'string') {
      candidate = {
        section_id: parsed.section_id || sectionId,
        contenu: parsed.contenu,
        methode: parsed.methode ?? null,
      }
    }
  } catch {
    // pass
  }
  // 2. Tentative : JSON dans code fence
  if (!candidate) {
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]+?)```/i)
    if (fenceMatch) {
      try {
        const parsed = JSON.parse(fenceMatch[1])
        if (parsed && typeof parsed.contenu === 'string') {
          candidate = {
            section_id: parsed.section_id || sectionId,
            contenu: parsed.contenu,
            methode: parsed.methode ?? null,
          }
        }
      } catch {
        // pass
      }
    }
  }
  // 3. Tentative : extraire un objet { ... }
  if (!candidate) {
    const objMatch = raw.match(/\{[\s\S]*\}/)
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0])
        if (parsed && typeof parsed.contenu === 'string') {
          candidate = {
            section_id: parsed.section_id || sectionId,
            contenu: parsed.contenu,
            methode: parsed.methode ?? null,
          }
        }
      } catch {
        // pass
      }
    }
  }
  // 4. Fallback : texte brut → on prend tout comme contenu
  if (!candidate) {
    candidate = {
      section_id: sectionId,
      contenu: raw.trim(),
      methode: null,
    }
  }

  // P0-1 : validation Zod avant retour — garantit le contrat SectionContent
  return validateOrThrow(validateSectionContent(candidate), `Rédacteur.parseLLMResponse(${sectionId})`)
}

// ============================================================
// generateSectionPair — génère UNE section via z-ai-web-dev-sdk
// v1 = sobre/canonique ; v2 = engageant/exemples vie courante/méthode en verbes d'action
// ============================================================
export async function generateSectionPair(
  sectionId: FicheSectionId,
  ctx: GenerationContext,
  version: 'v1' | 'v2' = 'v1',
): Promise<{ content: SectionContent; raw: string; duration_ms: number; ok: boolean; error?: string }> {
  // Guard P0-5 : validation des entrées
  if (!sectionId || typeof sectionId !== 'string') {
    throw new Error(`generateSectionPair: paramètre 'sectionId' invalide (reçu: ${typeof sectionId})`)
  }
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('generateSectionPair: paramètre "ctx" (GenerationContext) manquant ou invalide')
  }
  if (!ctx.notions || !Array.isArray(ctx.notions) || ctx.notions.length === 0) {
    throw new Error('generateSectionPair: ctx.notions est vide ou invalide — le Rédacteur ne peut pas générer sans notion à couvrir')
  }
  if (version !== 'v1' && version !== 'v2') {
    throw new Error(`generateSectionPair: version doit être "v1" ou "v2" (reçu: "${version}")`)
  }

  const start = Date.now()
  const systemPrompt = buildSystemPrompt(ctx, version)
  const userPrompt = buildUserPrompt(sectionId, ctx)

  try {
    // P4-2 (Sprint 4) : Rate limiting LLM — protège contre 429, queue FIFO, circuit breaker
    const completion = await llmRateLimiter.execute(async () => {
      const zai = await ZAI.create()
      return zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: version === 'v1' ? 0.4 : 0.6,
        // @ts-expect-error - max_tokens est accepté par l'API
        max_tokens: version === 'v1' ? 900 : 1100,
      })
    }, 3) // max 3 retries avec backoff 1s/2s/4s
    const raw =
      completion?.choices?.[0]?.message?.content ??
      completion?.choices?.[0]?.delta?.content ??
      (typeof completion === 'string' ? completion : '')
    const content = parseLLMResponse(sectionId, typeof raw === 'string' ? raw : JSON.stringify(raw))
    const duration = Date.now() - start
    metrics.recordLatency('redacteur_llm', duration, { section_id: sectionId, version })
    metrics.incrementCounter('redacteur_llm_completed')
    return { content, raw: typeof raw === 'string' ? raw : JSON.stringify(raw), duration_ms: duration, ok: true }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    metrics.incrementCounter('redacteur_llm_failed')
    // Fallback gracieux : contenu dégradé pour ne pas crasher le pipeline
    const degraded: SectionContent = {
      section_id: sectionId,
      contenu: `[Section "${SECTION_LABELS[sectionId]}" — contenu de secours (LLM indisponible : ${errMsg})]\n\nVoir la fiche de référence et les exemples pédagogiques fournis dans le contexte pour cette section.`,
      methode: null,
    }
    return { content: degraded, raw: '', duration_ms: Date.now() - start, ok: false, error: errMsg }
  }
}

// ============================================================
// Génère toutes les sections d'une fiche en une passe (séquentiel)
// ============================================================
export async function generateAllSections(
  sectionIds: readonly FicheSectionId[],
  ctx: GenerationContext,
  version: 'v1' | 'v2' = 'v1',
  onProgress?: (section: FicheSectionId, content: SectionContent, ok: boolean) => void,
): Promise<{ sections: SectionContent[]; errors: string[]; duration_ms: number }> {
  const start = Date.now()
  const sections: SectionContent[] = []
  const errors: string[] = []
  for (const sid of sectionIds) {
    const { content, ok, error } = await generateSectionPair(sid, ctx, version)
    sections.push(content)
    if (!ok && error) errors.push(`${sid}: ${error}`)
    onProgress?.(sid, content, ok)
  }
  return { sections, errors, duration_ms: Date.now() - start }
}
