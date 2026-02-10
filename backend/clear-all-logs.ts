import { ZKDriver } from './src/lib/zk-driver';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function clearAllLogs() {
    const driver = new ZKDriver(process.env.ZK_HOST || '192.168.1.201', parseInt(process.env.ZK_PORT || '4370'));

    try {
        console.log('Step 1: Connecting to ZKTeco device...');
        await driver.connect();
        console.log('✅ Connected!');

        console.log('\nStep 2: Clearing attendance logs from device...');
        await driver.clearAttendanceLogs();
        console.log('✅ Device logs cleared!');

        await driver.disconnect();

        console.log('\nStep 3: Clearing database tables...');
        const attendance = await prisma.attendance.deleteMany({});
        console.log(`✅ Deleted ${attendance.count} records from Attendance table`);

        const logs = await prisma.attendanceLog.deleteMany({});
        console.log(`✅ Deleted ${logs.count} records from AttendanceLog table`);

        console.log('\n🎉 All logs cleared successfully!');
        console.log('You can now scan your fingerprint for a fresh test.');

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

clearAllLogs();
