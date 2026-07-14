// Seed — Templates structurels multi-formats (Sprint 5)
// 3 templates : Congolais BGP (2 pages recto-verso), Fiche Sésame (Français), Moderne

import { db } from '@/lib/db'

async function main() {
  console.log('🎨 Seed templates structurels multi-formats\n')

  // =========================================================
  // 1. Template Congolais BGP — 2 pages recto-verso
  // Structure fidèle au modèle IMG_0453/0454
  // =========================================================
  await db.ficheTemplate.upsert({
    where: { version: 'congolais-bgp-v1' },
    create: {
      version: 'congolais-bgp-v1',
      nom: 'Fiche Pédagogique Congolaise (BGP)',
      structure: JSON.stringify({
        type: 'congolais-bgp',
        pages: 2, // FORCÉ : 2 pages recto-verso
        page1_recto: {
          titre: 'FICHE PÉDAGOGIQUE',
          champs_en_tete: [
            { id: 'fiche_numero', label: 'FICHE N°', type: 'string', placeholder: '................................' },
            { id: 'branche', label: 'BRANCHE', type: 'string' },
            { id: 'sujet_revision', label: 'SUJET DE LA RÉVISION', type: 'string' },
            { id: 'sujet_jour', label: 'SUJET DU JOUR', type: 'string' },
            { id: 'objectifs', label: 'OBJECTIFS OPÉRATIONNELS', type: 'text' },
            { id: 'competences', label: "À L'ISSUE DE CETTE LEÇON, L'ÉLÈVE SERA CAPABLE DE (D')", type: 'list', marker: '▲' },
            { id: 'materiel', label: 'MATÉRIEL DIDACTIQUE', type: 'string' },
            { id: 'ref_bgp', label: '/REF. BGP', type: 'string' },
          ],
          tableau_2_colonnes: {
            gauche: 'MÉTHODE ET PROCÉDÉ',
            droite: 'MATIÈRES À ENSEIGNER',
          },
          sections_page1: [
            { id: 'introduction', label: 'I. INTRODUCTION', obligatoire: true, sous_sections: ['a) Rappel', 'b) Motivation', 'c) Annonce du sujet'] },
            { id: 'developpement_debut', label: 'II. DÉVELOPPEMENT (début)', obligatoire: true },
          ],
        },
        page2_verso: {
          sections_page2: [
            { id: 'developpement_suite', label: 'II. DÉVELOPPEMENT (suite)', obligatoire: true },
            { id: 'synthese', label: 'III. SYNTHÈSE', obligatoire: true, min_mots: 40 },
            { id: 'application', label: 'IV. APPLICATION', obligatoire: true, min_items: 2 },
            { id: 'auto_evaluation', label: 'V. AUTO-ÉVALUATION', obligatoire: true, min_items: 2 },
          ],
          pied_page: 'Généré par Élite v2 — Plateforme pédagogique agentique',
        },
        style: {
          couleur_primaire: '#0F766E',
          couleur_secondaire: '#14B8A6',
          police: 'Helvetica',
          marges: { top: 40, bottom: 40, left: 40, right: 40 },
        },
      }),
      active: true,
    },
    update: {},
  })
  console.log('✅ Template Congolais BGP (2 pages recto-verso)')

  // =========================================================
  // 2. Template Fiche Sésame — Français
  // Structure pédagogique pour cours de français
  // =========================================================
  await db.ficheTemplate.upsert({
    where: { version: 'sesame-francais-v1' },
    create: {
      version: 'sesame-francais-v1',
      nom: 'Fiche Sésame — Cours de Français',
      structure: JSON.stringify({
        type: 'sesame-francais',
        pages: 2,
        page1_recto: {
          titre: 'FICHE SÉSAME — FRANÇAIS',
          champs_en_tete: [
            { id: 'niveau', label: 'Niveau', type: 'string' },
            { id: 'discipline', label: 'Discipline', type: 'string', default: 'Français' },
            { id: 'chapitre', label: 'Chapitre', type: 'string' },
            { id: 'titre_lecon', label: 'Titre de la leçon', type: 'string' },
            { id: 'duree', label: 'Durée', type: 'string', placeholder: '.... min' },
            { id: 'objectifs', label: 'Objectifs pédagogiques', type: 'list' },
            { id: 'supports', label: 'Supports didactiques', type: 'list' },
            { id: 'prerequis', label: 'Prérequis', type: 'text' },
          ],
          sections_page1: [
            { id: 'decouverte', label: 'Phase 1 — Découverte', obligatoire: true, description: 'Mise en situation, activation des prérequis, émergence des représentations' },
            { id: 'comprehension', label: 'Phase 2 — Compréhension', obligatoire: true, description: 'Analyse du support, questions de compréhension, vocabulaire' },
          ],
        },
        page2_verso: {
          sections_page2: [
            { id: 'structuration', label: 'Phase 3 — Structuration', obligatoire: true, description: 'Institutionnalisation, trace écrite, synthèse' },
            { id: 'application', label: 'Phase 4 — Application', obligatoire: true, description: 'Exercices, transfert, production écrite/orale' },
            { id: 'evaluation', label: 'Phase 5 — Évaluation', obligatoire: true, description: 'Critères de réussite, grille d\'évaluation' },
            { id: 'prolongement', label: 'Prolongement', obligatoire: false, description: 'Ouverture interdisciplinaire, lien avec la séquence suivante' },
          ],
          pied_page: 'Fiche Sésame — Élite v2',
        },
        style: {
          couleur_primaire: '#7C3AED',
          couleur_secondaire: '#A78BFA',
          police: 'Helvetica',
          marges: { top: 45, bottom: 45, left: 45, right: 45 },
        },
      }),
      active: true,
    },
    update: {},
  })
  console.log('✅ Template Fiche Sésame (Français)')

  // =========================================================
  // 3. Template Moderne — Design premium
  // =========================================================
  await db.ficheTemplate.upsert({
    where: { version: 'moderne-v1' },
    create: {
      version: 'moderne-v1',
      nom: 'Fiche Moderne — Design Premium',
      structure: JSON.stringify({
        type: 'moderne',
        pages: 2,
        page1_recto: {
          titre: 'SÉQUENCE PÉDAGOGIQUE',
          champs_en_tete: [
            { id: 'titre', label: 'Titre', type: 'string' },
            { id: 'niveau', label: 'Niveau', type: 'string' },
            { id: 'discipline', label: 'Discipline', type: 'string' },
            { id: 'duree', label: 'Durée', type: 'string' },
            { id: 'objectifs', label: 'Objectifs', type: 'list' },
            { id: 'prerequis', label: 'Prérequis', type: 'list' },
            { id: 'competences', label: 'Compétences visées', type: 'list' },
          ],
          sections_page1: [
            { id: 'deroulement', label: 'Déroulement', obligatoire: true },
            { id: 'activites', label: 'Activités', obligatoire: true },
          ],
        },
        page2_verso: {
          sections_page2: [
            { id: 'differentiation', label: 'Différenciation', obligatoire: true },
            { id: 'evaluation', label: 'Évaluation', obligatoire: true },
            { id: 'prolongement', label: 'Prolongement', obligatoire: false },
          ],
          pied_page: 'Élite v2 — Premium',
        },
        style: {
          couleur_primaire: '#0EA5E9',
          couleur_secondaire: '#38BDF8',
          police: 'Helvetica',
          marges: { top: 50, bottom: 50, left: 50, right: 50 },
        },
      }),
      active: true,
    },
    update: {},
  })
  console.log('✅ Template Moderne (Premium)')

  // Lister tous les templates
  const all = await db.ficheTemplate.findMany()
  console.log(`\n📊 ${all.length} templates en DB :`)
  for (const t of all) {
    const s = JSON.parse(t.structure)
    console.log(`  - ${t.version}: ${t.nom} (${s.pages} page(s), ${s.type})`)
  }

  console.log('\n🎉 Templates seedés')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await db.$disconnect() })
