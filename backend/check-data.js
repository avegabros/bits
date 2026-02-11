const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    console.log('=== ATTENDANCE LOGS (Last 10) ===');
    const logs = await prisma.attendanceLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10,
        include: { employee: { select: { firstName: true, lastName: true, zkId: true } } }
    });
    logs.forEach(log => {
        console.log(`${log.timestamp.toISOString()} - ${log.employee.firstName} ${log.employee.lastName} (zkId: ${log.employee.zkId})`);
    });

    console.log('\n=== ATTENDANCE RECORDS (Last 5) ===');
    const records = await prisma.attendance.findMany({
        orderBy: { date: 'desc' },
        take: 5,
        include: { employee: { select: { firstName: true, lastName: true } } }
    });
    records.forEach(rec => {
        console.log(`${rec.date.toISOString().split('T')[0]} - ${rec.employee.firstName} ${rec.employee.lastName}`);
        console.log(`  Check-In:  ${rec.checkInTime.toISOString()}`);
        console.log(`  Check-Out: ${rec.checkOutTime ? rec.checkOutTime.toISOString() : 'NULL'}`);
        console.log(`  Status: ${rec.status}`);
    });

    await prisma.$disconnect();
}

checkData();
