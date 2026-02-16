
import { prisma } from '../lib/prisma';

async function main() {
    const employees = await prisma.employee.findMany({
        select: {
            id: true,
            zkId: true,
            firstName: true,
            lastName: true,
            role: true,
            employeeNumber: true
        }
    });

    console.table(employees);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
