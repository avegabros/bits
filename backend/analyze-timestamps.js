const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeTimestamps() {
    const logs = await prisma.attendanceLog.findMany({
        orderBy: { timestamp: 'asc' },
        include: { employee: { select: { firstName: true, lastName: true, zkId: true } } }
    });

    console.log('=== ANALYZING ATTENDANCE LOGS ===\n');

    // Group by employee
    const byEmployee = {};
    logs.forEach(log => {
        const key = log.employeeId;
        if (!byEmployee[key]) {
            byEmployee[key] = {
                name: `${log.employee.firstName} ${log.employee.lastName}`,
                zkId: log.employee.zkId,
                logs: []
            };
        }
        byEmployee[key].logs.push(log);
    });

    Object.values(byEmployee).forEach(emp => {
        console.log(`${emp.name} (zkId: ${emp.zkId})`);
        emp.logs.forEach((log, idx) => {
            const time = new Date(log.timestamp);
            console.log(`  Log ${idx + 1}: ${time.toISOString()} (${time.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })})`);

            if (idx > 0) {
                const prevTime = new Date(emp.logs[idx - 1].timestamp);
                const diffMs = time.getTime() - prevTime.getTime();
                const diffHours = diffMs / (1000 * 60 * 60);
                console.log(`    → ${diffHours.toFixed(2)} hours after previous scan`);
                console.log(`    → ${diffHours >= 2 ? '✅ WOULD BE CHECK-OUT' : '❌ BLOCKED BY 2-HOUR RULE'}`);
            }
        });
        console.log('');
    });

    await prisma.$disconnect();
}

analyzeTimestamps();
