import { prisma } from '../lib/prisma';

/**
 * Migration Script: Fix Timezone Data
 * 
 * This script corrects all existing timestamps in the database by converting
 * Philippine Time to UTC (subtracting 8 hours).
 * 
 * Background:
 * - ZKTeco device returns Philippine Time (UTC+8)
 * - Old code stored it directly with UTC marker (wrong!)
 * - This caused 8-hour offset in frontend display
 * 
 * What this does:
 * - Subtracts 8 hours from all AttendanceLog timestamps
 * - Subtracts 8 hours from all Attendance checkIn/checkOut times
 * - Updates the 'date' field to match the corrected date
 */

async function fixTimezoneData() {
    console.log('====================================');
    console.log('  TIMEZONE DATA MIGRATION');
    console.log('====================================\n');

    try {
        // Step 1: Get all AttendanceLogs
        console.log('Step 1: Fetching all attendance logs...');
        const logs = await prisma.attendanceLog.findMany({
            orderBy: { timestamp: 'asc' }
        });
        console.log(`Found ${logs.length} attendance logs to fix\n`);

        // Step 2: Fix AttendanceLogs (subtract 8 hours)
        console.log('Step 2: Converting AttendanceLog timestamps (PHT → UTC)...');
        let logsFixed = 0;
        for (const log of logs) {
            const utcTime = new Date(log.timestamp.getTime() - (8 * 60 * 60 * 1000));

            await prisma.attendanceLog.update({
                where: { id: log.id },
                data: { timestamp: utcTime }
            });
            logsFixed++;

            if (logsFixed % 10 === 0) {
                console.log(`  Fixed ${logsFixed}/${logs.length} logs...`);
            }
        }
        console.log(`✅ Fixed ${logsFixed} attendance logs\n`);

        // Step 3: Get all Attendance records
        console.log('Step 3: Fetching all attendance records...');
        const attendances = await prisma.attendance.findMany({
            orderBy: { date: 'asc' }
        });
        console.log(`Found ${attendances.length} attendance records to fix\n`);

        // Step 4: Fix Attendance records
        console.log('Step 4: Converting Attendance times (PHT → UTC)...');
        let attendancesFixed = 0;
        for (const attendance of attendances) {
            // Convert checkInTime
            const utcCheckIn = new Date(attendance.checkInTime.getTime() - (8 * 60 * 60 * 1000));

            // Convert checkOutTime if exists
            const utcCheckOut = attendance.checkOutTime
                ? new Date(attendance.checkOutTime.getTime() - (8 * 60 * 60 * 1000))
                : null;

            // Update date to match the new check-in date at midnight UTC
            const newDate = new Date(utcCheckIn);
            newDate.setUTCHours(0, 0, 0, 0);

            await prisma.attendance.update({
                where: { id: attendance.id },
                data: {
                    date: newDate,
                    checkInTime: utcCheckIn,
                    checkOutTime: utcCheckOut
                }
            });
            attendancesFixed++;

            if (attendancesFixed % 5 === 0) {
                console.log(`  Fixed ${attendancesFixed}/${attendances.length} records...`);
            }
        }
        console.log(`✅ Fixed ${attendancesFixed} attendance records\n`);

        // Step 5: Show sample results
        console.log('====================================');
        console.log('Step 5: Verification - Sample Results');
        console.log('====================================\n');

        const sampleLogs = await prisma.attendanceLog.findMany({
            take: 3,
            orderBy: { timestamp: 'desc' },
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        console.log('Latest 3 AttendanceLogs:');
        sampleLogs.forEach((log, idx) => {
            console.log(`${idx + 1}. ${log.employee.firstName} ${log.employee.lastName}`);
            console.log(`   Timestamp (UTC): ${log.timestamp.toISOString()}`);
            console.log(`   Will display as: ${new Date(log.timestamp.getTime() + (8 * 60 * 60 * 1000)).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\n`);
        });

        const sampleAttendances = await prisma.attendance.findMany({
            take: 3,
            orderBy: { date: 'desc' },
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        console.log('Latest 3 Attendance Records:');
        sampleAttendances.forEach((att, idx) => {
            console.log(`${idx + 1}. ${att.employee.firstName} ${att.employee.lastName}`);
            console.log(`   Date: ${att.date.toISOString().split('T')[0]}`);
            console.log(`   Check-in (UTC): ${att.checkInTime.toISOString()}`);
            console.log(`   Check-out (UTC): ${att.checkOutTime ? att.checkOutTime.toISOString() : 'NULL'}`);
            console.log(`   Frontend will show check-in: ${new Date(att.checkInTime.getTime() + (8 * 60 * 60 * 1000)).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\n`);
        });

        console.log('====================================');
        console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('====================================\n');
        console.log(`Summary:`);
        console.log(`- Fixed ${logsFixed} attendance logs`);
        console.log(`- Fixed ${attendancesFixed} attendance records`);
        console.log(`- All times now stored as proper UTC`);
        console.log(`- Frontend will display correct Philippine Time\n`);

    } catch (error) {
        console.error('❌ Error during migration:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the migration
console.log('⚠️  WARNING: This will modify all existing timestamp data!');
console.log('⚠️  Make sure you have a database backup before proceeding.\n');

fixTimezoneData()
    .then(() => {
        console.log('Migration completed. Please verify the data in Prisma Studio.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
