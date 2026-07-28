// Seed — Programmes nationaux RDC (récupérés du site edu-nc.gouv.cd)
// Mapping du système congolais vers nos branches
// Source : https://edu-nc.gouv.cd/programmes-nationaux
//
// Système congolais :
//   7ème Année = 1ère Secondaire
//   8ème Année = 2ème Secondaire
//   1ère Année Humanités Scientifiques = 3ème Sc
//   2ème Année Humanités Scientifiques = 4ème Sc
//   3ème Année Humanités Scientifiques = 5ème Sc
//   4ème Année Humanités Scientifiques = 6ème Sc
//
// Domaine d'Apprentissage des Sciences (DAS) regroupe :
//   - Mathématiques
//   - Sciences de la Vie et de la Terre (SVT)
//   - Sciences Physiques, Technologie et TIC (SPTTIC)
//
// Autres branches : Français, Histoire, Géographie

import { db } from '@/lib/db'

async function main() {
  console.log('🇨🇩 Seed programmes nationaux RDC (depuis edu-nc.gouv.cd)\n')

  // =========================================================
  // Branches (6) — avec mapping vers le système congolais
  // =========================================================
  const branches = [
    { id: 'branche_math', nom: 'Mathématiques', code: 'MATH', couleur: '#0F766E', description: 'Sous-domaine du DAS — Maths du 7e au 4e Humanités Scientifiques' },
    { id: 'branche_fr', nom: 'Français', code: 'FR', couleur: '#7C3AED', description: 'Lecture, écriture, communication, grammaire, conjugaison' },
    { id: 'branche_hist', nom: 'Histoire', code: 'HIST', couleur: '#DC2626', description: 'Histoire universelle et nationale, civilisations' },
    { id: 'branche_geo', nom: 'Géographie', code: 'GEO', couleur: '#0891B2', description: 'Géographie physique, humaine, économique' },
    { id: 'branche_phy', nom: 'Sciences Physiques', code: 'SPTTIC', couleur: '#EA580C', description: 'Sciences Physiques, Technologie et TIC (DAS)' },
    { id: 'branche_svt', nom: 'SVT', code: 'SVT', couleur: '#16A34A', description: 'Sciences de la Vie et de la Terre (DAS)' },
  ]

  for (const b of branches) {
    await db.branche.upsert({
      where: { code: b.code },
      create: b,
      update: { nom: b.nom, description: b.description, couleur: b.couleur },
    })
  }
  console.log(`✅ ${branches.length} branches`)

  // =========================================================
  // Programmes nationaux RDC — par niveau × branche
  // Niveaux congolais : 7e(1er sec), 8e(2e sec), 3eSc, 4eSc, 5eSc, 6eSc
  // =========================================================
  const programmes = [
    // === MATHÉMATIQUES (DAS) ===
    // 7e Année (1ère Secondaire)
    { pays: 'RDC', niveau: '7e', brancheCode: 'MATH', chapitre: 'Nombres et opérations', heuresAnnee: 40, description: 'Nombres entiers, décimaux, fractions. Opérations.' },
    { pays: 'RDC', niveau: '7e', brancheCode: 'MATH', chapitre: 'Géométrie plane', heuresAnnee: 30, description: 'Figures planes, angles, périmètres, aires.' },
    { pays: 'RDC', niveau: '7e', brancheCode: 'MATH', chapitre: 'Proportionnalité et statistiques', heuresAnnee: 20, description: 'Tableaux, pourcentages, graphiques.' },
    // 8e Année (2ème Secondaire)
    { pays: 'RDC', niveau: '8e', brancheCode: 'MATH', chapitre: 'Calcul littéral et équations', heuresAnnee: 35, description: 'Expressions algébriques, équations du 1er degré.' },
    { pays: 'RDC', niveau: '8e', brancheCode: 'MATH', chapitre: 'Géométrie et transformations', heuresAnnee: 30, description: 'Triangles, parallèles, Thalès, Pythagore.' },
    { pays: 'RDC', niveau: '8e', brancheCode: 'MATH', chapitre: 'Nombres rationnels et proportionnalité', heuresAnnee: 25, description: 'Fractions, rapports, échelles.' },
    // 3e Sc (1ère Humanités Scientifiques)
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'MATH', chapitre: 'Ensemble R des réels', heuresAnnee: 30, description: 'Définition, droite numérique, intervalles, rationnels/irrationnels.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'MATH', chapitre: 'Fonctions et équations', heuresAnnee: 35, description: 'Notion de fonction, image, antécédent, équations du 1er degré.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'MATH', chapitre: 'Trigonométrie', heuresAnnee: 25, description: 'Cosinus, sinus, tangente dans le triangle rectangle.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'MATH', chapitre: 'Géométrie analytique', heuresAnnee: 25, description: 'Repère, coordonnées, distance, milieu.' },
    // 4e Sc
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'MATH', chapitre: 'Polynômes et équations du 2nd degré', heuresAnnee: 35, description: 'Factorisation, équations produit, discriminant.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'MATH', chapitre: 'Systèmes d\'équations', heuresAnnee: 30, description: 'Méthodes de résolution : addition, substitution, Cramer.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'MATH', chapitre: 'Géométrie dans l\'espace', heuresAnnee: 25, description: 'Solides, volumes, sections planes.' },
    // 5e Sc
    { pays: 'RDC', niveau: '5eSc', brancheCode: 'MATH', chapitre: 'Étude de fonctions', heuresAnnee: 35, description: 'Variations, extremums, représentation graphique.' },
    { pays: 'RDC', niveau: '5eSc', brancheCode: 'MATH', chapitre: 'Suites numériques', heuresAnnee: 30, description: 'Suites arithmétiques et géométriques.' },
    { pays: 'RDC', niveau: '5eSc', brancheCode: 'MATH', chapitre: 'Probabilités et statistiques', heuresAnnee: 25, description: 'Dénombrement, probabilités, échantillonnage.' },
    // 6e Sc
    { pays: 'RDC', niveau: '6eSc', brancheCode: 'MATH', chapitre: 'Limites et continuité', heuresAnnee: 30, description: 'Limites de fonctions, continuité, asymptotes.' },
    { pays: 'RDC', niveau: '6eSc', brancheCode: 'MATH', chapitre: 'Dérivation', heuresAnnee: 35, description: 'Nombre dérivé, fonction dérivée, applications.' },
    { pays: 'RDC', niveau: '6eSc', brancheCode: 'MATH', chapitre: 'Calcul intégral', heuresAnnee: 30, description: 'Primitives, intégrales, calcul d\'aires.' },

    // === SVT (DAS) ===
    { pays: 'RDC', niveau: '7e', brancheCode: 'SVT', chapitre: 'Le vivant et sa diversité', heuresAnnee: 35, description: 'Classification du vivant, cellules, écosystèmes.' },
    { pays: 'RDC', niveau: '8e', brancheCode: 'SVT', chapitre: 'Le corps humain et la santé', heuresAnnee: 35, description: 'Nutrition, respiration, circulation, reproduction.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'SVT', chapitre: 'Génétique et hérédité', heuresAnnee: 30, description: 'ADN, gènes, transmission des caractères.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'SVT', chapitre: 'Évolution et biodiversité', heuresAnnee: 25, description: 'Théories de l\'évolution, classification phylogénétique.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'SVT', chapitre: 'Physiologie animale', heuresAnnee: 30, description: 'Systèmes nerveux, endocrinien, immunitaire.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'SVT', chapitre: 'Géologie et structure de la Terre', heuresAnnee: 25, description: 'Tectonique des plaques, séismes, volcans.' },
    { pays: 'RDC', niveau: '5eSc', brancheCode: 'SVT', chapitre: 'Microbiologie et immunologie', heuresAnnee: 30, description: 'Bactéries, virus, défenses immunitaires.' },
    { pays: 'RDC', niveau: '6eSc', brancheCode: 'SVT', chapitre: 'Biologie cellulaire avancée', heuresAnnee: 30, description: 'Métabolisme cellulaire, division, génie génétique.' },

    // === SCIENCES PHYSIQUES (SPTTIC) ===
    { pays: 'RDC', niveau: '7e', brancheCode: 'SPTTIC', chapitre: 'La matière et ses états', heuresAnnee: 30, description: 'États de la matière, mélanges, corps purs.' },
    { pays: 'RDC', niveau: '8e', brancheCode: 'SPTTIC', chapitre: 'Électricité et énergie', heuresAnnee: 30, description: 'Circuits électriques, tension, intensité.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'SPTTIC', chapitre: 'Mécanique et forces', heuresAnnee: 30, description: 'Forces, équilibre, mouvement, lois de Newton.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'SPTTIC', chapitre: 'Chimie : atomes et molécules', heuresAnnee: 25, description: 'Structure atomique, tableau périodique, liaisons.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'SPTTIC', chapitre: 'Électricité et magnétisme', heuresAnnee: 30, description: 'Champs électriques et magnétiques, induction.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'SPTTIC', chapitre: 'Réactions chimiques', heuresAnnee: 25, description: 'Équilibrage, oxydoréduction, acide-base.' },
    { pays: 'RDC', niveau: '5eSc', brancheCode: 'SPTTIC', chapitre: 'Optique et ondes', heuresAnnee: 30, description: 'Lumière, réfraction, lentilles, ondes sonores.' },
    { pays: 'RDC', niveau: '6eSc', brancheCode: 'SPTTIC', chapitre: 'Thermodynamique', heuresAnnee: 30, description: 'Chaleur, température, principes de la thermodynamique.' },

    // === FRANÇAIS ===
    { pays: 'RDC', niveau: '7e', brancheCode: 'FR', chapitre: 'Lecture et écriture', heuresAnnee: 40, description: 'Compréhension de texte, production écrite.' },
    { pays: 'RDC', niveau: '7e', brancheCode: 'FR', chapitre: 'Grammaire de base', heuresAnnee: 30, description: 'Classes de mots, phrase simple, accords.' },
    { pays: 'RDC', niveau: '8e', brancheCode: 'FR', chapitre: 'Conjugaison et temps verbaux', heuresAnnee: 35, description: 'Temps simples et composés, concordance des temps.' },
    { pays: 'RDC', niveau: '8e', brancheCode: 'FR', chapitre: 'Expression écrite et orale', heuresAnnee: 30, description: 'Récit, description, dialogue.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'FR', chapitre: 'Analyse textuelle et littéraire', heuresAnnee: 35, description: 'Étude de textes, figures de style, genres littéraires.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'FR', chapitre: 'Dissertation et argumentation', heuresAnnee: 30, description: 'Plan dialectique, thèse/antithèse/synthèse.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'FR', chapitre: 'Littérature africaine et congolaise', heuresAnnee: 30, description: 'Auteurs africains, thèmes postcoloniaux.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'FR', chapitre: 'Commentaire composé', heuresAnnee: 25, description: 'Méthodologie du commentaire littéraire.' },

    // === HISTOIRE ===
    { pays: 'RDC', niveau: '7e', brancheCode: 'HIST', chapitre: 'La préhistoire et premières civilisations', heuresAnnee: 30, description: 'Évolution humaine, Mésopotamie, Égypte.' },
    { pays: 'RDC', niveau: '8e', brancheCode: 'HIST', chapitre: 'Civilisations médiévales', heuresAnnee: 30, description: 'Moyen Âge, féodalité, Islam, royaumes africains.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'HIST', chapitre: 'Révolutions et temps modernes', heuresAnnee: 30, description: 'Renaissance, Réforme, Révolution française, industrielle.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'HIST', chapitre: 'Histoire du Congo — colonisation', heuresAnnee: 25, description: 'Exploration, État indépendant du Congo, colonisation belge.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'HIST', chapitre: 'Époques contemporaines', heuresAnnee: 30, description: 'Guerres mondiales, décolonisation, guerre froide.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'HIST', chapitre: 'Histoire du Congo — indépendance', heuresAnnee: 25, description: '1960, Lumumba, Mobutu, transition démocratique.' },

    // === GÉOGRAPHIE ===
    { pays: 'RDC', niveau: '7e', brancheCode: 'GEO', chapitre: 'La Terre et ses représentations', heuresAnnee: 30, description: 'Globe, cartes, repérage, coordonnées.' },
    { pays: 'RDC', niveau: '8e', brancheCode: 'GEO', chapitre: 'Climats et milieux naturels', heuresAnnee: 30, description: 'Zones climatiques, biomes, paysages.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'GEO', chapitre: 'Géographie de l\'Afrique', heuresAnnee: 30, description: 'Relief, climat, populations, économie africaine.' },
    { pays: 'RDC', niveau: '3eSc', brancheCode: 'GEO', chapitre: 'Géographie de la RDC', heuresAnnee: 25, description: 'Provinces, ressources, population, défis.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'GEO', chapitre: 'Mondialisation et développement', heuresAnnee: 30, description: 'Échanges mondiaux, FTN, inégalités, développement durable.' },
    { pays: 'RDC', niveau: '4eSc', brancheCode: 'GEO', chapitre: 'Géopolitique contemporaine', heuresAnnee: 25, description: 'Conflits, alliances, puissance, gouvernance mondiale.' },
  ]

  let progCount = 0
  for (const p of programmes) {
    const branche = await db.branche.findUnique({ where: { code: p.brancheCode } })
    if (!branche) continue
    await db.programmeNational.upsert({
      where: {
        pays_niveau_brancheId_chapitre: {
          pays: p.pays, niveau: p.niveau, brancheId: branche.id, chapitre: p.chapitre,
        },
      },
      create: {
        pays: p.pays, niveau: p.niveau, brancheId: branche.id,
        chapitre: p.chapitre, heuresAnnee: p.heuresAnnee, description: p.description,
      },
      update: { heuresAnnee: p.heuresAnnee, description: p.description },
    })
    progCount++
  }
  console.log(`✅ ${progCount} entrées programme national RDC`)

  // =========================================================
  // Notions clés (extraites des programmes)
  // =========================================================
  const notions = [
    // Math 3eSc
    { id: 'notion_reels_3eSc', nom: "L'Ensemble R des réels", description: "Définition de R, droite numérique, intervalles, rationnels/irrationnels.", niveau: '3eSc', chapitre: 'Ensemble R des réels', competences: ['Définir R', 'Représenter sur droite numérique', 'Distinguer rationnels et irrationnels'], objectifs: ['Définir R et ses sous-ensembles', 'Représenter les réels sur une droite graduée', 'Manipuler les intervalles de R'] },
    { id: 'notion_fonctions_3eSc', nom: 'Notions de fonction', description: 'Définition, notation, ensemble de définition, image et antécédent.', niveau: '3eSc', chapitre: 'Fonctions et équations', competences: ['Définir une fonction', 'Déterminer l\'ensemble de définition', 'Représenter graphiquement'], objectifs: ['Comprendre la notion de fonction', 'Calculer images et antécédents', 'Tracer une courbe représentative'] },
    { id: 'notion_trigo_3eSc', nom: 'Trigonométrie', description: 'Cosinus, sinus, tangente d\'un angle aigu.', niveau: '3eSc', chapitre: 'Trigonométrie', competences: ['Utiliser les rapports trigonométriques', 'Calculer longueurs et angles'], objectifs: ['Définir cos, sin, tan', 'Résoudre des problèmes de triangulation'] },
    // Math 4eSc
    { id: 'notion_systemes_4eSc', nom: 'Systèmes d\'équations', description: 'Méthodes : addition, substitution, Cramer.', niveau: '4eSc', chapitre: 'Systèmes d\'équations', competences: ['Résoudre un système', 'Appliquer la méthode de Cramer'], objectifs: ['Maîtriser les 3 méthodes', 'Modéliser un problème'] },
    // SVT 3eSc
    { id: 'notion_genetique_3eSc', nom: 'Génétique et hérédité', description: 'ADN, gènes, transmission des caractères.', niveau: '3eSc', chapitre: 'Génétique et hérédité', competences: ['Comprendre la transmission des caractères'], objectifs: ['Définir ADN, gène, chromosome', 'Analyser un arbre généalogique'] },
    // Physique 3eSc
    { id: 'notion_mecanique_3eSc', nom: 'Mécanique et forces', description: 'Forces, équilibre, mouvement, lois de Newton.', niveau: '3eSc', chapitre: 'Mécanique et forces', competences: ['Identifier les forces', 'Appliquer les lois de Newton'], objectifs: ['Définir une force', 'Résoudre des problèmes d\'équilibre'] },
    // Français 3eSc
    { id: 'notion_dissertation_3eSc', nom: 'La dissertation', description: 'Plan dialectique, thèse/antithèse/synthèse.', niveau: '3eSc', chapitre: 'Dissertation et argumentation', competences: ['Structurer une dissertation', 'Argumenter'], objectifs: ['Maîtriser le plan dialectique', 'Rédiger introduction et conclusion'] },
    // Histoire 3eSc
    { id: 'notion_revolution_3eSc', nom: 'La Révolution française', description: '1789, abolition des privilèges, Déclaration des droits.', niveau: '3eSc', chapitre: 'Révolutions et temps modernes', competences: ['Comprendre un changement politique'], objectifs: ['Connaître les dates clés', 'Expliquer l\'abolition des privilèges'] },
    // Géographie 3eSc
    { id: 'notion_geo_rdc_3eSc', nom: 'Géographie de la RDC', description: 'Provinces, ressources, population, défis.', niveau: '3eSc', chapitre: 'Géographie de la RDC', competences: ['Localiser les provinces', 'Analyser les ressources'], objectifs: ['Cartographier la RDC', 'Identifier les enjeux'] },
  ]

  for (const n of notions) {
    await db.notion.upsert({
      where: { id: n.id },
      create: {
        id: n.id, nom: n.nom, description: n.description,
        niveau: n.niveau, chapitre: n.chapitre,
        competences: JSON.stringify(n.competences),
        objectifs: JSON.stringify(n.objectifs),
      },
      update: {},
    })
  }
  console.log(`✅ ${notions.length} notions clés du programme RDC`)

  // =========================================================
  // Progressions (prévision annuelle par branche/niveau)
  // =========================================================
  const progressions = [
    // Math 3eSc
    { niveau: '3eSc', chapitre: 'Ensemble R des réels', notionId: 'notion_reels_3eSc', semaine: 2, dureeMin: 50 },
    { niveau: '3eSc', chapitre: 'Fonctions et équations', notionId: 'notion_fonctions_3eSc', semaine: 6, dureeMin: 50 },
    { niveau: '3eSc', chapitre: 'Trigonométrie', notionId: 'notion_trigo_3eSc', semaine: 12, dureeMin: 55 },
    // Math 4eSc
    { niveau: '4eSc', chapitre: 'Systèmes d\'équations', notionId: 'notion_systemes_4eSc', semaine: 8, dureeMin: 55 },
    // SVT 3eSc
    { niveau: '3eSc', chapitre: 'Génétique et hérédité', notionId: 'notion_genetique_3eSc', semaine: 4, dureeMin: 50 },
    // Physique 3eSc
    { niveau: '3eSc', chapitre: 'Mécanique et forces', notionId: 'notion_mecanique_3eSc', semaine: 8, dureeMin: 55 },
    // Français 3eSc
    { niveau: '3eSc', chapitre: 'Dissertation et argumentation', notionId: 'notion_dissertation_3eSc', semaine: 14, dureeMin: 60 },
    // Histoire 3eSc
    { niveau: '3eSc', chapitre: 'Révolutions et temps modernes', notionId: 'notion_revolution_3eSc', semaine: 10, dureeMin: 50 },
    // Géographie 3eSc
    { niveau: '3eSc', chapitre: 'Géographie de la RDC', notionId: 'notion_geo_rdc_3eSc', semaine: 16, dureeMin: 50 },
  ]

  let progCount2 = 0
  for (const p of progressions) {
    const existing = await db.progression.findFirst({ where: { niveau: p.niveau, chapitre: p.chapitre, notionId: p.notionId } })
    if (!existing) {
      const branche = await db.branche.findFirst({
        where: {
          programmes: {
            some: { niveau: p.niveau, chapitre: p.chapitre }
          }
        }
      })
      await db.progression.create({
        data: { ...p, brancheId: branche?.id || null },
      })
      progCount2++
    }
  }
  console.log(`✅ ${progCount2} progressions (prévision annuelle)`)

  // =========================================================
  // Séquences pour les notions RDC
  // =========================================================
  let seqCount = 0
  for (const p of progressions) {
    const notion = await db.notion.findUnique({ where: { id: p.notionId } })
    if (!notion) continue
    const seqTitre = `${notion.nom} — ${p.niveau}`
    const existingSeq = await db.sequence.findFirst({ where: { titre: seqTitre } })
    if (!existingSeq) {
      const seq = await db.sequence.create({
        data: {
          titre: seqTitre,
          notionIds: JSON.stringify([p.notionId]),
          niveau: p.niveau, chapitre: p.chapitre, semaine: p.semaine,
          statut: p.semaine <= 6 ? 'en_cours' : 'en_attente',
          priorite: p.semaine <= 12 ? 5 : 3,
          templateVersion: 'v1', curriculumVersion: 'v1',
        },
      })
      await db.sequenceNotion.create({ data: { sequenceId: seq.id, notionId: p.notionId } })
      seqCount++
    }
  }
  console.log(`✅ ${seqCount} séquences créées`)

  // =========================================================
  // RÈGLES par niveau congolais
  // =========================================================
  const regles = [
    { niveau: '7e', cle: 'style_ton', valeur: JSON.stringify('très accessible, exemples concrets') },
    { niveau: '7e', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 40, max_mots: 200 }) },
    { niveau: '8e', cle: 'style_ton', valeur: JSON.stringify('accessible, structuré') },
    { niveau: '8e', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 50, max_mots: 250 }) },
    { niveau: '3eSc', cle: 'style_ton', valeur: JSON.stringify('rigoureux, formalisation progressive, vocabulaire scientifique') },
    { niveau: '3eSc', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 60, max_mots: 350 }) },
    { niveau: '4eSc', cle: 'style_ton', valeur: JSON.stringify('scientifique, démonstratif') },
    { niveau: '4eSc', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 70, max_mots: 400 }) },
    { niveau: '5eSc', cle: 'style_ton', valeur: JSON.stringify('avancé, abstrait, rigoureux') },
    { niveau: '5eSc', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 80, max_mots: 450 }) },
    { niveau: '6eSc', cle: 'style_ton', valeur: JSON.stringify('universitaire, démonstrations formelles') },
    { niveau: '6eSc', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 90, max_mots: 500 }) },
  ]
  let regleCount = 0
  for (const r of regles) {
    const existing = await db.regle.findFirst({ where: { niveau: r.niveau, cle: r.cle } })
    if (!existing) {
      await db.regle.create({ data: r })
      regleCount++
    }
  }
  console.log(`✅ ${regleCount} règles pédagogiques par niveau`)

  // =========================================================
  // RÉCAPITULATIF
  // =========================================================
  const allBranches = await db.branche.findMany()
  const allProgs = await db.programmeNational.findMany({ include: { branche: true } })
  const allNotions = await db.notion.findMany()
  const allSeqs = await db.sequence.findMany()
  const niveaux = [...new Set(allProgs.map((p) => p.niveau))].sort()

  console.log('\n📊 RÉCAPITULATIF :')
  console.log(`  Branches : ${allBranches.length}`)
  console.log(`  Programme national RDC : ${allProgs.length} entrées`)
  console.log(`  Niveaux : ${niveaux.join(', ')}`)
  console.log(`  Notions : ${allNotions.length}`)
  console.log(`  Séquences : ${allSeqs.length}`)

  // Détail par branche
  console.log('\n  Par branche :')
  for (const b of allBranches) {
    const progsB = allProgs.filter((p) => p.brancheId === b.id)
    const niveauxB = [...new Set(progsB.map((p) => p.niveau))].sort()
    console.log(`    ${b.code} (${b.nom}) : ${progsB.length} programmes, niveaux: ${niveauxB.join(', ')}`)
  }

  console.log('\n🎉 Programmes nationaux RDC seedés')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await db.$disconnect() })
