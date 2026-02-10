const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanTables() {
    try {
        console.log('Cleaning Attendance table...');
        const attendance = await prisma.attendance.deleteMany({});
        console.log(`Deleted ${attendance.count} records from Attendance`);

        console.log('Cleaning AttendanceLog table...');
        const logs = await prisma.attendanceLog.deleteMany({});
        console.log(`Deleted ${logs.count} records from AttendanceLog`);

        console.log('\n✅ Tables cleaned successfully!');
        await prisma.$disconnect();
    } catch (error) {
        console.error('Error:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

cleanTables();
