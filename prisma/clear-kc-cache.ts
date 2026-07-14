// Robustness test helper — clear GenerationContext cache for one or all sequences
// Run: bun run prisma/clear-kc-cache.ts [sequenceId]

import { db } from '@/lib/db'

async function main() {
  const seqId = process.argv[2]
  if (seqId) {
    const r = await db.generationContext.deleteMany({ where: { sequenceId: seqId } })
    console.log(`[clear-kc-cache] deleted ${r.count} GenerationContext for sequenceId=${seqId}`)
  } else {
    const r = await db.generationContext.deleteMany({})
    console.log(`[clear-kc-cache] deleted ${r.count} GenerationContext (all)`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
