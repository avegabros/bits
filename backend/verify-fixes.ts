import { prisma } from './src/shared/lib/prisma';
import { processAttendanceLogs } from './src/modules/attendance/attendance-processor';
import { toPHTDate } from './src/modules/attendance/attendance-utils';

async function verify() {
    console.log("=== STARTING VERIFICATION OF ATTENDANCE & OVERTIME FIXES ===");

    // 1. Find or create a test employee and shift
    let employee = await prisma.employee.findFirst({
        include: { Shift: true, EmployeeShift: true }
    });

    if (!employee) {
        console.log("Creating test employee and shift...");
        let testShift = await prisma.shift.findFirst();
        if (!testShift) {
            testShift = await prisma.shift.create({
                data: {
                    shiftCode: 'TEST',
                    name: 'Test Shift',
                    startTime: '08:00',
                    endTime: '12:00',
                    graceMinutes: 10,
                    breakMinutes: 0,
                    isActive: true,
                    workDays: JSON.stringify(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
                }
            });
        }

        employee = await prisma.employee.create({
            data: {
                firstName: 'Test',
                lastName: 'User',
                role: 'USER',
                employmentStatus: 'ACTIVE',
                shiftId: testShift.id
            },
            include: { Shift: true, EmployeeShift: true }
        });
    }

    const testShift = employee.Shift || await prisma.shift.findFirst();
    if (!testShift) {
        throw new Error("No shift found or could be created");
    }

    console.log(`Using Employee ID: ${employee.id}, Name: ${employee.firstName} ${employee.lastName}`);
    console.log(`Using Shift ID: ${testShift.id}, Name: ${testShift.name} (${testShift.startTime}-${testShift.endTime})`);

    // Clean up junction tables if needed, and make sure employee is assigned to this shift in EmployeeShift
    let empShift = await prisma.employeeShift.findFirst({
        where: { employeeId: employee.id, shiftId: testShift.id }
    });
    if (!empShift) {
        empShift = await prisma.employeeShift.create({
            data: {
                employeeId: employee.id,
                shiftId: testShift.id,
                sortOrder: 1,
                isPrimary: true
            }
        });
    }

    const testDate = new Date();
    // Midnight in PHT represented as UTC
    const dateOnly = toPHTDate(testDate);

    // ==========================================
    // TEST CASE 1: Late / Out-of-shift Time-in
    // ==========================================
    console.log("\n--- TEST CASE 1: Late / Out-of-shift Time-in ---");

    // Clean up any existing logs/attendance for today
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    await prisma.overtimeRequest.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });

    // Simulate check-in at 13:30 (after shift ends at 12:00)
    const [endH, endM] = testShift.endTime.split(':').map(Number);
    const lateTimestamp = new Date(dateOnly.getTime() + (endH * 60 + endM + 90) * 60 * 1000 - 8 * 60 * 60 * 1000); // 1.5 hours after shift ends

    console.log(`Creating mock biometric log at late timestamp: ${lateTimestamp.toISOString()}`);
    await prisma.attendanceLog.create({
        data: {
            employeeId: employee.id,
            timestamp: lateTimestamp,
            status: 0 // check-in
        }
    });

    console.log("Processing logs...");
    const res1 = await processAttendanceLogs();
    console.log("Process results:", res1);

    const att1 = await prisma.attendance.findFirst({
        where: { employeeId: employee.id, date: dateOnly },
        include: { shift: true }
    });

    if (att1) {
        console.log(`[PASS] Attendance record found! ID: ${att1.id}`);
        console.log(`[PASS] Shift code associated: ${att1.shift?.shiftCode ?? 'NULL'}`);
        if (att1.shiftId === testShift.id) {
            console.log("Success: Correctly resolved shift fallback even though timed in after it ended!");
        } else {
            console.log(`Failure: Resolved shift ID was ${att1.shiftId}, expected ${testShift.id}`);
        }
    } else {
        console.log("Failure: No attendance record created for late time-in!");
    }

    // ==========================================
    // TEST CASE 2: Overtime-only Time-in & Display
    // ==========================================
    console.log("\n--- TEST CASE 2: Overtime-only Time-in ---");

    // Clean up
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    await prisma.overtimeRequest.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });

    // Create an approved Overtime Request
    const otStart = "14:00";
    const otEnd = "15:00";
    console.log(`Creating approved OT request for today: ${otStart} to ${otEnd}`);
    const otRequest = await prisma.overtimeRequest.create({
        data: {
            employeeId: employee.id,
            date: dateOnly,
            startTime: otStart,
            endTime: otEnd,
            reason: 'Test Overtime Work',
            status: 'APPROVED'
        }
    });

    // Simulate OT check-in at 14:00
    const otCheckInTime = new Date(dateOnly.getTime() + (14 * 60) * 60 * 1000);
    console.log(`Creating OT Check-in biometric log at: ${otCheckInTime.toISOString()}`);
    await prisma.attendanceLog.create({
        data: {
            employeeId: employee.id,
            timestamp: otCheckInTime,
            status: 0
        }
    });

    console.log("Processing OT check-in...");
    const res2 = await processAttendanceLogs();
    console.log("Process results:", res2);

    const otUpdated1 = await prisma.overtimeRequest.findUnique({ where: { id: otRequest.id } });
    const att2 = await prisma.attendance.findFirst({ where: { employeeId: employee.id, date: dateOnly } });

    if (otUpdated1?.actualStartTime) {
        console.log(`[PASS] Overtime Request actualStartTime set to: ${otUpdated1.actualStartTime.toISOString()}`);
    } else {
        console.log("Failure: Overtime Request actualStartTime was NOT updated!");
    }

    if (att2) {
        console.log(`[PASS] Attendance record created at check-in! ID: ${att2.id}, CheckInTime: ${att2.checkInTime.toISOString()}, CheckOutTime: ${att2.checkOutTime?.toISOString() ?? 'NULL'}`);
    } else {
        console.log("Failure: No Attendance record created for Overtime Check-in!");
    }

    // Simulate OT check-out at 15:00
    const otCheckOutTime = new Date(dateOnly.getTime() + (15 * 60) * 60 * 1000);
    console.log(`\nCreating OT Check-out biometric log at: ${otCheckOutTime.toISOString()}`);
    await prisma.attendanceLog.create({
        data: {
            employeeId: employee.id,
            timestamp: otCheckOutTime,
            status: 1
        }
    });

    console.log("Processing OT check-out...");
    const res3 = await processAttendanceLogs();
    console.log("Process results:", res3);

    const otUpdated2 = await prisma.overtimeRequest.findUnique({ where: { id: otRequest.id } });
    const att3 = await prisma.attendance.findFirst({ where: { employeeId: employee.id, date: dateOnly } });

    if (otUpdated2?.actualEndTime) {
        console.log(`[PASS] Overtime Request actualEndTime set to: ${otUpdated2.actualEndTime.toISOString()}`);
    } else {
        console.log("Failure: Overtime Request actualEndTime was NOT updated!");
    }

    if (att3) {
        console.log(`[PASS] Attendance record updated! CheckOutTime: ${att3.checkOutTime?.toISOString() ?? 'NULL'}`);
        console.log(`[PASS] Calculated Overtime Minutes: ${att3.overtimeMinutes}`);
        if (att3.overtimeMinutes === 60) {
            console.log("Success: Overtime duration of 60 minutes correctly calculated and saved!");
        } else {
            console.log(`Failure: Overtime Minutes calculated as ${att3.overtimeMinutes}, expected 60`);
        }
    } else {
        console.log("Failure: Attendance record not found at check-out!");
    }

    // Clean up database test records so we leave no trash
    console.log("\nCleaning up test records...");
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    await prisma.overtimeRequest.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    console.log("Cleanup finished.");
}

verify().catch(console.error);
