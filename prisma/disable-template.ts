// Robustness test helper — disable FicheTemplate v1 (Phase 12.3)
// Run: bun run prisma/disable-template.ts [enable|disable]

import { db } from '@/lib/db'

async function main() {
  const action = process.argv[2] ?? 'disable'
  const active = action === 'enable'
  const before = await db.ficheTemplate.findUnique({ where: { version: 'v1' } })
  console.log(`[disable-template] before: version=v1 active=${before?.active}`)
  await db.ficheTemplate.update({ where: { version: 'v1' }, data: { active } })
  const after = await db.ficheTemplate.findUnique({ where: { version: 'v1' } })
  console.log(`[disable-template] after: version=v1 active=${after?.active}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
