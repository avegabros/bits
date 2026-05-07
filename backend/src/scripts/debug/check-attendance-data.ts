
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.attendance.count();
    console.log(`Total Attendance Records: ${count}`);

    if (count > 0) {
        const first = await prisma.attendance.findFirst({
            include: { employee: true }
        });
        console.log('First Record sample:', JSON.stringify(first, null, 2));
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
