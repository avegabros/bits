import { prisma } from '../lib/prisma';

async function listAttendance() {
    console.log('Listing attendance for employees 35 and 32...');

    // Find ALL records for these employees
    const records = await prisma.attendance.findMany({
        where: {
            employeeId: { in: [35, 32] }
        },
        orderBy: {
            date: 'desc'
        },
        take: 10
    });

    console.log(`Found ${records.length} recent records:`);
    records.forEach(r => {
        console.log(`\nID: ${r.id}`);
        console.log(`Employee: ${r.employeeId}`);
        console.log(`Date (Stored): ${r.date.toISOString()} (${r.date})`);
        console.log(`CheckIn: ${r.checkInTime.toLocaleString()}`);
        console.log(`CheckOut: ${r.checkOutTime ? r.checkOutTime.toLocaleString() : 'NULL'}`);
    });
}

listAttendance()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
