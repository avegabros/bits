import { prisma } from '../../shared/lib/prisma';
import { processAttendanceLogs } from '../../modules/attendance/attendance-processor';
import { toPHTDate } from '../../modules/attendance/attendance-utils';

async function testRestDayOt() {
    console.log("=== RUNNING REPRODUCTION FOR REST DAY + OT DUPLICATE RECORDS ===");

    // 1. Find or create a test employee
    let employee = await prisma.employee.findFirst({
        where: { firstName: 'RestDay', lastName: 'Tester' },
        include: { Shift: true }
    });

    if (!employee) {
        employee = await prisma.employee.create({
            data: {
                firstName: 'RestDay',
                lastName: 'Tester',
                role: 'USER',
                employmentStatus: 'ACTIVE',
                updatedAt: new Date()
            },
            include: { Shift: true }
        });
    }

    // 2. Create a shift where Thursday (today, 2026-05-28) is a rest day
    // today is Thursday, so we make workDays only include Mon, Tue, Wed
    let restDayShift = await prisma.shift.findFirst({
        where: { shiftCode: 'RESTOT' }
    });

    if (!restDayShift) {
        restDayShift = await prisma.shift.create({
            data: {
                shiftCode: 'RESTOT',
                name: 'Rest Day OT Shift',
                startTime: '08:00',
                endTime: '12:00',
                graceMinutes: 10,
                breakMinutes: 0,
                isActive: true,
                workDays: JSON.stringify(['Mon', 'Tue', 'Wed']) // Thursday is a rest day
            }
        });
    }

    // Assign the employee to the shift via EmployeeShift
    let empShift = await prisma.employeeShift.findFirst({
        where: { employeeId: employee.id, shiftId: restDayShift.id }
    });
    if (!empShift) {
        empShift = await prisma.employeeShift.create({
            data: {
                employeeId: employee.id,
                shiftId: restDayShift.id,
                sortOrder: 1,
                isPrimary: true
            }
        });
    }

    // Also update Employee.shiftId to restDayShift.id
    await prisma.employee.update({
        where: { id: employee.id },
        data: { shiftId: restDayShift.id }
    });

    const testDate = new Date("2026-05-28T00:00:00Z"); // PHT Thursday
    const dateOnly = toPHTDate(testDate);

    // Clean up any existing logs/attendance for this test user on this date
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    await prisma.overtimeRequest.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });

    // 3. Create approved OT request for Thursday 14:00 - 15:00
    const otRequest = await prisma.overtimeRequest.create({
        data: {
            employeeId: employee.id,
            date: dateOnly,
            startTime: "14:00",
            endTime: "15:00",
            reason: 'Rest Day Overtime Work',
            status: 'APPROVED'
        }
    });

    // 4. Simulate check-in at 14:00
    const otCheckInTime = new Date("2026-05-28T14:00:00+08:00");
    await prisma.attendanceLog.create({
        data: {
            employeeId: employee.id,
            timestamp: otCheckInTime,
            status: 0 // check-in
        }
    });

    console.log("Processing OT check-in log...");
    await processAttendanceLogs();

    // 5. Query and display what was created
    const createdAttendance = await prisma.attendance.findMany({
        where: { employeeId: employee.id, date: dateOnly },
        include: { shift: true }
    });

    const updatedOtRequest = await prisma.overtimeRequest.findUnique({
        where: { id: otRequest.id }
    });

    console.log("\n=== RESULTS AFTER CHECK-IN ===");
    console.log(`OT Request actualStartTime: ${updatedOtRequest?.actualStartTime?.toISOString() ?? 'NULL'}`);
    console.log(`Attendance Records Found: ${createdAttendance.length}`);
    createdAttendance.forEach((att, index) => {
        console.log(`[${index + 1}] ID: ${att.id}, ShiftId: ${att.shiftId}, ShiftCode: ${att.shift?.shiftCode ?? 'NULL'}, Check-in: ${att.checkInTime.toISOString()}, Status: ${att.status}, LateMinutes: ${att.lateMinutes}`);
    });

    // Clean up
    console.log("\nCleaning up database test records...");
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    await prisma.overtimeRequest.deleteMany({ where: { employeeId: employee.id, date: dateOnly } });
    await prisma.employeeShift.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employee.delete({ where: { id: employee.id } });
    await prisma.shift.delete({ where: { id: restDayShift.id } });
    console.log("Done.");
}

testRestDayOt().catch(console.error);
