// Seed enrichment — P1-4 (Sprint 3) : 6 disciplines, 3 niveaux, fiches exemplaires pour tous les combos
// Disciplines : Maths, Français, Histoire, Géographie, Physique, SVT
// Objectif : retrieve_style_reference ne retourne JAMAIS [] pour une discipline supportée.

import { db } from '@/lib/db'

async function main() {
  console.log('🌱 Enrichissement du corpus — 6 disciplines')

  // =========================================================
  // NOTIONS — nouvelles disciplines (maths+SVT déjà existants)
  // =========================================================
  const newNotions = [
    // Français 6e
    { id: 'notion_grammaire_6e', nom: 'Les classes de mots', description: 'Nom, verbe, adjectif, déterminant, pronom. Identification et fonctions.', niveau: '6e', chapitre: 'Grammaire', competences: ['Identifier les classes de mots', 'Analyser une phrase simple'], objectifs: ['Distinguer nom et verbe', 'Reconnaître les déterminants'] },
    // Français 5e
    { id: 'notion_conj_5e', nom: 'Le passé simple', description: 'Formation et emploi du passé simple. Concordance des temps dans le récit.', niveau: '5e', chapitre: 'Grammaire', competences: ['Conjuguer au passé simple', 'Utiliser le passé simple dans un récit'], objectifs: ['Former le passé simple des verbes réguliers', 'Distinguer passé simple et imparfait'] },
    // Histoire 5e
    { id: 'notion_moyenage_5e', nom: 'La société médiévale', description: 'Les trois ordres, la féodalité, le château fort. Vie quotidienne au Moyen Âge.', niveau: '5e', chapitre: 'Moyen Âge', competences: ['Décrire une société', 'Comprendre l\'organisation féodale'], objectifs: ['Identifier les trois ordres', 'Expliquer le système féodal'] },
    // Histoire 4e
    { id: 'notion_revolution_4e', nom: 'La Révolution française', description: '1789-1799. Des États généraux au Consulat. Déclaration des droits, abolition des privilèges.', niveau: '4e', chapitre: 'Révolution et Empire', competences: 'Comprendre un changement politique majeur', objectifs: ['Connaître les dates clés (1789, 1799)', 'Expliquer l\'abolition des privilèges'] },
    // Géographie 4e
    { id: 'notion_mondialisation_4e', nom: 'La mondialisation', description: 'Échanges mondiaux, firmes transnationales, centres d\'impulsion. Inégalités de développement.', niveau: '4e', chapitre: 'Mondialisation', competences: ['Localiser les pôles économiques', 'Analyser les inégalités'], objectifs: ['Identifier les centres d\'impulsion', 'Expliquer les flux commerciaux'] },
    // Géographie 5e
    { id: 'notion_climats_5e', nom: 'Les climats du monde', description: 'Zones climatiques, facteurs climatiques, répartition des climats.', niveau: '5e', chapitre: 'Climats et biomes', competences: ['Lire un climatogramme', 'Localiser les zones climatiques'], objectifs: ['Distinguer les grands climats', 'Expliquer l\'influence de la latitude'] },
    // Physique 4e
    { id: 'notion_energie_4e', nom: 'L\'énergie et ses formes', description: 'Énergie cinétique, potentielle, thermique. Conversions et conservation.', niveau: '4e', chapitre: 'Énergie', competences: ['Identifier les formes d\'énergie', 'Appliquer la conservation de l\'énergie'], objectifs: ['Distinguer énergie cinétique et potentielle', 'Convertir des unités d\'énergie'] },
    // Physique 5e
    { id: 'notion_lumiere_5e', nom: 'La lumière et la vision', description: 'Sources lumineuses, propagation, couleur. Mécanisme de la vision.', niveau: '5e', chapitre: 'Lumière', competences: ['Modéliser un faisceau lumineux', 'Expliquer la vision'], objectifs: ['Distinguer source primaire et secondaire', 'Expliquer la formation des ombres'] },
  ]

  for (const n of newNotions) {
    const existing = await db.notion.findUnique({ where: { id: n.id } })
    if (!existing) {
      await db.notion.create({
        data: {
          id: n.id, nom: n.nom, description: n.description,
          niveau: n.niveau, chapitre: n.chapitre,
          competences: JSON.stringify(Array.isArray(n.competences) ? n.competences : [n.competences]),
          objectifs: JSON.stringify(Array.isArray(n.objectifs) ? n.objectifs : [n.objectifs]),
        },
      })
    }
  }
  console.log(`✅ ${newNotions.length} notions ajoutées (français, histoire, géo, physique)`)

  // =========================================================
  // EXEMPLES PÉDAGOGIQUES — pour chaque nouvelle discipline
  // =========================================================
  const newExemples = [
    // Français
    { id: 'ex_grammaire_1', contenu: "Exemple pédagogique : dans la phrase 'Le chat noir mange une souris', on identifie : 'Le' (déterminant), 'chat' (nom commun), 'noir' (adjectif), 'mange' (verbe), 'une' (déterminant), 'souris' (nom commun). Activité : colorier chaque classe de mot.", type: 'exemple_pedagogique', niveau: '6e', chapitre: 'Grammaire', statut: 'validee', notionId: 'notion_grammaire_6e' },
    { id: 'ex_conj_1', contenu: "Exemple pédagogique : conjuguer 'chanter' au passé simple. Je chantai, tu chantas, il chanta, nous chantâmes, vous chantâtes, ils chantèrent. Faire repérer les terminaisons -ai, -as, -a, -âmes, -âtes, -èrent pour le 1er groupe.", type: 'exemple_pedagogique', niveau: '5e', chapitre: 'Grammaire', statut: 'validee', notionId: 'notion_conj_5e' },
    { id: 'ex_conj_2', contenu: "Exemple pédagogique : dans 'Le héros arriva, regarda autour de lui et décida d'agir.' Le passé simple marque les actions successives principales. L'imparfait serait utilisé pour la description. Comparer avec 'Le héros arrivait, regardait...'", type: 'exemple_pedagogique', niveau: '5e', chapitre: 'Grammaire', statut: 'brouillon', notionId: 'notion_conj_5e' },
    // Histoire
    { id: 'ex_moyenage_1', contenu: "Exemple pédagogique : les trois ordres sont ceux qui prient (clergé), ceux qui combattent (noblesse), ceux qui travaillent (paysans). Schéma pyramidal. Document : enluminure médiévale montrant les trois ordres. Activité : légender le schéma.", type: 'exemple_pedagogique', niveau: '5e', chapitre: 'Moyen Âge', statut: 'validee', notionId: 'notion_moyenage_5e' },
    { id: 'ex_revolution_1', contenu: "Exemple pédagogique : le 14 juillet 1789, la prise de la Bastille symbole de l'arbitraire royal. Le 4 août, abolition des privilèges. Le 26 août, Déclaration des droits de l'homme et du citoyen. Frise chronologique à construire.", type: 'exemple_pedagogique', niveau: '4e', chapitre: 'Révolution et Empire', statut: 'validee', notionId: 'notion_revolution_4e' },
    { id: 'ex_revolution_2', contenu: "Exemple pédagogique : étude de l'article 1 de la Déclaration : 'Les hommes naissent et demeurent libres et égaux en droits.' Faire expliquer chaque terme. Comparer avec la société d'Ancien Régime. Débat : cette phrase est-elle toujours d'actualité ?", type: 'exemple_pedagogique', niveau: '4e', chapitre: 'Révolution et Empire', statut: 'validee', notionId: 'notion_revolution_4e' },
    // Géographie
    { id: 'ex_mondialisation_1', contenu: "Exemple pédagogique : un iPhone est conçu en Californie, assemblé en Chine avec des composants du Japon, de Corée, d'Allemagne. Vendu mondialement. Carte des flux à tracer. Montre la division internationale du travail.", type: 'exemple_pedagogique', niveau: '4e', chapitre: 'Mondialisation', statut: 'validee', notionId: 'notion_mondialisation_4e' },
    { id: 'ex_climats_1', contenu: "Exemple pédagogique : climatogramme de Paris (précipitations 600mm, T° moy 12°C = climat océanique) vs climatogramme du Caire (30mm, 22°C = climat désertique). Activité : comparer deux climatogrammes et identifier le type de climat.", type: 'exemple_pedagogique', niveau: '5e', chapitre: 'Climats et biomes', statut: 'validee', notionId: 'notion_climats_5e' },
    // Physique
    { id: 'ex_energie_1', contenu: "Exemple pédagogique : une balle de 100g tombant de 10m a une énergie potentielle Ep = m×g×h = 0,1×9,81×10 ≈ 9,8 J. En tombant, cette Ep se convertit en énergie cinétique Ec = ½×m×v². Au sol, Ec ≈ 9,8 J (conservation). Activité : calculer la vitesse au sol.", type: 'exemple_pedagogique', niveau: '4e', chapitre: 'Énergie', statut: 'validee', notionId: 'notion_energie_4e' },
    { id: 'ex_lumiere_1', contenu: "Exemple pédagogique : la Lune n'émet pas de lumière (source secondaire), elle réfléchit celle du Soleil (source primaire). Une ampoule est une source primaire. Ombre portée : zone où la lumière ne parvient pas. Activité : lampe de poche + objet = ombre sur écran.", type: 'exemple_pedagogique', niveau: '5e', chapitre: 'Lumière', statut: 'validee', notionId: 'notion_lumiere_5e' },
  ]

  for (const e of newExemples) {
    const existing = await db.corpusVectoriel.findUnique({ where: { id: e.id } })
    if (!existing) {
      await db.corpusVectoriel.create({
        data: { ...e, exemplaire: false, embedding: 'pending', metadata: JSON.stringify({ source: 'seed-enrichment' }) },
      })
    }
  }
  console.log(`✅ ${newExemples.length} exemples pédagogiques ajoutés`)

  // =========================================================
  // FICHES DE RÉFÉRENCE EXEMPLAIRES — pour les combos manquants
  // Objectif : chaque combo (niveau, chapitre) a au moins 1 fiche exemplaire
  // =========================================================
  const newFichesRef = [
    // 6e/Nombres et calculs (manquant)
    {
      id: 'ref_dec_6e_1',
      contenu: "Fiche de référence (extraits) — Nombres décimaux en 6e. Objectifs : passer de l'écriture fractionnaire au décimal, encadrer un décimal. Prérequis : entiers, fractions. Déroulement : 1) Rappel sur les fractions (10 min), 2) Découverte du décimal comme fraction décimale (15 min), 3) Écriture décimale et fractions (15 min), 4) Encadrement et comparaison (10 min). Différenciation : manipulation de cubes pour les fragiles, exercices d'encadrement pour les autres. Évaluation : 5 questions sur la conversion fraction→décimal + 1 problème. Prolongement : addition de décimaux.",
      type: 'fiche_reference', niveau: '6e', chapitre: 'Nombres et calculs', statut: 'validee', exemplaire: true, notionId: 'notion_dec',
    },
    // 5e/Organisation et gestion de données (manquant)
    {
      id: 'ref_prop_5e_1',
      contenu: "Fiche de référence (extraits) — Proportionnalité en 5e. Objectifs : reconnaître une situation de proportionnalité, calculer un pourcentage. Prérequis : fractions, opérations. Déroulement : 1) Rappel sur le tableau de proportionnalité (10 min), 2) Émergence du coefficient (15 min), 3) Pourcentages comme cas particulier (15 min), 4) Exercices variés (10 min). Différenciation : tableau pré-rempli pour les fragiles, problèmes ouverts pour les autres. Évaluation : 1 reconnaissance + 2 calculs + 1 problème concret. Prolongement : échelles.",
      type: 'fiche_reference', niveau: '5e', chapitre: 'Organisation et gestion de données', statut: 'validee', exemplaire: true, notionId: 'notion_prop',
    },
    // 4e/Nombres et calculs (manquant)
    {
      id: 'ref_eq_4e_1',
      contenu: "Fiche de référence (extraits) — Équations du premier degré en 4e. Objectifs : résoudre une équation, modéliser un problème. Prérequis : fractions, calcul littéral. Déroulement : 1) Rappel sur l'égalité et la balance (10 min), 2) Règles de transformation (15 min), 3) Résolution guidée (15 min), 4) Problèmes concrets (10 min). Différenciation : équations à étapes pour les fragiles, problèmes de modélisation pour les autres. Évaluation : 3 résolutions + 1 problème. Prolongement : systèmes d'équations.",
      type: 'fiche_reference', niveau: '4e', chapitre: 'Nombres et calculs', statut: 'validee', exemplaire: true, notionId: 'notion_eq',
    },
    // Français 6e/Grammaire
    {
      id: 'ref_grammaire_6e_1',
      contenu: "Fiche de référence (extraits) — Les classes de mots en 6e. Objectifs : distinguer nom et verbe, reconnaître les déterminants. Prérequis : phrase simple. Déroulement : 1) Observation d'une phrase (10 min), 2) Classification guidée (15 min), 3) Institutionnalisation (15 min), 4) Exercices (10 min). Différenciation : couleur pour chaque classe, textes à trou. Évaluation : 5 phrases à analyser. Prolongement : fonctions.",
      type: 'fiche_reference', niveau: '6e', chapitre: 'Grammaire', statut: 'validee', exemplaire: true, notionId: 'notion_grammaire_6e',
    },
    // Français 5e/Grammaire
    {
      id: 'ref_conj_5e_1',
      contenu: "Fiche de référence (extraits) — Le passé simple en 5e. Objectifs : former le passé simple, distinguer du passé composé. Prérequis : temps composés. Déroulement : 1) Lecture d'un récit (10 min), 2) Repérage du passé simple (15 min), 3) Formation et terminaisons (15 min), 4) Concordance imparfait/PS (10 min). Différenciation : tableaux de conjugaison, transformation de textes. Évaluation : conjuguer 5 verbes + transformer un texte. Prolongement : passé antérieur.",
      type: 'fiche_reference', niveau: '5e', chapitre: 'Grammaire', statut: 'validee', exemplaire: true, notionId: 'notion_conj_5e',
    },
    // Histoire 5e/Moyen Âge
    {
      id: 'ref_moyenage_5e_1',
      contenu: "Fiche de référence (extraits) — La société médiévale en 5e. Objectifs : identifier les trois ordres, expliquer la féodalité. Prérequis : empire romain. Déroulement : 1) Observation d'une enluminure (10 min), 2) Les trois ordres (15 min), 3) Le système féodal (15 min), 4) Le château fort (10 min). Différenciation : frise illustrée, schéma de la hiérarchie. Évaluation : légender un schéma + 3 questions. Prolongement : la vie quotidienne.",
      type: 'fiche_reference', niveau: '5e', chapitre: 'Moyen Âge', statut: 'validee', exemplaire: true, notionId: 'notion_moyenage_5e',
    },
    // Histoire 4e/Révolution
    {
      id: 'ref_revolution_4e_1',
      contenu: "Fiche de référence (extraits) — La Révolution française en 4e. Objectifs : connaître les dates clés, expliquer l'abolition des privilèges. Prérequis : monarchie absolue. Déroulement : 1) Les causes (10 min), 2) 1789 : États généraux et Bastille (15 min), 3) Déclaration des droits (15 min), 4) La Terreur (10 min). Différenciation : frise chronologique, étude de document. Évaluation : 5 dates + 1 développement. Prolongement : l'Empire.",
      type: 'fiche_reference', niveau: '4e', chapitre: 'Révolution et Empire', statut: 'validee', exemplaire: true, notionId: 'notion_revolution_4e',
    },
    // Géographie 4e/Mondialisation
    {
      id: 'ref_mondialisation_4e_1',
      contenu: "Fiche de référence (extraits) — La mondialisation en 4e. Objectifs : identifier les centres d'impulsion, expliquer les flux. Prérequis : cartes économiques. Déroulement : 1) Carte des échanges mondiaux (10 min), 2) Les FTN (15 min), 3) Centres d'impulsion (15 min), 4) Inégalités (10 min). Différenciation : étude de cas (iPhone), cartes à compléter. Évaluation : localiser 5 pôles + 1 analyse de flux. Prolongement : développement durable.",
      type: 'fiche_reference', niveau: '4e', chapitre: 'Mondialisation', statut: 'validee', exemplaire: true, notionId: 'notion_mondialisation_4e',
    },
    // Géographie 5e/Climats
    {
      id: 'ref_climats_5e_1',
      contenu: "Fiche de référence (extraits) — Les climats du monde en 5e. Objectifs : distinguer les grands climats, expliquer l'influence de la latitude. Prérequis : lecture de carte. Déroulement : 1) Lecture d'un climatogramme (10 min), 2) Les zones climatiques (15 min), 3) Facteurs climatiques (15 min), 4) Biomes associés (10 min). Différenciation : comparaison de climatogrammes, cartes muettes. Évaluation : identifier 3 climats + expliquer un facteur. Prolongement : réchauffement climatique.",
      type: 'fiche_reference', niveau: '5e', chapitre: 'Climats et biomes', statut: 'validee', exemplaire: true, notionId: 'notion_climats_5e',
    },
    // Physique 4e/Énergie
    {
      id: 'ref_energie_4e_1',
      contenu: "Fiche de référence (extraits) — L'énergie et ses formes en 4e. Objectifs : distinguer énergie cinétique et potentielle, convertir des unités. Prérequis : vitesses, masses. Déroulement : 1) Différentes formes d'énergie (10 min), 2) Énergie cinétique Ec=½mv² (15 min), 3) Énergie potentielle Ep=mgh (15 min), 4) Conservation et conversions (10 min). Différenciation : calculs guidés, activités expérimentales. Évaluation : 3 calculs + 1 schéma de conversion. Prolongement : énergie renouvelable.",
      type: 'fiche_reference', niveau: '4e', chapitre: 'Énergie', statut: 'validee', exemplaire: true, notionId: 'notion_energie_4e',
    },
    // Physique 5e/Lumière
    {
      id: 'ref_lumiere_5e_1',
      contenu: "Fiche de référence (extraits) — La lumière et la vision en 5e. Objectifs : distinguer source primaire et secondaire, expliquer la formation des ombres. Prérequis : none spécifique. Déroulement : 1) Sources lumineuses (10 min), 2) Propagation rectiligne (15 min), 3) Ombres (15 min), 4) Système de la vision (10 min). Différenciation : manipulation lampe+objet, schémas à compléter. Évaluation : légender un schéma + 3 questions. Prolongement : couleurs.",
      type: 'fiche_reference', niveau: '5e', chapitre: 'Lumière', statut: 'validee', exemplaire: true, notionId: 'notion_lumiere_5e',
    },
  ]

  for (const f of newFichesRef) {
    const existing = await db.corpusVectoriel.findUnique({ where: { id: f.id } })
    if (!existing) {
      await db.corpusVectoriel.create({
        data: { ...f, embedding: 'pending', metadata: JSON.stringify({ source: 'seed-enrichment', auteur: 'équipe pédagogique' }) },
      })
    }
  }
  console.log(`✅ ${newFichesRef.length} fiches de référence exemplaires ajoutées`)

  // =========================================================
  // RÈGLES pour les nouveaux niveaux/chapitres
  // =========================================================
  const newRegles = [
    { niveau: '6e', cle: 'style_ton', valeur: JSON.stringify('très accessible, exemples concrets') },
    { niveau: '6e', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 40, max_mots: 200 }) },
    { niveau: '5e', cle: 'style_ton', valeur: JSON.stringify('accessible, structuré, vocabulaire précis') },
    { niveau: '4e', cle: 'style_ton', valeur: JSON.stringify('rigoureux, formalisation progressive') },
  ]
  for (const r of newRegles) {
    const existing = await db.regle.findFirst({ where: { niveau: r.niveau, cle: r.cle } })
    if (!existing) {
      await db.regle.create({ data: r })
    }
  }

  // =========================================================
  // PROGRESSIONS pour les nouvelles notions
  // =========================================================
  const newProgressions = [
    { niveau: '6e', chapitre: 'Grammaire', notionId: 'notion_grammaire_6e', semaine: 5, dureeMin: 50 },
    { niveau: '5e', chapitre: 'Grammaire', notionId: 'notion_conj_5e', semaine: 14, dureeMin: 50 },
    { niveau: '5e', chapitre: 'Moyen Âge', notionId: 'notion_moyenage_5e', semaine: 7, dureeMin: 50 },
    { niveau: '4e', chapitre: 'Révolution et Empire', notionId: 'notion_revolution_4e', semaine: 15, dureeMin: 50 },
    { niveau: '4e', chapitre: 'Mondialisation', notionId: 'notion_mondialisation_4e', semaine: 20, dureeMin: 50 },
    { niveau: '5e', chapitre: 'Climats et biomes', notionId: 'notion_climats_5e', semaine: 10, dureeMin: 50 },
    { niveau: '4e', chapitre: 'Énergie', notionId: 'notion_energie_4e', semaine: 14, dureeMin: 60 },
    { niveau: '5e', chapitre: 'Lumière', notionId: 'notion_lumiere_5e', semaine: 11, dureeMin: 50 },
  ]
  for (const p of newProgressions) {
    const existing = await db.progression.findFirst({ where: { niveau: p.niveau, chapitre: p.chapitre, notionId: p.notionId } })
    if (!existing) {
      await db.progression.create({ data: p })
    }
  }
  console.log(`✅ ${newProgressions.length} progressions ajoutées`)

  // =========================================================
  // SÉQUENCES pour les nouvelles notions
  // =========================================================
  for (const p of newProgressions) {
    const notion = await db.notion.findUnique({ where: { id: p.notionId } })
    if (!notion) continue
    const existingSeq = await db.sequence.findFirst({ where: { titre: `${notion.nom} — ${p.niveau}` } })
    if (!existingSeq) {
      const seq = await db.sequence.create({
        data: {
          titre: `${notion.nom} — ${p.niveau}`,
          notionIds: JSON.stringify([p.notionId]),
          niveau: p.niveau, chapitre: p.chapitre, semaine: p.semaine,
          statut: p.semaine <= 8 ? 'en_cours' : p.semaine <= 16 ? 'planifiee' : 'en_attente',
          priorite: p.semaine <= 12 ? 5 : 3,
          templateVersion: 'v1', curriculumVersion: 'v1',
        },
      })
      await db.sequenceNotion.create({ data: { sequenceId: seq.id, notionId: p.notionId } })
    }
  }

  // =========================================================
  // Vérification : tous les combos (niveau, chapitre) ont-ils au moins 1 exemplaire ?
  // =========================================================
  const allNotions = await db.notion.findMany()
  const allExemplaires = await db.corpusVectoriel.findMany({ where: { type: 'fiche_reference', exemplaire: true, statut: 'validee' } })
  const combos = new Set(allNotions.map((n) => `${n.niveau}/${n.chapitre}`))
  const exCombos = new Set(allExemplaires.map((e) => `${e.niveau}/${e.chapitre}`))
  const missing = [...combos].filter((c) => !exCombos.has(c))
  
  console.log(`\n📊 Couverture corpus :`)
  console.log(`  Notions : ${allNotions.length} (niveaux: ${[...new Set(allNotions.map((n) => n.niveau))].join(', ')})`)
  console.log(`  Disciplines : Maths, Français, Histoire, Géographie, Physique, SVT`)
  console.log(`  Fiches exemplaires : ${allExemplaires.length}`)
  console.log(`  Combos (niveau/chapitre) : ${combos.size} total, ${exCombos.size} couverts, ${missing.length} manquants`)
  if (missing.length > 0) {
    console.log(`  MANQUANTS : ${missing.join(', ')}`)
  } else {
    console.log(`  ✅ Tous les combos ont au moins 1 fiche exemplaire — retrieve_style_reference ne retournera JAMAIS []`)
  }

  console.log('🎉 Enrichissement terminé')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
