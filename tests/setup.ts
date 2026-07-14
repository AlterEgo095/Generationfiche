// Setup global pour les tests d'intégration — P0-4
// Assure que la base de données est dans un état connu avant les tests.
// Utilise la même base SQLite que le dev (tests d'intégration réels).

import { beforeAll } from 'vitest'
import { db } from '@/lib/db'

let setupDone = false

export async function ensureTestDB() {
  if (setupDone) return
  setupDone = true

  // Vérifie que la base a au moins les notions seedées
  const notionCount = await db.notion.count()
  if (notionCount === 0) {
    throw new Error('Base de test vide — exécutez `bun run db:seed` avant les tests')
  }
}

// Nettoyage des artifacts de test (séquences/livrables créés pendant les tests)
export async function cleanupTestArtifacts() {
  // Supprime les livrables créés pendant les tests (on garde les seed)
  await db.validationResult.deleteMany({
    where: { livrable: { skillVersion: { in: ['v1', 'v2'] }, createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } } },
  })
  // Note : on ne supprime pas les livrables/sequences seed — ils sont nécessaires
}

beforeAll(async () => {
  await ensureTestDB()
})
