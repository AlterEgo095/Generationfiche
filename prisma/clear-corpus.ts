// Robustness test helper — clear corpus (Phase 12.1)
// Run: bun run prisma/clear-corpus.ts

import { db } from '@/lib/db'

async function main() {
  const before = await db.corpusVectoriel.count()
  console.log(`[clear-corpus] before: ${before} entries`)
  const r = await db.corpusVectoriel.deleteMany({})
  console.log(`[clear-corpus] deleted ${r.count} entries`)
  const after = await db.corpusVectoriel.count()
  console.log(`[clear-corpus] after: ${after} entries`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
