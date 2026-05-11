import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const att = await prisma.attendance.findMany({
    where: { employeeId: 6 },
    include: { shift: true }
  })
  console.dir(att, { depth: null })
}

main().catch(console.error).finally(() => prisma.$disconnect())
