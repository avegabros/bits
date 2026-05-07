
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.employee.count();
        console.log(`Total employees in DB: ${count}`);

        // Also list first 5 to see data structure if any
        const firstFew = await prisma.employee.findMany({ take: 5 });
        console.log(JSON.stringify(firstFew, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
