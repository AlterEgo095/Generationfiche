// Agent Critique — Architecture Élite v2 §4 + §5
// DEUX COUCHES :
//   1. validateStructurel — TypeScript pur, rapide, TOUJOURS exécuté
//      - sections présentes / format / champs obligatoires / longueurs min / durées cohérentes
//      - FAIL → retour ciblé au Rédacteur, AUCUN appel LLM
//   2. validatePedagogique — LLM, SEULEMENT si (1) PASS
//      - v1: 3 dimensions (clarté, cohérence progression, pertinence exemples), notées /4
//      - v2: ajoute adéquation au contexte_classe si présent, sinon retombe sur v1
//      - FAIL → retour ciblé (section_a_regenerer)
//      - PASS → ValidationResult(valide=true)
//
// Périmètre d'autonomie : décision pass/fail, ciblage régénération.
// JAMAIS autonome sur : les critères eux-mêmes (fixes).

import ZAI from 'z-ai-web-dev-sdk'
import { FICHE_TEMPLATE_V1_SECTIONS, SECTION_LABELS, type FicheSectionId } from '@/lib/contracts'
import type { GenerationContext, SectionContent, ValidationResult } from '@/lib/contracts'
import { validateValidationResult, validateOrThrow } from '@/lib/validate'
import { llmRateLimiter } from '@/lib/llm-limiter'
import { metrics } from '@/lib/metrics'

// ============================================================
// validateStructurel — TypeScript pur, aucune LLM
// Vérifie :
//   - toutes les sections obligatoires présentes
//   - contenu non vide pour chaque section obligatoire
//   - longueur min (en mots) par section selon les règles longueur_section.min_mots
//   - cohérence des durées si déroulement mentionne des durées
// ============================================================
export function validateStructurel(
  sections: SectionContent[],
  ctx: GenerationContext,
): ValidationResult {
  // Guard P0-5 : validation des entrées
  if (!sections || !Array.isArray(sections)) {
    throw new Error(`validateStructurel: paramètre 'sections' doit être un tableau (reçu: ${typeof sections})`)
  }
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('validateStructurel: paramètre "ctx" (GenerationContext) manquant ou invalide')
  }
  if (!ctx.notions || !Array.isArray(ctx.notions)) {
    throw new Error('validateStructurel: ctx.notions invalide')
  }

  const raisons: string[] = []
  const sectionsById = new Map<string, SectionContent>()
  for (const s of sections) sectionsById.set(s.section_id, s)

  // 1. Présence des sections obligatoires (prolongement est optionnel)
  const obligatoires: FicheSectionId[] = FICHE_TEMPLATE_V1_SECTIONS.filter(
    (s) => s !== 'prolongement',
  )
  for (const sid of obligatoires) {
    if (!sectionsById.has(sid)) {
      raisons.push(`Section obligatoire manquante : "${sid}" (${SECTION_LABELS[sid]})`)
    }
  }

  // 2. Contenu non vide
  for (const sid of obligatoires) {
    const s = sectionsById.get(sid)
    if (!s) continue
    const contenu = (s.contenu || '').trim()
    if (contenu.length < 10) {
      raisons.push(`Section "${sid}" trop courte (contenu vide ou quasi vide)`)
    }
    // On n'accepte pas les contenus de secours LLM-disponible
    if (/LLM indisponible|contenu de secours/i.test(contenu)) {
      raisons.push(`Section "${sid}" — contenu de secours, à régénérer`)
    }
  }

  // 3. Longueur min (en mots) selon règles longueur_section.min_mots
  const longueurRegle = ctx.regles.longueur_section as { min_mots?: number; max_mots?: number } | undefined
  const minMotsGlobal = longueurRegle?.min_mots ?? 40
  const seuilsParSection: Record<FicheSectionId, number> = {
    objectifs: Math.max(minMotsGlobal, 40),
    prerequis: Math.max(minMotsGlobal, 20),
    deroulement: Math.max(minMotsGlobal, 120),
    activites: Math.max(minMotsGlobal, 80),
    differentiation: Math.max(minMotsGlobal, 40),
    evaluation: Math.max(minMotsGlobal, 40),
    prolongement: Math.max(minMotsGlobal, 20),
  }
  for (const sid of FICHE_TEMPLATE_V1_SECTIONS) {
    const s = sectionsById.get(sid)
    if (!s) continue
    const mots = (s.contenu || '').trim().split(/\s+/).filter(Boolean).length
    if (mots < seuilsParSection[sid]) {
      raisons.push(
        `Section "${sid}" — ${mots} mots < seuil min ${seuilsParSection[sid]} mots`,
      )
    }
  }

  // 4. Cohérence des durées : si déroulement mentionne X min et contexte_classe.duree_min présent,
  // on vérifie qu'ils sont proches (±20%)
  const deroulement = sectionsById.get('deroulement')
  if (deroulement && ctx.contexte_classe?.duree_min) {
    const dureeCible = Number(ctx.contexte_classe.duree_min)
    const dureeMatches = (deroulement.contenu.match(/(\d+)\s*min/gi) || []).map((s) =>
      parseInt(s, 10),
    )
    if (dureeMatches.length > 0 && !Number.isNaN(dureeCible)) {
      const somme = dureeMatches.reduce((a, b) => a + b, 0)
      if (somme > 0 && Math.abs(somme - dureeCible) / dureeCible > 0.25) {
        raisons.push(
          `Cohérence des durées : somme ${somme} min vs contexte classe ${dureeCible} min (écart > 25%)`,
        )
      }
    }
  }

  const pass = raisons.length === 0
  // Si fail, on identifie une section_a_regenerer (la première section en défaut)
  // On cherche les raisons qui mentionnent un section_id — soit "Section "sid"" soit "manquante : "sid""
  let section_a_regenerer: string | null = null
  if (!pass) {
    for (const sid of FICHE_TEMPLATE_V1_SECTIONS) {
      if (raisons.some((r) => r.includes(`"${sid}"`))) {
        section_a_regenerer = sid
        break
      }
    }
    if (!section_a_regenerer) section_a_regenerer = 'deroulement'
  }

  const result: ValidationResult = {
    structurel_pass: pass,
    structurel_raisons: raisons,
    pedagogique_pass: null,
    pedagogique_raisons: null,
    section_a_regenerer: pass ? null : section_a_regenerer,
    couche_declenchee: 'structurel',
  }

  // P0-1 : validation Zod du ValidationResult avant retour
  return validateOrThrow(validateValidationResult(result), 'Critique.validateStructurel')
}

// ============================================================
// validatePedagogique — LLM, SEULEMENT si structurel PASS
// v1: 3 dimensions notées /4 (clarté, cohérence progression, pertinence exemples)
// v2: ajoute adéquation au contexte_classe si présent, sinon retombe sur v1
// Pass si toutes ≥ 3
// ============================================================
export async function validatePedagogique(
  sections: SectionContent[],
  ctx: GenerationContext,
  version: 'v1' | 'v2' = 'v1',
): Promise<ValidationResult & { scores?: Record<string, number>; raw?: string; duration_ms?: number; ok?: boolean }> {
  // Guard P0-5 : validation des entrées
  if (!sections || !Array.isArray(sections)) {
    throw new Error(`validatePedagogique: paramètre 'sections' doit être un tableau (reçu: ${typeof sections})`)
  }
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('validatePedagogique: paramètre "ctx" (GenerationContext) manquant ou invalide')
  }
  if (version !== 'v1' && version !== 'v2') {
    throw new Error(`validatePedagogique: version doit être "v1" ou "v2" (reçu: "${version}")`)
  }

  const start = Date.now()

  // Détermine si on active la dimension contexte_classe (v2 + contexte présent)
  const activeContexte = version === 'v2' && !!ctx.contexte_classe
  const dimensions = activeContexte
    ? ['clarte', 'coherence_progression', 'pertinence_exemples', 'adequation_contexte_classe']
    : ['clarte', 'coherence_progression', 'pertinence_exemples']

  const labelsDim: Record<string, string> = {
    clarte: 'Clarté (formulations accessibles aux élèves)',
    coherence_progression: 'Cohérence de la progression (prérequis → objectifs → évaluation)',
    pertinence_exemples: 'Pertinence des exemples (ancrage dans les exemples pédagogiques fournis)',
    adequation_contexte_classe: 'Adéquation au contexte classe (effectif, matériel, durée)',
  }

  const systemPrompt = `Tu es l'Agent Critique pédagogique d'une plateforme de génération de séquences francophones.
Tu évalues une fiche pédagogique produite par l'Agent Rédacteur sur ${dimensions.length} dimensions, chacune notée sur 4.

Dimensions à évaluer :
${dimensions.map((d) => `- "${d}": ${labelsDim[d]}`).join('\n')}

Barème par dimension :
- 4 = excellent
- 3 = suffisant
- 2 = insuffisant
- 1 = très insuffisant

=== NOTIONS À COUVRIR ===
${ctx.notions.map((n) => `${n.nom} (objectifs: ${n.objectifs.join(', ')})`).join('\n')}

=== EXEMPLES PÉDAGOGIQUES DISPONIBLES ===
${ctx.exemples_pedagogiques.map((e, i) => `${i + 1}. ${e.contenu.slice(0, 200)}...`).join('\n')}

${activeContexte ? `=== CONTEXTE CLASSE À RESPECTER ===\n${JSON.stringify(ctx.contexte_classe, null, 2)}` : '=== PAS DE CONTEXTE CLASSE À ÉVALUER ==='}

=== FORMAT DE SORTIE OBLIGATOIRE (JSON) ===
{
  "scores": {
    ${dimensions.map((d) => `"${d}": <note 1-4>`).join(',\n    ')}
  },
  "raisons": {
    ${dimensions.map((d) => `"${d}": "<courte justification en français>"`).join(',\n    ')}
  },
  "section_a_regenerer": "<id de la section la plus faible, ou null si tout est suffisant>"
}

Réponds UNIQUEMENT avec le JSON, sans texte autour, sans code fences.`

  const ficheStr = sections
    .map((s) => `### Section "${s.section_id}" (${SECTION_LABELS[s.section_id as FicheSectionId] || s.section_id})\n${s.contenu}`)
    .join('\n\n---\n\n')

  const userPrompt = `Évalue la fiche suivante et renvoie le JSON imposé.

${ficheStr}`

  try {
    // P4-2 (Sprint 4) : Rate limiting LLM — protège contre 429, queue FIFO, circuit breaker
    const completion = await llmRateLimiter.execute(async () => {
      const zai = await ZAI.create()
      return zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        // @ts-expect-error - max_tokens accepté
        max_tokens: 700,
      })
    }, 3)
    const raw =
      completion?.choices?.[0]?.message?.content ??
      completion?.choices?.[0]?.delta?.content ??
      (typeof completion === 'string' ? completion : '')
    const rawStr = typeof raw === 'string' ? raw : JSON.stringify(raw)

    const parsed = parseCritiqueJSON(rawStr)
    const scores = parsed.scores || {}
    // P1-2 (Sprint 3) — FAIL-SAFE : dimensions manquantes notées 0 (pessimiste), pas 4 (optimiste).
    // Avant : dimensions manquantes → 4/4 (faille optimiste, une fiche non évaluée passait)
    // Après  : dimensions manquantes → 0/4 (fail-safe, la fiche est rejetée)
    for (const d of dimensions) {
      if (typeof scores[d] !== 'number' || Number.isNaN(scores[d])) scores[d] = 0
    }
    const allSufficient = dimensions.every((d) => Number(scores[d]) >= 3)
    const raisons = dimensions.map((d) => `${labelsDim[d]}: ${scores[d]}/4 — ${parsed.raisons?.[d] || ''}`)
    const section_a_regenerer = allSufficient ? null : (parsed.section_a_regenerer ?? 'deroulement')

    const result = {
      structurel_pass: true, // structurel déjà PASS quand on appelle pedagogique
      structurel_raisons: [],
      pedagogique_pass: allSufficient,
      pedagogique_raisons: raisons,
      section_a_regenerer,
      couche_declenchee: 'pedagogique' as const,
      scores,
      raw: rawStr,
      duration_ms: Date.now() - start,
      ok: true,
    }
    // P0-1 : validation Zod du ValidationResult (base) avant retour
    validateOrThrow(validateValidationResult(result), 'Critique.validatePedagogique(success)')
    metrics.recordLatency('critique_llm', Date.now() - start, { version })
    metrics.incrementCounter('critique_llm_completed')
    return result
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    metrics.incrementCounter('critique_llm_failed')
    // P1-2 (Sprint 3) — FAIL-SAFE : aucune fiche non évaluée ne doit être publiée.
    // Avant : LLM KO → pedagogique_pass=true (fail-open, dangereux)
    // Après  : LLM KO → pedagogique_pass=false (fail-safe, escalade humaine)
    // Le pipeline fera un retry limité puis escaladera vers un humain.
    const result = {
      structurel_pass: true,
      structurel_raisons: [],
      pedagogique_pass: false,
      pedagogique_raisons: [`Validation pédagogique impossible : service critique indisponible (${errMsg}). Refus automatique par sécurité.`],
      section_a_regenerer: 'deroulement', // section cible pour un éventuel retry
      couche_declenchee: 'pedagogique' as const,
      scores: dimensions.reduce((acc, d) => ({ ...acc, [d]: 0 }), {}),
      raw: '',
      duration_ms: Date.now() - start,
      ok: false,
      error: errMsg,
    }
    // P0-1 : validation Zod du ValidationResult (base) avant retour
    validateOrThrow(validateValidationResult(result), 'Critique.validatePedagogique(failsafe)')
    return result
  }
}

function parseCritiqueJSON(raw: string): {
  scores: Record<string, number>
  raisons: Record<string, string>
  section_a_regenerer: string | null
} {
  // 1. JSON direct
  try {
    const p = JSON.parse(raw)
    return normalize(p)
  } catch {
    // pass
  }
  // 2. code fence
  const fence = raw.match(/```(?:json)?\s*([\s\S]+?)```/i)
  if (fence) {
    try {
      return normalize(JSON.parse(fence[1]))
    } catch {
      // pass
    }
  }
  // 3. objet extrait
  const obj = raw.match(/\{[\s\S]*\}/)
  if (obj) {
    try {
      return normalize(JSON.parse(obj[0]))
    } catch {
      // pass
    }
  }
  return { scores: {}, raisons: {}, section_a_regenerer: null }
}

function normalize(p: any): {
  scores: Record<string, number>
  raisons: Record<string, string>
  section_a_regenerer: string | null
} {
  const scores: Record<string, number> = {}
  if (p && typeof p.scores === 'object') {
    for (const [k, v] of Object.entries(p.scores)) {
      scores[k] = Number(v) || 0
    }
  }
  const raisons: Record<string, string> = {}
  if (p && typeof p.raisons === 'object') {
    for (const [k, v] of Object.entries(p.raisons)) {
      raisons[k] = String(v)
    }
  }
  return {
    scores,
    raisons,
    section_a_regenerer: p?.section_a_regenerer ?? null,
  }
}
