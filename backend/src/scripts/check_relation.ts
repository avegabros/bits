
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Attendance -> Employee Relation...');

    // 1. Count total
    const count = await prisma.attendance.count();
    console.log(`Total Attendance Records: ${count}`);

    if (count === 0) return;

    // 2. Fetch one with include
    const record = await prisma.attendance.findFirst({
        include: { employee: true }
    });

    console.log('Sample Record:', JSON.stringify(record, null, 2));

    if (record) {
        if (!record.employee) {
            console.error('CRITICAL: Employee relation is null! Orphan record?');
            // Check if employee exists manually
            const emp = await prisma.employee.findUnique({ where: { id: record.employeeId } });
            console.log('Manual Employee Lookup:', emp);
        } else {
            console.log('Relation seems OK.');
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
