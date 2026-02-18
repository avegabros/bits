
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Attendance records...');
    const count = await prisma.attendance.count();
    console.log(`Total Attendance records: ${count}`);

    if (count > 0) {
        const records = await prisma.attendance.findMany({
            take: 5,
            orderBy: { date: 'desc' },
            include: { Employee: true }
        });
        console.log('Last 5 records:', JSON.stringify(records, null, 2));
    } else {
        console.log('No attendance records found.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
