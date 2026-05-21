import { PrismaClient } from '@prisma/client';
import { recalculateAndPersistAttendanceMetrics } from '../modules/attendance/attendance.service';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting historical attendance metrics backfill...');

  // Fetch all unique employeeId and date combinations
  const uniquePairs = await prisma.attendance.findMany({
    select: {
      employeeId: true,
      date: true,
    },
    distinct: ['employeeId', 'date'],
  });

  console.log(`Found ${uniquePairs.length} unique employee/date records to backfill.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < uniquePairs.length; i++) {
    const { employeeId, date } = uniquePairs[i];
    try {
      // Use recalculateAndPersistAttendanceMetrics to compute and save metrics
      await recalculateAndPersistAttendanceMetrics(employeeId, date);
      successCount++;
      if (successCount % 100 === 0) {
        console.log(`Progress: Recalculated ${successCount}/${uniquePairs.length} records...`);
      }
    } catch (error) {
      console.error(`Failed to backfill metrics for employeeId ${employeeId} on date ${date.toISOString()}:`, error);
      failCount++;
    }
  }

  console.log(`\nBackfill complete!`);
  console.log(`Successfully recalculated and persisted metrics for: ${successCount} records.`);
  if (failCount > 0) {
    console.warn(`Failed for: ${failCount} records.`);
  }
}

main()
  .catch((e) => {
    console.error('Backfill script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
