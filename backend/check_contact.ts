import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const dup = await prisma.employee.findFirst({
    where: { contactNumber: '0912 325 2521', id: { not: 6 } }
  })
  console.log(dup)
}

main().catch(console.error).finally(() => prisma.$disconnect())
