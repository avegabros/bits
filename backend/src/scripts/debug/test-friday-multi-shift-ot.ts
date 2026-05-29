import { prisma } from '../../shared/lib/prisma';
import { processAttendanceLogs } from '../../modules/attendance/attendance-processor';
import { toPHTDate } from '../../modules/attendance/attendance-utils';

async function testFridayMultiShiftOt() {
    console.log("=== RUNNING SCENARIO: FRIDAY OT (10-12) + FRIDAY SHIFT 2 (13-17) ===");

    // 1. Create a test employee
    let employee = await prisma.employee.findFirst({
        where: { firstName: 'Friday', lastName: 'Tester' }
    });

    if (!employee) {
        employee = await prisma.employee.create({
            data: {
                firstName: 'Friday',
                lastName: 'Tester',
                role: 'USER',
                employmentStatus: 'ACTIVE',
                updatedAt: new Date()
            }
        });
    }

    // 2. Create Shift 1 (8-12, Monday to Thursday - Friday is rest day)
    let shift1 = await prisma.shift.findFirst({ where: { shiftCode: 'TESTSF1' } });
    if (!shift1) {
        shift1 = await prisma.shift.create({
            data: {
                shiftCode: 'TESTSF1',
                name: 'Shift 1 (8-12 Mon-Thu)',
                startTime: '08:00',
                endTime: '12:00',
                graceMinutes: 10,
                breakMinutes: 0,
                isActive: true,
                workDays: JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu'])
            }
        });
    }

    // 3. Create Shift 2 (13-17, Friday to Saturday - Friday is work day)
    let shift2 = await prisma.shift.findFirst({ where: { shiftCode: 'TESTSF2' } });
    if (!shift2) {
        shift2 = await prisma.shift.create({
            data: {
                shiftCode: 'TESTSF2',
                name: 'Shift 2 (13-17 Fri-Sat)',
                startTime: '13:00',
                endTime: '17:00',
                graceMinutes: 10,
                breakMinutes: 0,
                isActive: true,
                workDays: JSON.stringify(['Fri', 'Sat'])
            }
        });
    }

    // Assign employee to both shifts
    await prisma.employeeShift.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employeeShift.createMany({
        data: [
            { employeeId: employee.id, shiftId: shift1.id, sortOrder: 1, isPrimary: false },
            { employeeId: employee.id, shiftId: shift2.id, sortOrder: 2, isPrimary: true }
        ]
    });

    // We will use 2026-05-29 (Friday) as the test date
    const testDate = new Date("2026-05-29T00:00:00Z"); // PHT Friday midnight
    const dateOnly = toPHTDate(testDate);

    // Clean up existing logs / records for this employee on this date
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    await prisma.overtimeRequest.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });

    // 4. Create approved OT request for Friday 10:00 - 12:00
    const otRequest = await prisma.overtimeRequest.create({
        data: {
            employeeId: employee.id,
            date: dateOnly,
            startTime: "10:00",
            endTime: "12:00",
            reason: 'Friday Rest Day OT',
            status: 'APPROVED'
        }
    });

    console.log("1. Simulating OT check-in scan at Friday 10:00 AM...");
    const otCheckInTime = new Date("2026-05-29T10:00:00+08:00");
    await prisma.attendanceLog.create({
        data: {
            employeeId: employee.id,
            timestamp: otCheckInTime,
            status: 0 // check-in
        }
    });

    await processAttendanceLogs();

    console.log("2. Simulating OT check-out scan at Friday 12:00 PM...");
    const otCheckOutTime = new Date("2026-05-29T12:00:00+08:00");
    await prisma.attendanceLog.create({
        data: {
            employeeId: employee.id,
            timestamp: otCheckOutTime,
            status: 1 // check-out
        }
    });

    await processAttendanceLogs();

    console.log("3. Simulating Regular Shift 2 check-in scan at Friday 13:00 PM...");
    const shiftCheckInTime = new Date("2026-05-29T13:00:00+08:00");
    await prisma.attendanceLog.create({
        data: {
            employeeId: employee.id,
            timestamp: shiftCheckInTime,
            status: 0 // check-in
        }
    });

    await processAttendanceLogs();

    // 5. Query and display final results
    const finalAttendance = await prisma.attendance.findMany({
        where: { employeeId: employee.id, date: dateOnly },
        include: { shift: true }
    });

    const updatedOtRequest = await prisma.overtimeRequest.findUnique({
        where: { id: otRequest.id }
    });

    console.log("\n=== FINAL TEST RESULTS ===");
    console.log(`Approved OT Request Actual execution: ${updatedOtRequest?.actualStartTime?.toISOString() ?? 'NULL'} to ${updatedOtRequest?.actualEndTime?.toISOString() ?? 'NULL'}`);
    console.log(`Total Attendance Records Created: ${finalAttendance.length}`);
    finalAttendance.forEach((att, index) => {
        console.log(`[${index + 1}] ID: ${att.id}, ShiftId: ${att.shiftId}, ShiftCode: ${att.shift?.shiftCode ?? 'NULL'}, Name: ${att.shift?.name ?? 'OT-Only'}, Check-in: ${att.checkInTime.toISOString()}, Check-out: ${att.checkOutTime?.toISOString() ?? 'NULL'}, Status: ${att.status}`);
    });

    // Assertions
    const otRecord = finalAttendance.find(att => att.shiftId === null);
    const shiftRecord = finalAttendance.find(att => att.shiftId === shift2.id);

    if (otRecord && shiftRecord) {
        console.log("\n✅ SUCCESS: Both the Rest-Day OT and Regular Shift 2 were cleanly matched and processed without any conflict!");
    } else {
        console.error("\n❌ FAILURE: Records were not matched correctly.");
    }

    // Clean up
    console.log("\nCleaning up database test records...");
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    await prisma.overtimeRequest.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    await prisma.employeeShift.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employee.delete({ where: { id: employee.id } });
    await prisma.shift.delete({ where: { id: shift1.id } });
    await prisma.shift.delete({ where: { id: shift2.id } });
    console.log("Done.");
}

testFridayMultiShiftOt().catch(console.error);
