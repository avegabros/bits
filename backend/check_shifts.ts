import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const shifts = await prisma.shift.findMany()
  console.dir(shifts, { depth: null })
}

main().catch(console.error).finally(() => prisma.$disconnect())
