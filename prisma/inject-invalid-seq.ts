// Robustness test helper — create sequence with invalid notionIds (Phase 12.4)
// Run: bun run prisma/inject-invalid-seq.ts

import { db } from '@/lib/db'

async function main() {
  // Try to create a sequence with a notionId that doesn't exist
  // We bypass the API to insert directly (avoiding FK check via separate create)
  // First create the sequence WITHOUT notion links
  const seq = await db.sequence.create({
    data: {
      titre: '[TEST A2] Séquence avec notion inexistante',
      notionIds: JSON.stringify(['notion_inexistante_xyz']),
      niveau: '4e',
      chapitre: 'Test',
      semaine: 99,
      priorite: 0,
      statut: 'en_attente',
      templateVersion: 'v1',
      curriculumVersion: 'v1',
    },
  })
  console.log(`[inject-invalid-seq] sequence created: ${seq.id}`)
  console.log(`  notionIds stored (raw JSON): ${seq.notionIds}`)
  console.log(`  (no SequenceNotion rows created — FK would fail on 'notion_inexistante_xyz')`)
  console.log(`  sequence_titre: ${seq.titre}`)
  console.log(`  → Use this id in POST /api/pipeline/generate mode=single to test KC behavior`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
