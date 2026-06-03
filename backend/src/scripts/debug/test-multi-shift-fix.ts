import { prisma } from '../../shared/lib/prisma';
import { processAttendanceLogs } from '../../modules/attendance/attendance-processor';
import { toPHTDate } from '../../modules/attendance/attendance-utils';

async function testMultiShiftFix() {
    console.log("=== RUNNING MULTI-SHIFT BUG REPRODUCTION & VERIFICATION ===");

    // 1. Create a test employee
    let employee = await prisma.employee.findFirst({
        where: { firstName: 'MultiShift', lastName: 'Tester' }
    });

    if (!employee) {
        employee = await prisma.employee.create({
            data: {
                firstName: 'MultiShift',
                lastName: 'Tester',
                role: 'USER',
                employmentStatus: 'ACTIVE',
                updatedAt: new Date()
            }
        });
    }

    // 2. Create Morning Shift (9-12)
    let morningShift = await prisma.shift.findFirst({ where: { shiftCode: 'MSMORN' } });
    if (!morningShift) {
        morningShift = await prisma.shift.create({
            data: {
                shiftCode: 'MSMORN',
                name: 'Morning Shift (9-12)',
                startTime: '09:00',
                endTime: '12:00',
                graceMinutes: 15,
                breakMinutes: 0,
                isActive: true,
                workDays: JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
            }
        });
    }

    // 3. Create Afternoon Shift (14-16)
    let afternoonShift = await prisma.shift.findFirst({ where: { shiftCode: 'MSAFTER' } });
    if (!afternoonShift) {
        afternoonShift = await prisma.shift.create({
            data: {
                shiftCode: 'MSAFTER',
                name: 'Afternoon Shift (14-16)',
                startTime: '14:00',
                endTime: '16:00',
                graceMinutes: 15,
                breakMinutes: 0,
                isActive: true,
                workDays: JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
            }
        });
    }

    // Assign employee to both shifts
    await prisma.employeeShift.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employeeShift.createMany({
        data: [
            { employeeId: employee.id, shiftId: morningShift.id, sortOrder: 1, isPrimary: false },
            { employeeId: employee.id, shiftId: afternoonShift.id, sortOrder: 2, isPrimary: true }
        ]
    });

    // Use current date so cutoff does not filter it out
    const testDate = new Date();
    const dateOnly = toPHTDate(testDate);

    // Clean up existing logs / records for this employee on this date
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });

    console.log("\n--- TEST CASE 1: Single Check-in at 9:12 AM, Single Check-out at 4:00 PM ---");
    
    // Format timestamps for the test date
    const y = testDate.getFullYear();
    const m = String(testDate.getMonth() + 1).padStart(2, '0');
    const d = String(testDate.getDate()).padStart(2, '0');

    const checkInTime = new Date(`${y}-${m}-${d}T09:12:00+08:00`);
    const checkOutTime = new Date(`${y}-${m}-${d}T16:00:00+08:00`);

    console.log(`Simulating check-in scan at 9:12 AM (${checkInTime.toISOString()})...`);
    await prisma.attendanceLog.create({
        data: {
            employeeId: employee.id,
            timestamp: checkInTime,
            status: 0 // check-in
        }
    });
    await processAttendanceLogs();

    console.log(`Simulating check-out scan at 4:00 PM (${checkOutTime.toISOString()})...`);
    await prisma.attendanceLog.create({
        data: {
            employeeId: employee.id,
            timestamp: checkOutTime,
            status: 1 // check-out
        }
    });
    await processAttendanceLogs();

    // Query and check results
    let finalAttendance = await prisma.attendance.findMany({
        where: { employeeId: employee.id, date: dateOnly },
        include: { shift: true }
    });

    console.log(`\nRecords created for Test Case 1: ${finalAttendance.length}`);
    finalAttendance.forEach((att, index) => {
        console.log(`[${index + 1}] ShiftCode: ${att.shift?.shiftCode ?? 'NULL'}, Name: ${att.shift?.name ?? 'NULL'}, Check-in: ${att.checkInTime.toISOString()}, Check-out: ${att.checkOutTime?.toISOString() ?? 'NULL'}, Status: ${att.status}`);
    });

    let success = true;
    const morningRecord = finalAttendance.find(att => att.shiftId === morningShift.id);
    const afternoonRecord = finalAttendance.find(att => att.shiftId === afternoonShift.id);

    if (!morningRecord) {
        console.error("❌ Test Case 1 Failed: Morning shift attendance record was not created!");
        success = false;
    } else if (morningRecord.checkOutTime === null) {
        console.error("❌ Test Case 1 Failed: Morning shift was not checked out by the 4:00 PM scan!");
        success = false;
    } else {
        console.log("✅ Morning Shift checked in and closed successfully!");
    }

    if (afternoonRecord) {
        console.error("❌ Test Case 1 Failed: Afternoon shift record was incorrectly created!");
        success = false;
    } else {
        console.log("✅ Afternoon Shift has no attendance record (correct)!");
    }


    console.log("\n--- TEST CASE 2: Explicit Check-in and Check-out to Both Shifts ---");
    // Clean up for Test Case 2
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });

    // 4 Scans: 9:12 AM, 12:00 PM, 2:00 PM, 4:00 PM
    const sc1_in = new Date(`${y}-${m}-${d}T09:12:00+08:00`);
    const sc1_out = new Date(`${y}-${m}-${d}T12:00:00+08:00`);
    const sc2_in = new Date(`${y}-${m}-${d}T14:00:00+08:00`);
    const sc2_out = new Date(`${y}-${m}-${d}T16:00:00+08:00`);

    console.log("Simulating explicit scans...");
    await prisma.attendanceLog.create({ data: { employeeId: employee.id, timestamp: sc1_in, status: 0 } });
    await processAttendanceLogs();
    
    await prisma.attendanceLog.create({ data: { employeeId: employee.id, timestamp: sc1_out, status: 1 } });
    await processAttendanceLogs();

    await prisma.attendanceLog.create({ data: { employeeId: employee.id, timestamp: sc2_in, status: 0 } });
    await processAttendanceLogs();

    await prisma.attendanceLog.create({ data: { employeeId: employee.id, timestamp: sc2_out, status: 1 } });
    await processAttendanceLogs();

    finalAttendance = await prisma.attendance.findMany({
        where: { employeeId: employee.id, date: dateOnly },
        include: { shift: true }
    });

    console.log(`\nRecords created for Test Case 2: ${finalAttendance.length}`);
    finalAttendance.forEach((att, index) => {
        console.log(`[${index + 1}] ShiftCode: ${att.shift?.shiftCode ?? 'NULL'}, Name: ${att.shift?.name ?? 'NULL'}, Check-in: ${att.checkInTime.toISOString()}, Check-out: ${att.checkOutTime?.toISOString() ?? 'NULL'}, Status: ${att.status}`);
    });

    const mRec = finalAttendance.find(att => att.shiftId === morningShift.id);
    const aRec = finalAttendance.find(att => att.shiftId === afternoonShift.id);

    if (mRec && mRec.checkOutTime && aRec && aRec.checkOutTime) {
        console.log("✅ Test Case 2 Passed: Both shifts successfully registered their own check-in/out records!");
    } else {
        console.error("❌ Test Case 2 Failed: Did not register separate records for both shifts!");
        success = false;
    }

    // Clean up
    console.log("\nCleaning up database test records...");
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    await prisma.employeeShift.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employee.delete({ where: { id: employee.id } });
    await prisma.shift.delete({ where: { id: morningShift.id } });
    await prisma.shift.delete({ where: { id: afternoonShift.id } });
    console.log("Done.");

    if (success) {
        console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! The multi-shift attendance bug is fully fixed and verified!");
    } else {
        console.error("\n❌ SOME TESTS FAILED.");
        process.exit(1);
    }
}

testMultiShiftFix().catch(console.error);
