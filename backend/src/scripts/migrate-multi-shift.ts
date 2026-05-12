import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting multi-shift data migration...');

  // 1. Migrate Employees to EmployeeShift
  const employeesWithShift = await prisma.employee.findMany({
    where: {
      shiftId: { not: null },
    },
  });

  console.log(`Found ${employeesWithShift.length} employees with a shift assigned.`);

  let employeeShiftCount = 0;
  for (const emp of employeesWithShift) {
    if (!emp.shiftId) continue;

    // Check if already exists to make script idempotent
    const existing = await prisma.employeeShift.findFirst({
      where: { employeeId: emp.id, shiftId: emp.shiftId },
    });

    if (!existing) {
      await prisma.employeeShift.create({
        data: {
          employeeId: emp.id,
          shiftId: emp.shiftId,
          sortOrder: 0,
          isPrimary: true,
        },
      });
      employeeShiftCount++;
    }
  }
  console.log(`Created ${employeeShiftCount} EmployeeShift records.`);

  // 2. Backfill Attendance records
  const attendancesToUpdate = await prisma.attendance.findMany({
    where: {
      shiftId: null,
    },
    include: {
      employee: {
        select: { shiftId: true },
      },
    },
  });

  console.log(`Found ${attendancesToUpdate.length} attendance records missing shiftId.`);

  let attendanceUpdateCount = 0;
  for (const att of attendancesToUpdate) {
    if (att.employee.shiftId) {
      await prisma.attendance.update({
        where: { id: att.id },
        data: { shiftId: att.employee.shiftId },
      });
      attendanceUpdateCount++;
    }
  }
  
  console.log(`Updated ${attendanceUpdateCount} Attendance records with shiftId.`);
  console.log('Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
