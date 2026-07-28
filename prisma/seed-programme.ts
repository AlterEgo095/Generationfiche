// Seed — Programme national (6 branches × 3 niveaux) + notion R des réels (3e)
// Sprint 5 : prévision des matières par branche + niveau 3e ajouté

import { db } from '@/lib/db'

async function main() {
  console.log('📚 Seed programme national + branches + 3e secondaire\n')

  // =========================================================
  // 1. BRANCHES (6 disciplines)
  // =========================================================
  const branches = [
    { id: 'branche_math', nom: 'Mathématiques', code: 'MATH', couleur: '#0F766E', description: 'Nombres, calculs, géométrie, algèbre, analyse' },
    { id: 'branche_fr', nom: 'Français', code: 'FR', couleur: '#7C3AED', description: 'Grammaire, conjugaison, expression écrite et orale, littérature' },
    { id: 'branche_hist', nom: 'Histoire', code: 'HIST', couleur: '#DC2626', description: 'Histoire universelle et nationale, civilisations' },
    { id: 'branche_geo', nom: 'Géographie', code: 'GEO', couleur: '#0891B2', description: 'Géographie physique, humaine, économique' },
    { id: 'branche_phy', nom: 'Physique', code: 'PHY', couleur: '#EA580C', description: 'Mécanique, électricité, énergie, optique' },
    { id: 'branche_svt', nom: 'SVT', code: 'SVT', couleur: '#16A34A', description: 'Sciences de la vie et de la Terre' },
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
  // 2. PROGRAMME NATIONAL — par niveau × branche × chapitre
  // =========================================================
  const programmes = [
    // 6e
    { pays: 'RDC', niveau: '6e', brancheCode: 'MATH', chapitre: 'Nombres et calculs', heuresAnnee: 40 },
    { pays: 'RDC', niveau: '6e', brancheCode: 'MATH', chapitre: 'Géométrie', heuresAnnee: 30 },
    { pays: 'RDC', niveau: '6e', brancheCode: 'FR', chapitre: 'Grammaire', heuresAnnee: 40 },
    { pays: 'RDC', niveau: '6e', brancheCode: 'FR', chapitre: 'Conjugaison', heuresAnnee: 25 },
    { pays: 'RDC', niveau: '6e', brancheCode: 'SVT', chapitre: 'Le vivant', heuresAnnee: 35 },
    // 5e
    { pays: 'RDC', niveau: '5e', brancheCode: 'MATH', chapitre: 'Nombres et calculs', heuresAnnee: 40 },
    { pays: 'RDC', niveau: '5e', brancheCode: 'MATH', chapitre: 'Organisation et gestion de données', heuresAnnee: 25 },
    { pays: 'RDC', niveau: '5e', brancheCode: 'FR', chapitre: 'Grammaire', heuresAnnee: 35 },
    { pays: 'RDC', niveau: '5e', brancheCode: 'HIST', chapitre: 'Moyen Âge', heuresAnnee: 30 },
    { pays: 'RDC', niveau: '5e', brancheCode: 'GEO', chapitre: 'Climats et biomes', heuresAnnee: 25 },
    { pays: 'RDC', niveau: '5e', brancheCode: 'PHY', chapitre: 'Lumière', heuresAnnee: 25 },
    { pays: 'RDC', niveau: '5e', brancheCode: 'SVT', chapitre: 'Le vivant', heuresAnnee: 35 },
    // 4e
    { pays: 'RDC', niveau: '4e', brancheCode: 'MATH', chapitre: 'Nombres et calculs', heuresAnnee: 35 },
    { pays: 'RDC', niveau: '4e', brancheCode: 'MATH', chapitre: 'Géométrie', heuresAnnee: 40 },
    { pays: 'RDC', niveau: '4e', brancheCode: 'HIST', chapitre: 'Révolution et Empire', heuresAnnee: 30 },
    { pays: 'RDC', niveau: '4e', brancheCode: 'GEO', chapitre: 'Mondialisation', heuresAnnee: 25 },
    { pays: 'RDC', niveau: '4e', brancheCode: 'PHY', chapitre: 'Énergie', heuresAnnee: 30 },
    // 3e (NOUVEAU)
    { pays: 'RDC', niveau: '3e', brancheCode: 'MATH', chapitre: 'Nombres réels et algèbre', heuresAnnee: 40 },
    { pays: 'RDC', niveau: '3e', brancheCode: 'MATH', chapitre: 'Géométrie et trigonométrie', heuresAnnee: 35 },
    { pays: 'RDC', niveau: '3e', brancheCode: 'MATH', chapitre: 'Fonctions et équations', heuresAnnee: 30 },
    { pays: 'RDC', niveau: '3e', brancheCode: 'FR', chapitre: 'Littérature et analyse textuelle', heuresAnnee: 35 },
    { pays: 'RDC', niveau: '3e', brancheCode: 'FR', chapitre: 'Dissertation et expression', heuresAnnee: 30 },
    { pays: 'RDC', niveau: '3e', brancheCode: 'HIST', chapitre: 'Époques contemporaines', heuresAnnee: 30 },
    { pays: 'RDC', niveau: '3e', brancheCode: 'GEO', chapitre: 'Géopolitique et développement', heuresAnnee: 25 },
    { pays: 'RDC', niveau: '3e', brancheCode: 'PHY', chapitre: 'Électricité et magnétisme', heuresAnnee: 30 },
    { pays: 'RDC', niveau: '3e', brancheCode: 'SVT', chapitre: 'Génétique et évolution', heuresAnnee: 30 },
  ]

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
        chapitre: p.chapitre, heuresAnnee: p.heuresAnnee,
      },
      update: { heuresAnnee: p.heuresAnnee },
    })
  }
  console.log(`✅ ${programmes.length} entrées programme national (RDC, 4 niveaux)`)

  // =========================================================
  // 3. NOTIONS 3e SECONDaire (y compris Ensemble R des réels)
  // =========================================================
  const notions3e = [
    {
      id: 'notion_reels_3e', nom: "L'Ensemble R des réels",
      description: "Définition de l'ensemble des nombres réels, notation, représentation sur la droite numérique, intervalles, rationnels et irrationnels.",
      niveau: '3e', chapitre: 'Nombres réels et algèbre',
      competences: ['Définir l\'ensemble R', 'Représenter un réel sur la droite numérique', 'Distinguer rationnels et irrationnels'],
      objectifs: ['Définir R et ses sous-ensembles', 'Représenter les réels sur une droite graduée', 'Manipuler les intervalles de R'],
    },
    {
      id: 'notion_fonctions_3e', nom: 'Notions de fonction',
      description: 'Définition, notation, ensemble de définition, image et antécédent, représentation graphique.',
      niveau: '3e', chapitre: 'Fonctions et équations',
      competences: ['Définir une fonction', 'Déterminer l\'ensemble de définition', 'Représenter graphiquement'],
      objectifs: ['Comprendre la notion de fonction', 'Calculer images et antécédents', 'Tracer une courbe représentative'],
    },
    {
      id: 'notion_trigo_3e', nom: 'Trigonométrie dans le triangle rectangle',
      description: 'Cosinus, sinus, tangente d\'un angle aigu. Applications au calcul de longueurs et d\'angles.',
      niveau: '3e', chapitre: 'Géométrie et trigonométrie',
      competences: ['Utiliser les rapports trigonométriques', 'Calculer des longueurs et angles'],
      objectifs: ['Définir cos, sin, tan', 'Résoudre des problèmes de triangulation'],
    },
    {
      id: 'notion_dissertation_3e', nom: 'La dissertation française',
      description: 'Structure de la dissertation, thèse, antithèse, synthèse. Méthodologie et exemples.',
      niveau: '3e', chapitre: 'Dissertation et expression',
      competences: ['Structurer une dissertation', 'Argumenter'],
      objectifs: ['Maîtriser le plan dialectique', 'Rédiger une introduction et conclusion'],
    },
  ]

  for (const n of notions3e) {
    const existing = await db.notion.findUnique({ where: { id: n.id } })
    if (!existing) {
      await db.notion.create({
        data: {
          id: n.id, nom: n.nom, description: n.description,
          niveau: n.niveau, chapitre: n.chapitre,
          competences: JSON.stringify(n.competences),
          objectifs: JSON.stringify(n.objectifs),
        },
      })
    }
  }
  console.log(`✅ ${notions3e.length} notions 3e secondaire (dont Ensemble R des réels)`)

  // =========================================================
  // 4. PROGRESSIONS 3e (prévision annuelle)
  // =========================================================
  const progressions3e = [
    { niveau: '3e', chapitre: 'Nombres réels et algèbre', notionId: 'notion_reels_3e', semaine: 3, dureeMin: 50 },
    { niveau: '3e', chapitre: 'Fonctions et équations', notionId: 'notion_fonctions_3e', semaine: 8, dureeMin: 60 },
    { niveau: '3e', chapitre: 'Géométrie et trigonométrie', notionId: 'notion_trigo_3e', semaine: 14, dureeMin: 55 },
    { niveau: '3e', chapitre: 'Dissertation et expression', notionId: 'notion_dissertation_3e', semaine: 18, dureeMin: 60 },
  ]
  for (const p of progressions3e) {
    const existing = await db.progression.findFirst({ where: { niveau: p.niveau, chapitre: p.chapitre, notionId: p.notionId } })
    if (!existing) {
      await db.progression.create({ data: p })
    }
  }
  console.log(`✅ ${progressions3e.length} progressions 3e (prévision annuelle)`)

  // =========================================================
  // 5. SÉQUENCES 3e
  // =========================================================
  for (const p of progressions3e) {
    const notion = await db.notion.findUnique({ where: { id: p.notionId } })
    if (!notion) continue
    const existingSeq = await db.sequence.findFirst({ where: { titre: `${notion.nom} — ${p.niveau}` } })
    if (!existingSeq) {
      const seq = await db.sequence.create({
        data: {
          titre: `${notion.nom} — ${p.niveau}`,
          notionIds: JSON.stringify([p.notionId]),
          niveau: p.niveau, chapitre: p.chapitre, semaine: p.semaine,
          statut: p.semaine <= 8 ? 'en_cours' : 'en_attente',
          priorite: p.semaine <= 12 ? 5 : 3,
          templateVersion: 'v1', curriculumVersion: 'v1',
        },
      })
      await db.sequenceNotion.create({ data: { sequenceId: seq.id, notionId: p.notionId } })
    }
  }

  // =========================================================
  // 6. RÈGLES pour le 3e
  // =========================================================
  const regles3e = [
    { niveau: '3e', cle: 'style_ton', valeur: JSON.stringify('rigoureux, formalisation avancée, vocabulaire technique') },
    { niveau: '3e', cle: 'longueur_section', valeur: JSON.stringify({ min_mots: 60, max_mots: 350 }) },
    { niveau: '3e', cle: 'format_questions', valeur: JSON.stringify('mixte : 70% ouverts, 30% fermés') },
  ]
  for (const r of regles3e) {
    const existing = await db.regle.findFirst({ where: { niveau: r.niveau, cle: r.cle } })
    if (!existing) await db.regle.create({ data: r })
  }
  console.log(`✅ ${regles3e.length} règles pour le 3e`)

  // =========================================================
  // RÉCAPITULATIF
  // =========================================================
  const allNotions = await db.notion.findMany()
  const allProgs = await db.programmeNational.findMany({ include: { branche: true } })
  const allSeqs = await db.sequence.findMany()
  const niveaux = [...new Set(allNotions.map((n) => n.niveau))].sort()

  console.log('\n📊 RÉCAPITULATIF :')
  console.log(`  Branches : ${branches.length}`)
  console.log(`  Programme national : ${allProgs.length} entrées`)
  console.log(`  Notions : ${allNotions.length} (niveaux: ${niveaux.join(', ')})`)
  console.log(`  Séquences : ${allSeqs.length}`)

  // Vérifier que le 3e est couvert
  const notions3eCount = allNotions.filter((n) => n.niveau === '3e').length
  const progs3eCount = allProgs.filter((p) => p.niveau === '3e').length
  const seqs3eCount = allSeqs.filter((s) => s.niveau === '3e').length
  console.log(`\n  3e secondaire : ${notions3eCount} notions, ${progs3eCount} programmes, ${seqs3eCount} séquences`)

  // Lier les progressions existantes aux branches
  const allProgressions = await db.progression.findMany()
  for (const prog of allProgressions) {
    if (!prog.brancheId) {
      // Déduire la branche du chapitre
      const branche = branches.find((b) => {
        const progsForBranche = programmes.filter((p) => p.brancheCode === b.code && p.chapitre === prog.chapitre && p.niveau === prog.niveau)
        return progsForBranche.length > 0
      })
      if (branche) {
        await db.progression.update({ where: { id: prog.id }, data: { brancheId: branche.id } })
      }
    }
  }

  console.log('\n🎉 Seed programme national terminé')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await db.$disconnect() })
