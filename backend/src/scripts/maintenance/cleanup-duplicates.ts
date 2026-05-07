import { prisma } from '../../shared/lib/prisma';

async function main() {
    console.log('Deleting all derived Attendance records...');
    const result = await prisma.attendance.deleteMany({});
    console.log(`Deleted ${result.count} attendance records.`);
    console.log('They will regenerate correctly on the next cron sync (within 10 seconds).');
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});

