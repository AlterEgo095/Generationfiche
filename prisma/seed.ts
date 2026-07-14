// Seed — Architecture Élite v2
// Curriculum français (collège/lycée) : notions maths + sciences, prérequis, progressions,
// exemples pédagogiques, fiches de référence marquées exemplaires, template v1, règles.

import { db } from '@/lib/db'

async function main() {
  console.log('🌱 Seed — Architecture Élite v2')

  // Reset (ordre FK-safe)
  await db.validationResult.deleteMany()
  await db.livrable.deleteMany()
  await db.generationContext.deleteMany()
  await db.agentRun.deleteMany()
  await db.sequenceNotion.deleteMany()
  await db.sequence.deleteMany()
  await db.progression.deleteMany()
  await db.prerequis.deleteMany()
  await db.corpusVectoriel.deleteMany()
  await db.regle.deleteMany()
  await db.notion.deleteMany()
  await db.ficheTemplate.deleteMany()

  // =========================================================
  // Fiche template v1
  // =========================================================
  await db.ficheTemplate.create({
    data: {
      version: 'v1',
      nom: 'Fiche pédagogique — template v1',
      structure: JSON.stringify({
        sections: [
          { id: 'objectifs', label: 'Objectifs pédagogiques', obligatoire: true, min_mots: 40 },
          { id: 'prerequis', label: 'Prérequis mobilisés', obligatoire: true, min_mots: 20 },
          { id: 'deroulement', label: 'Déroulement de la séquence', obligatoire: true, min_mots: 120, duree_min: 50 },
          { id: 'activites', label: 'Activités proposées', obligatoire: true, min_mots: 80 },
          { id: 'differentiation', label: 'Différenciation', obligatoire: true, min_mots: 40 },
          { id: 'evaluation', label: 'Évaluation', obligatoire: true, min_mots: 40 },
          { id: 'prolongement', label: 'Prolongement', obligatoire: false, min_mots: 20 },
        ],
        contraintes: {
          ton: 'professionnel, accessible, formulation en verbes d\'action',
          format_questions: 'mixte ouvert/fermé',
        },
      }),
      active: true,
    },
  })

  // =========================================================
  // Notions — maths & sciences (collège)
  // =========================================================
  const notions = [
    {
      id: 'notion_frac',
      nom: 'Fractions et opérations',
      description: 'Addition, soustraction, multiplication de fractions. Sens, propriétés, réduction.',
      niveau: '5e',
      chapitre: 'Nombres et calculs',
      competences: ['Calculer avec des fractions', 'Résoudre des problèmes fractionnaires'],
      objectifs: ['Additionner des fractions de dénominateurs différents', 'Simplifier une fraction'],
    },
    {
      id: 'notion_dec',
      nom: 'Nombres décimaux',
      description: 'Écriture, comparaison, opérations sur les décimaux. Lien fraction/décimal.',
      niveau: '6e',
      chapitre: 'Nombres et calculs',
      competences: ['Comparer des décimaux', 'Calculer avec des décimaux'],
      objectifs: ['Passer de l\'écriture fractionnaire au décimal', 'Encadrer un décimal'],
    },
    {
      id: 'notion_prop',
      nom: 'Proportionnalité',
      description: 'Reconnaître et utiliser des situations de proportionnalité. Échelles, pourcentages.',
      niveau: '5e',
      chapitre: 'Organisation et gestion de données',
      competences: ['Reconnaître une situation de proportionnalité', 'Calculer un pourcentage'],
      objectifs: ['Utiliser le coefficient de proportionnalité', 'Résoudre un problème d\'échelle'],
    },
    {
      id: 'notion_thales',
      nom: 'Théorème de Thalès',
      description: 'Énoncé, configurations, applications au calcul de longueurs.',
      niveau: '4e',
      chapitre: 'Géométrie',
      competences: ['Appliquer le théorème de Thalès', 'Conduire un raisonnement géométrique'],
      objectifs: ['Identifier une configuration de Thalès', 'Calculer une longueur manquante'],
    },
    {
      id: 'notion_pyth',
      nom: 'Théorème de Pythagore',
      description: 'Énoncé direct et contraposée. Applications au calcul de longueurs et de distances.',
      niveau: '4e',
      chapitre: 'Géométrie',
      competences: ['Appliquer le théorème de Pythagore', 'Démontrer qu\'un triangle est rectangle'],
      objectifs: ['Calculer une longueur dans un triangle rectangle', 'Vérifier la nature d\'un triangle'],
    },
    {
      id: 'notion_eq',
      nom: 'Équations du premier degré',
      description: 'Résolution algébrique. Problèmes menant à une équation.',
      niveau: '4e',
      chapitre: 'Nombres et calculs',
      competences: ['Résoudre une équation du premier degré', 'Modéliser un problème'],
      objectifs: ['Isoler l\'inconnue', 'Traduire un énoncé en équation'],
    },
    {
      id: 'notion_cell',
      nom: 'La cellule, unité du vivant',
      description: 'Découverte de la cellule. Diversité cellulaire. Observation microscopique.',
      niveau: '5e',
      chapitre: 'Le vivant',
      competences: ['Utiliser un microscope', 'Identifier les organites cellulaires'],
      objectifs: ['Observer des cellules animales et végétales', 'Comparer différents types cellulaires'],
    },
    {
      id: 'notion_photo',
      nom: 'Photosynthèse',
      description: 'Conditions, équation bilan, importance pour les écosystèmes.',
      niveau: '5e',
      chapitre: 'Le vivant',
      competences: ['Formuler une hypothèse', 'Interpréter des résultats expérimentaux'],
      objectifs: ['Identifier les paramètres de la photosynthèse', 'Écrire l\'équation bilan'],
    },
  ]

  for (const n of notions) {
    await db.notion.create({
      data: {
        id: n.id,
        nom: n.nom,
        description: n.description,
        niveau: n.niveau,
        chapitre: n.chapitre,
        competences: JSON.stringify(n.competences),
        objectifs: JSON.stringify(n.objectifs),
      },
    })
  }

  // =========================================================
  // Prérequis
  // =========================================================
  const prerequis = [
    { notionId: 'notion_frac', prerequisId: 'notion_dec', obligation: 'obligatoire' },
    { notionId: 'notion_prop', prerequisId: 'notion_frac', obligation: 'recommande' },
    { notionId: 'notion_thales', prerequisId: 'notion_pyth', obligation: 'recommande' },
    { notionId: 'notion_eq', prerequisId: 'notion_frac', obligation: 'obligatoire' },
    { notionId: 'notion_photo', prerequisId: 'notion_cell', obligation: 'obligatoire' },
  ]
  for (const p of prerequis) {
    await db.prerequis.create({ data: p })
  }

  // =========================================================
  // Progression (semaines 1 à 8 sur 2 niveaux)
  // =========================================================
  const progressions = [
    { niveau: '6e', chapitre: 'Nombres et calculs', notionId: 'notion_dec', semaine: 3, dureeMin: 50 },
    { niveau: '5e', chapitre: 'Nombres et calculs', notionId: 'notion_frac', semaine: 6, dureeMin: 60 },
    { niveau: '5e', chapitre: 'Organisation et gestion de données', notionId: 'notion_prop', semaine: 9, dureeMin: 50 },
    { niveau: '4e', chapitre: 'Géométrie', notionId: 'notion_pyth', semaine: 12, dureeMin: 60 },
    { niveau: '4e', chapitre: 'Géométrie', notionId: 'notion_thales', semaine: 16, dureeMin: 70 },
    { niveau: '4e', chapitre: 'Nombres et calculs', notionId: 'notion_eq', semaine: 18, dureeMin: 60 },
    { niveau: '5e', chapitre: 'Le vivant', notionId: 'notion_cell', semaine: 4, dureeMin: 50 },
    { niveau: '5e', chapitre: 'Le vivant', notionId: 'notion_photo', semaine: 8, dureeMin: 60 },
  ]
  for (const p of progressions) {
    await db.progression.create({ data: p })
  }

  // =========================================================
  // Règles par niveau
  // =========================================================
  const regles = [
    { niveau: '6e', cle: 'style_ton', valeur: JSON.stringify('très accessible, exemples de la vie quotidienne') },
    { niveau: '6e', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 40, max_mots: 200 }) },
    { niveau: '5e', cle: 'style_ton', valeur: JSON.stringify('accessible, structuré, vocabulaire précis') },
    { niveau: '5e', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 50, max_mots: 250 }) },
    { niveau: '4e', cle: 'style_ton', valeur: JSON.stringify('rigoureux, formalisation progressive') },
    { niveau: '4e', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 60, max_mots: 300 }) },
    { niveau: '5e', cle: 'format_questions', valeur: JSON.stringify('mixte : 60% ouverts, 40% fermés') },
    { niveau: '4e', cle: 'format_questions', valeur: JSON.stringify('mixte : 70% ouverts, 30% fermés') },
    { niveau: '5e', cle: 'differentiation_obligatoire', valeur: JSON.stringify(true) },
    { niveau: '4e', cle: 'differentiation_obligatoire', valeur: JSON.stringify(true) },
  ]
  for (const r of regles) {
    await db.regle.create({ data: r })
  }

  // =========================================================
  // Corpus vectoriel — exemples pédagogiques (brouillon/validé)
  // =========================================================
  const exemples = [
    {
      id: 'ex_frac_1',
      contenu:
        "Exemple pédagogique : pour additionner 1/3 + 1/4, on cherche un dénominateur commun : 12. Alors 1/3 = 4/12 et 1/4 = 3/12, donc la somme vaut 7/12. On visualise avec un disque partagé en 12 parts égales. Cet exemple ancre le calcul dans une représentation géométrique.",
      type: 'exemple_pedagogique',
      niveau: '5e',
      chapitre: 'Nombres et calculs',
      statut: 'validee',
      notionId: 'notion_frac',
    },
    {
      id: 'ex_frac_2',
      contenu:
        "Exemple pédagogique : simplifier 18/24. On cherche le PGCD(18,24)=6. Donc 18/24 = 3/4. On fait le lien avec la division euclidienne. Activité : les élèves colorient 18 cases sur 24 d\'un quadrillage puis identifient le motif réduit.",
      type: 'exemple_pedagogique',
      niveau: '5e',
      chapitre: 'Nombres et calculs',
      statut: 'validee',
      notionId: 'notion_frac',
    },
    {
      id: 'ex_dec_1',
      contenu:
        "Exemple pédagogique : comparer 3,14 et 3,1415. On aligne les virgules, on complète par des zéros : 3,1400 vs 3,1415. Le deuxième est plus grand. On introduit l\'encadrement à l\'unité, au dixième, au centième.",
      type: 'exemple_pedagogique',
      niveau: '6e',
      chapitre: 'Nombres et calculs',
      statut: 'validee',
      notionId: 'notion_dec',
    },
    {
      id: 'ex_prop_1',
      contenu:
        "Exemple pédagogique : une recette pour 4 personnes utilise 200g de farine. Pour 6 personnes, on calcule le coefficient 6/4 = 1,5 et on multiplie : 300g. Activité : tableau de proportionnalité, on fait émerger le coefficient.",
      type: 'exemple_pedagogique',
      niveau: '5e',
      chapitre: 'Organisation et gestion de données',
      statut: 'validee',
      notionId: 'notion_prop',
    },
    {
      id: 'ex_prop_2',
      contenu:
        "Exemple pédagogique : sur un plan à l\'échelle 1/200, 5 cm représentent 10 m en réalité. On convertit, on calcule, on vérifie. On insiste sur la cohérence des unités avant tout calcul.",
      type: 'exemple_pedagogique',
      niveau: '5e',
      chapitre: 'Organisation et gestion de données',
      statut: 'brouillon',
      notionId: 'notion_prop',
    },
    {
      id: 'ex_pyth_1',
      contenu:
        "Exemple pédagogique : dans un triangle ABC rectangle en A, AB=3, AC=4. On calcule BC²=AB²+AC²=9+16=25, donc BC=5. On fait remarquer le triplet pythagoricien. Activité : corde à 13 nœuds pour illustrer.",
      type: 'exemple_pedagogique',
      niveau: '4e',
      chapitre: 'Géométrie',
      statut: 'validee',
      notionId: 'notion_pyth',
    },
    {
      id: 'ex_pyth_2',
      contenu:
        "Exemple pédagogique : une échelle de 5 m appuyée contre un mur atteint 4 m de haut. À quelle distance du pied du mur se trouve le bas de l\'échelle ? On modélise, on applique Pythagore, on trouve 3 m. Application concrète.",
      type: 'exemple_pedagogique',
      niveau: '4e',
      chapitre: 'Géométrie',
      statut: 'validee',
      notionId: 'notion_pyth',
    },
    {
      id: 'ex_thales_1',
      contenu:
        "Exemple pédagogique : configuration triangle avec droites parallèles. On identifie le sommet commun, on écrit les rapports, on applique le produit en croix. Activité : on fait varier les longueurs et on observe la conservation des rapports.",
      type: 'exemple_pedagogique',
      niveau: '4e',
      chapitre: 'Géométrie',
      statut: 'validee',
      notionId: 'notion_thales',
    },
    {
      id: 'ex_eq_1',
      contenu:
        "Exemple pédagogique : résoudre 2x + 5 = 11. On isole 2x = 6 en soustrayant 5, puis x = 3 en divisant par 2. On vérifie : 2*3+5=11. La balance à deux plateaux comme support visuel.",
      type: 'exemple_pedagogique',
      niveau: '4e',
      chapitre: 'Nombres et calculs',
      statut: 'validee',
      notionId: 'notion_eq',
    },
    {
      id: 'ex_eq_2',
      contenu:
        "Exemple pédagogique : un père a 40 ans, son fils 12. Dans combien d\'années l\'âge du père sera-t-il le double de celui du fils ? On pose 40+x = 2(12+x), on développe, on résout x=16. Modélisation puis résolution.",
      type: 'exemple_pedagogique',
      niveau: '4e',
      chapitre: 'Nombres et calculs',
      statut: 'brouillon',
      notionId: 'notion_eq',
    },
    {
      id: 'ex_cell_1',
      contenu:
        "Exemple pédagogique : observation d\'un échantillon d\'épiderme d\'oignon au microscope. Coloration au bleu de méthylène. On distingue les cellules rectangulaires alignées, le noyau coloré, la paroi cellulaire. Schéma à compléter.",
      type: 'exemple_pedagogique',
      niveau: '5e',
      chapitre: 'Le vivant',
      statut: 'validee',
      notionId: 'notion_cell',
    },
    {
      id: 'ex_photo_1',
      contenu:
        "Exemple pédagogique : on place un végétal en présence de CO2 marqué au carbone 14, on expose à la lumière. On récupère des sucres radioactifs. Conclusion : le CO2 est transformé en matière organique en présence de lumière.",
      type: 'exemple_pedagogique',
      niveau: '5e',
      chapitre: 'Le vivant',
      statut: 'validee',
      notionId: 'notion_photo',
    },
    {
      id: 'ex_photo_2',
      contenu:
        "Exemple pédagogique : expérience de l\'algue Elodea : on compte les bulles d\'O2 émises selon l\'intensité lumineuse. On trace un graphique, on conclut que la photosynthèse dépend de la lumière. Démarche d\'investigation.",
      type: 'exemple_pedagogique',
      niveau: '5e',
      chapitre: 'Le vivant',
      statut: 'validee',
      notionId: 'notion_photo',
    },
  ]

  for (const e of exemples) {
    await db.corpusVectoriel.create({
      data: { ...e, exemplaire: false, embedding: 'pending', metadata: JSON.stringify({ source: 'seed' }) },
    })
  }

  // =========================================================
  // Corpus vectoriel — fiches de référence marquées exemplaires
  // =========================================================
  const fichesRef = [
    {
      id: 'ref_frac_1',
      contenu:
        "Fiche de référence (extraits) — Les fractions en 5e. Objectifs : additionner des fractions de dénominateurs différents, simplifier. Prérequis : nombres décimaux. Déroulement : 1) Rappel sur la fraction comme partage, 2) Émergence du dénominateur commun sur un exemple simple, 3) Institutionnalisation de la méthode, 4) Exercices différenciés. Différenciation : élèves fragiles manipulent des disques fractionnés, élèves avancés abordent les fractions irréductibles. Évaluation : 4 questions courtes + 1 problème ouvert. Prolongement : lien avec les pourcentages.",
      type: 'fiche_reference',
      niveau: '5e',
      chapitre: 'Nombres et calculs',
      statut: 'validee',
      exemplaire: true,
      notionId: 'notion_frac',
    },
    {
      id: 'ref_pyth_1',
      contenu:
        "Fiche de référence (extraits) — Théorème de Pythagore en 4e. Objectifs : calculer une longueur, vérifier la nature d\'un triangle. Prérequis : carré d\'un nombre, racine carrée. Déroulement : 1) Activité d\'introduction avec la corde à 13 nœuds, 2) Conjecture sur des triplets, 3) Démonstration (découpage), 4) Institutionnalisation, 5) Exercices d\'application. Différenciation : support visuel pour les élèves en difficulté, exercice de démonstration pour les autres. Évaluation : 1 calcul direct, 1 problème concret, 1 démonstration. Prolongement : réciproque.",
      type: 'fiche_reference',
      niveau: '4e',
      chapitre: 'Géométrie',
      statut: 'validee',
      exemplaire: true,
      notionId: 'notion_pyth',
    },
    {
      id: 'ref_photo_1',
      contenu:
        "Fiche de référence (extraits) — La photosynthèse en 5e. Objectifs : identifier les paramètres, écrire l\'équation bilan. Prérequis : la cellule. Déroulement : 1) Rappel sur les besoins des végétaux, 2) Expérience de l\'algue Elodea, 3) Mise en évidence du rôle de la lumière, 4) Équation bilan, 5) Bilan écologique. Différenciation : fiche protocole guidée pour les fragiles, fiche à compléter pour les autres. Évaluation : schéma à légender + QCM. Prolongement : respiration cellulaire.",
      type: 'fiche_reference',
      niveau: '5e',
      chapitre: 'Le vivant',
      statut: 'validee',
      exemplaire: true,
      notionId: 'notion_photo',
    },
  ]
  for (const f of fichesRef) {
    await db.corpusVectoriel.create({
      data: { ...f, embedding: 'pending', metadata: JSON.stringify({ source: 'seed', auteur: 'équipe pédagogique' }) },
    })
  }

  console.log(`✅ ${notions.length} notions, ${prerequis.length} prérequis, ${progressions.length} progressions`)
  console.log(`✅ ${exemples.length} exemples pédagogiques, ${fichesRef.length} fiches de référence exemplaires`)
  console.log(`✅ ${regles.length} règles, template v1`)

  // =========================================================
  // Séquences — une par progression (statuts variés pour un dashboard vivant)
  // =========================================================
  const allProgs = await db.progression.findMany({ include: { notion: true } })
  const statusBySemaine = (s: number): 'validee' | 'en_cours' | 'planifiee' | 'en_attente' => {
    if (s <= 8) return 'en_cours' // P1-1 (Sprint 3): les séquences seed ne sont pas réellement validées
    if (s <= 12) return 'en_cours'
    if (s <= 16) return 'planifiee'
    return 'en_attente'
  }
  for (const p of allProgs) {
    const seq = await db.sequence.create({
      data: {
        titre: `${p.notion.nom} — ${p.niveau}`,
        notionIds: JSON.stringify([p.notionId]),
        niveau: p.niveau,
        chapitre: p.chapitre,
        semaine: p.semaine,
        statut: statusBySemaine(p.semaine),
        priorite: p.semaine <= 12 ? 5 : p.semaine <= 16 ? 3 : 1,
        contexteClasse: p.semaine <= 8 ? JSON.stringify({ effectif: 28, materiel: p.chapitre === 'Le vivant' ? ['microscope', 'lames', 'fiches'] : ['cahiers', 'calculatrices', 'fiches'], duree_min: p.dureeMin }) : null,
        templateVersion: 'v1',
        curriculumVersion: 'v1',
        progressionId: p.id,
      },
    })
    await db.sequenceNotion.create({ data: { sequenceId: seq.id, notionId: p.notionId } })
  }

  // P1-1 (Sprint 3): Les livrables seed sont des PLACEHOLDERS, pas des fiches validées.
  // Option B du prompt : placeholder=true (type='placeholder'), valide=false.
  // Aucune donnée fictive ne doit apparaître comme production.
  const seqsAvecPlaceholder = await db.sequence.findMany({ where: { statut: 'en_cours' }, include: { notions: { include: { notion: true } } }, take: 4 })
  for (const s of seqsAvecPlaceholder) {
    const notion = s.notions[0]?.notion
    const contenu = {
      markdown: `# PLACEHOLDER — ${s.titre}\n\n_Ce livrable est un placeholder de démonstration. Il ne contient pas de contenu pédagogique validé. Pour générer une vraie fiche, lancez le pipeline._`,
      sections: [
        { section_id: 'objectifs', label: 'Objectifs pédagogiques', contenu: '[Placeholder — à régénérer via le pipeline]', methode: null },
        { section_id: 'prerequis', label: 'Prérequis mobilisés', contenu: '[Placeholder — à régénérer via le pipeline]', methode: null },
        { section_id: 'deroulement', label: 'Déroulement', contenu: '[Placeholder — à régénérer via le pipeline]', methode: null },
        { section_id: 'activites', label: 'Activités', contenu: '[Placeholder — à régénérer via le pipeline]', methode: null },
        { section_id: 'differentiation', label: 'Différenciation', contenu: '[Placeholder — à régénérer via le pipeline]', methode: null },
        { section_id: 'evaluation', label: 'Évaluation', contenu: '[Placeholder — à régénérer via le pipeline]', methode: null },
        { section_id: 'prolongement', label: 'Prolongement', contenu: '[Placeholder — à régénérer via le pipeline]', methode: null },
      ],
      meta: { sequence_titre: s.titre, template_version: 'v1', curriculum_version: 'v1', notions_count: 1, exemples_count: 0, references_count: 0, placeholder: true },
    }
    const livrable = await db.livrable.create({
      data: {
        sequenceId: s.id,
        type: 'placeholder', // P1-1 (Sprint 3): explicit placeholder, pas 'fiche'
        contenuJson: JSON.stringify(contenu),
        format: 'markdown',
        valide: false, // P1-1 (Sprint 3): JAMAIS valide sans validation réelle
        skillVersion: 'v1',
      },
    })
    // Validation honnête : structurel FAIL (contenu placeholder trop court)
    await db.validationResult.create({
      data: {
        livrableId: livrable.id,
        structurelPass: false,
        structurelRaisons: JSON.stringify(['Livrable placeholder — contenu insuffisant', 'Toutes sections < seuil min mots']),
        pedagogiquePass: null, // pas évalué pédagogiquement
        pedagogiqueRaisons: null,
        coucheDeclenchee: 'structurel',
        skillVersion: 'v1',
      },
    })
    // agent_run de trace
    for (const agent of ['planificateur', 'knowledge_compiler', 'redacteur', 'critique', 'superviseur'] as const) {
      await db.agentRun.create({
        data: {
          sequenceId: s.id,
          batchId: 'batch-seed-initial',
          agent,
          skill: agent === 'redacteur' ? 'generate_section_pair_v1' : agent === 'critique' ? 'validate_pedagogique_v1' : `${agent}_v1`,
          input: JSON.stringify({ sequence_id: s.id }),
          output: JSON.stringify({ ok: true }),
          decision: 'continue',
          durationMs: 200 + Math.floor(Math.random() * 1800),
          statut: 'ok',
        },
      })
    }
  }

  console.log(`✅ ${allProgs.length} séquences (statuts variés), ${seqsAvecPlaceholder.length} livrables placeholder (valide=false) avec traces`)
  console.log('🎉 Seed terminé')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
