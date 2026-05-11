import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const employeeId = 6;
  const shiftIds = [7, 8];

  await prisma.employeeShift.deleteMany({ where: { employeeId } });

  await prisma.employeeShift.createMany({
      data: shiftIds.map((sid, i) => ({
          employeeId,
          shiftId: sid,
          sortOrder: i,
          isPrimary: i === 0
      }))
  });

  console.log("Updated dummy zkteco to shifts 7 and 8");
}

main().catch(console.error).finally(() => prisma.$disconnect())
