// Catalogue des skills versionnées — Architecture Élite v2 §6
// Les skills les plus critiques sont versionnées (v1/v2) pour permettre
// la comparaison A/B sans casser les générations déjà commises et signées.

export interface SkillDescriptor {
  id: string
  nom: string
  version: string // "v1" | "v2"
  agent: 'redacteur' | 'critique' | 'planificateur' | 'knowledge_compiler' | 'superviseur'
  description: string
  critique: string // ce qui change vs l'autre version
  active: boolean
  parametres: { cle: string; type: 'int' | 'string' | 'bool'; defaut: string; description: string }[]
}

export const SKILLS_CATALOG: SkillDescriptor[] = [
  {
    id: 'generate_section_pair_v1',
    nom: 'generate_section_pair',
    version: 'v1',
    agent: 'redacteur',
    description:
      "Génère le couple (contenu, méthode) d'une section à partir du GenerationContext. Style sobre, exemples canoniaques.",
    critique: 'Version de référence. Ton neutre, exemples courts. Utilisée pour le benchmark A/B.',
    active: true,
    parametres: [
      { cle: 'temperature', type: 'int', defaut: '0.4', description: 'Température LLM' },
      { cle: 'max_tokens', type: 'int', defaut: '900', description: 'Longueur max par section' },
    ],
  },
  {
    id: 'generate_section_pair_v2',
    nom: 'generate_section_pair',
    version: 'v2',
    agent: 'redacteur',
    description:
      "Variante expérimentale : ton plus engageant, exemples ancrés dans la vie courante, méthode reformulée en verbes d'action.",
    critique: "Plus vivante en classe. À valider sur 3 séquences avant activation globale.",
    active: true,
    parametres: [
      { cle: 'temperature', type: 'int', defaut: '0.6', description: 'Température LLM (plus créative)' },
      { cle: 'max_tokens', type: 'int', defaut: '1100', description: 'Longueur max par section' },
      { cle: 'ton', type: 'string', defaut: 'engageant', description: 'Ton appliqué au contenu' },
    ],
  },
  {
    id: 'validate_pedagogique_v1',
    nom: 'validate_pedagogique',
    version: 'v1',
    agent: 'critique',
    description:
      "Évalue la clarté, la cohérence de progression et la pertinence des exemples. Critères : 3 dimensions notées sur 4.",
    critique: 'Critères fixes. Réutilise les mêmes rubriques pour toutes les séquences.',
    active: true,
    parametres: [
      { cle: 'seuil_clarte', type: 'int', defaut: '3', description: 'Note minimale sur 4 pour clarté' },
    ],
  },
  {
    id: 'validate_pedagogique_v2',
    nom: 'validate_pedagogique',
    version: 'v2',
    agent: 'critique',
    description:
      "Ajoute une 4e dimension : adéquation au contexte_classe (effectif, matériel) si renseigné. Sinon, retombe sur v1.",
    critique: 'Active le critère contexte_classe uniquement quand le JSON est présent.',
    active: true,
    parametres: [
      { cle: 'seuil_clarte', type: 'int', defaut: '3', description: 'Note minimale sur 4 pour clarté' },
      { cle: 'penalite_contexte', type: 'int', defaut: '1', description: 'Pénalité si contexte ignoré' },
    ],
  },
  {
    id: 'resolve_batch_plan',
    nom: 'resolve_batch_plan',
    version: 'v1',
    agent: 'planificateur',
    description:
      "Décompose une demande batch en file de Sequence. Tri : progression.semaine ASC, priorite DESC. Vérifie les prérequis par séquence.",
    critique: 'Tri simple. Pas de moteur de disponibilité enseignants (hors scope §8).',
    active: true,
    parametres: [
      { cle: 'max_par_batch', type: 'int', defaut: '20', description: 'Limite de séquences par batch' },
    ],
  },
  {
    id: 'check_prerequisites_covered',
    nom: 'check_prerequisites_covered',
    version: 'v1',
    agent: 'planificateur',
    description:
      "Pour une séquence, vérifie que tous les prerequis_ids de ses notions sont couverts par les séquences antérieures (semaine <).",
    critique: 'Couverture = présence en semaine antérieure. Ne vérifie pas la validation du livrable.',
    active: true,
    parametres: [],
  },
  {
    id: 'fetch_curriculum_spec',
    nom: 'fetch_curriculum_spec',
    version: 'v1',
    agent: 'knowledge_compiler',
    description: "Charge la CurriculumSpec d'une notion depuis le référentiel (notion + prerequis + compétences).",
    critique: 'Lecture pure. Déterministe.',
    active: true,
    parametres: [],
  },
  {
    id: 'retrieve_pedagogical_examples',
    nom: 'retrieve_pedagogical_examples',
    version: 'v1',
    agent: 'knowledge_compiler',
    description:
      "Recherche sémantique large sur corpus_vectoriel WHERE type='exemple_pedagogique'. Renvoie les k plus proches par similarité cosinus sur embeddings TF-IDF.",
    critique: 'k=5 par défaut. Pas de filtre niveau (large volontairement).',
    active: true,
    parametres: [
      { cle: 'k', type: 'int', defaut: '5', description: 'Nombre d\'exemples récupérés' },
    ],
  },
  {
    id: 'retrieve_style_reference',
    nom: 'retrieve_style_reference',
    version: 'v1',
    agent: 'knowledge_compiler',
    description:
      "Filtre strict : type='fiche_reference' AND statut='validee' AND exemplaire=true AND niveau=X AND chapitre=Y. Tri par récence, top 3.",
    critique: "Seules les fiches explicitement marquées exemplaires nourrissent le style.",
    active: true,
    parametres: [
      { cle: 'k', type: 'int', defaut: '3', description: 'Nombre de références de style' },
    ],
  },
  {
    id: 'render_fiche',
    nom: 'render_fiche',
    version: 'v1',
    agent: 'superviseur',
    description:
      "Assemble les SectionContent[] en un RenderedDocument final selon le template_version. Ajoute en-tête, numérotation, cohérence des durées.",
    critique: 'Rendu Markdown. Export HTML et PDF possibles en aval.',
    active: true,
    parametres: [],
  },
  {
    id: 'export_render',
    nom: 'export_render',
    version: 'v1',
    agent: 'superviseur',
    description: "Exporte le livrable dans le format demandé (markdown, html, pdf).",
    critique: 'PDF généré via template HTML.',
    active: true,
    parametres: [
      { cle: 'format', type: 'string', defaut: 'markdown', description: 'Format de sortie' },
    ],
  },
  {
    id: 'commit_batch',
    nom: 'commit_batch',
    version: 'v1',
    agent: 'superviseur',
    description: "Marque les livrables comme validés, enregistre les agent_run, clôture le batch.",
    critique: 'Atomicité par séquence. Escalade humaine si échec persistant après N retries.',
    active: true,
    parametres: [
      { cle: 'max_retries', type: 'int', defaut: '2', description: 'Retries max par section' },
    ],
  },
]

export function getSkill(id: string): SkillDescriptor | undefined {
  return SKILLS_CATALOG.find((s) => s.id === id)
}

export function getActiveVersion(nom: string, version?: string): SkillDescriptor | undefined {
  if (version) return SKILLS_CATALOG.find((s) => s.nom === nom && s.version === version)
  // version par défaut = v1
  return SKILLS_CATALOG.find((s) => s.nom === nom && s.version === 'v1')
}

export function listVersions(nom: string): SkillDescriptor[] {
  return SKILLS_CATALOG.filter((s) => s.nom === nom).sort((a, b) => a.version.localeCompare(b.version))
}
