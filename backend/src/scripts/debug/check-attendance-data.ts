import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- LATEST 10 ATTENDANCE LOGS ---");
    const logs = await prisma.attendanceLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: { employee: true }
    });

    for (const log of logs) {
        console.log(`Log ID: ${log.id}`);
        console.log(`Employee: ${log.employee.firstName} ${log.employee.lastName} (zkId: ${log.employee.zkId})`);
        console.log(`Timestamp: ${log.timestamp.toISOString()}`);
        console.log(`Status: ${log.status}`);
        console.log(`AuthMethod (Raw): ${log.authMethod}`);
        console.log(`-----------------------------------`);
    }

    console.log("\n--- LATEST 5 ATTENDANCE RECORDS ---");
    const atts = await prisma.attendance.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: { employee: true }
    });

    for (const att of atts) {
        console.log(`Attendance ID: ${att.id}`);
        console.log(`Employee: ${att.employee.firstName} ${att.employee.lastName}`);
        console.log(`Date: ${att.date.toISOString()}`);
        console.log(`CheckInTime: ${att.checkInTime.toISOString()} (${att.checkInAuthMethod})`);
        console.log(`CheckOutTime: ${att.checkOutTime?.toISOString()} (${att.checkOutAuthMethod})`);
        console.log(`-----------------------------------`);
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
