import { prisma } from '../../shared/lib/prisma';
import { processAttendanceLogs, recalculateAndPersistAttendanceMetrics } from '../../modules/attendance/attendance-processor';
import { toPHTDate } from '../../modules/attendance/attendance-utils';
import { getChronologicalShiftIds } from '../../modules/shifts/shift-ordering.service';

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

// Convert PHT time string (date: YYYY-MM-DD, time: HH:MM) to UTC Date object
function parsePHTToUTC(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00+08:00`);
}

// Simulates HR updating employee shifts (matching employee-crud.controller.ts logic)
async function updateEmployeeShifts(empId: number, shiftIds: number[], todayPHT: Date) {
    // Chronologically sort shift assignments to prevent selection-order bugs
    const sortedShiftIds = await getChronologicalShiftIds(shiftIds || []);

    await prisma.$transaction(async (tx) => {
        // Fetch original assignments
        const originalAssignments = await tx.employeeShift.findMany({
            where: { employeeId: empId },
            select: { shiftId: true }
        });
        const originalShiftIds = originalAssignments.map(a => a.shiftId);
        
        // Also get the current employee legacy shiftId in case assignments were empty
        const originalLegacyShiftId = (await tx.employee.findUnique({
            where: { id: empId },
            select: { shiftId: true }
        }))?.shiftId;
        if (originalLegacyShiftId && !originalShiftIds.includes(originalLegacyShiftId)) {
            originalShiftIds.push(originalLegacyShiftId);
        }

        // Delete existing shift assignments
        await tx.employeeShift.deleteMany({ where: { employeeId: empId } });

        // Create new assignments (if any)
        if (sortedShiftIds.length > 0) {
            await tx.employeeShift.createMany({
                data: sortedShiftIds.map((sid: number, i: number) => ({
                    employeeId: empId,
                    shiftId: sid,
                    sortOrder: i,
                    isPrimary: i === 0
                }))
            });
        }

        // Also update legacy shiftId to the primary shift for backward compatibility
        await tx.employee.update({
            where: { id: empId },
            data: { shiftId: sortedShiftIds[0] || null }
        });

        // Reassignment logic
        const originalChronologicalShiftIds = await getChronologicalShiftIds(originalShiftIds);
        const removedShiftIds = originalChronologicalShiftIds.filter(id => !sortedShiftIds.includes(id));
        const addedShiftIds = sortedShiftIds.filter(id => !originalChronologicalShiftIds.includes(id));

        if (removedShiftIds.length > 0) {
            // Fetch today's open attendance records (check-in only) associated with the removed shifts
            const todayAttendancesToReassign = await tx.attendance.findMany({
                where: {
                    employeeId: empId,
                    date: todayPHT,
                    shiftId: { in: removedShiftIds },
                    checkOutTime: null
                }
            });

            if (todayAttendancesToReassign.length > 0) {
                for (const att of todayAttendancesToReassign) {
                    // Find the index of this old shift in the chronological removed list
                    const oldShiftId = att.shiftId;
                    const removedIdx = oldShiftId !== null ? removedShiftIds.indexOf(oldShiftId) : -1;

                    // Pair it with the added shift at the same index, or default to null
                    let targetShiftId: number | null = null;
                    if (removedIdx !== -1 && removedIdx < addedShiftIds.length) {
                        targetShiftId = addedShiftIds[removedIdx];
                    }

                    if (targetShiftId !== null) {
                        const exists = await tx.attendance.findFirst({
                            where: {
                                employeeId: empId,
                                date: todayPHT,
                                shiftId: targetShiftId
                            }
                        });
                        if (exists) {
                            console.warn(`[TestShiftReassign] Target Shift ID ${targetShiftId} already has an attendance record today. Falling back to No Shift (null) for record ID ${att.id} to prevent unique constraint violation.`);
                            targetShiftId = null;
                        }
                    }

                    await tx.attendance.update({
                        where: { id: att.id },
                        data: {
                            shiftId: targetShiftId,
                            updatedAt: new Date()
                        }
                    });
                }
                
                // Recalculate metrics for the updated records
                await recalculateAndPersistAttendanceMetrics(empId, todayPHT, tx);
            }
        }
    });
}

async function runScenario1(empId: number, dateStr: string, todayPHT: Date, shiftA: number, shiftB: number) {
    console.log(`\n${colors.bright}${colors.cyan}--- SCENARIO 1: SHIFT REPLACEMENT ---${colors.reset}`);
    
    // Clean old records
    await prisma.attendanceLog.deleteMany({ where: { employeeId: empId } });
    await prisma.attendance.deleteMany({ where: { employeeId: empId } });

    // 1. Assign to Shift A
    await prisma.employeeShift.deleteMany({ where: { employeeId: empId } });
    await prisma.employeeShift.create({
        data: { employeeId: empId, shiftId: shiftA, sortOrder: 0, isPrimary: true }
    });
    await prisma.employee.update({
        where: { id: empId },
        data: { shiftId: shiftA }
    });
    console.log(`Initial shift assignment set to Shift A (ID: ${shiftA})`);

    // 2. Punch in
    const checkInTime = parsePHTToUTC(dateStr, '08:00');
    await prisma.attendanceLog.create({
        data: { employeeId: empId, timestamp: checkInTime, status: 0 }
    });
    console.log(`Created raw Check-In log at 08:00 AM PHT`);

    // 3. Process logs
    await processAttendanceLogs();
    
    let att = await prisma.attendance.findFirst({
        where: { employeeId: empId, date: todayPHT }
    });
    if (!att || att.shiftId !== shiftA) {
        throw new Error(`Failed Check-In test: Attendance record not created or shiftId is not ${shiftA}. Found: ${JSON.stringify(att)}`);
    }
    console.log(`Check-In reconciled. Attendance record created under Shift A (shiftId: ${att.shiftId})`);

    // 4. HR replaces Shift A with Shift B
    await updateEmployeeShifts(empId, [shiftB], todayPHT);
    console.log(`HR updated shift assignment to Shift B (ID: ${shiftB})`);

    // 5. Verify reassignment
    att = await prisma.attendance.findFirst({
        where: { employeeId: empId, date: todayPHT }
    });
    if (!att || att.shiftId !== shiftB) {
        throw new Error(`Reassignment failed: Attendance record shiftId is not ${shiftB}. Found: ${JSON.stringify(att)}`);
    }
    console.log(`✅ Success: Attendance record successfully reassigned to Shift B (shiftId: ${att.shiftId})`);

    // 6. Punch out
    const checkOutTime = parsePHTToUTC(dateStr, '17:00');
    await prisma.attendanceLog.create({
        data: { employeeId: empId, timestamp: checkOutTime, status: 0 }
    });
    console.log(`Created raw Check-Out log at 05:00 PM PHT`);

    // 7. Process logs
    await processAttendanceLogs();

    // 8. Verify check-out completed
    att = await prisma.attendance.findFirst({
        where: { employeeId: empId, date: todayPHT }
    });
    if (!att || !att.checkOutTime) {
        throw new Error(`Check-out failed: Attendance record checkOutTime is null. Found: ${JSON.stringify(att)}`);
    }
    console.log(`✅ Success: Attendance record checked out successfully!`);
}

async function runScenario2(empId: number, dateStr: string, todayPHT: Date, shiftA: number, shiftB: number) {
    console.log(`\n${colors.bright}${colors.cyan}--- SCENARIO 2: ADDITIONAL SHIFT ADDED (NO REMOVAL) ---${colors.reset}`);
    
    // Clean old records
    await prisma.attendanceLog.deleteMany({ where: { employeeId: empId } });
    await prisma.attendance.deleteMany({ where: { employeeId: empId } });

    // 1. Assign to Shift A
    await prisma.employeeShift.deleteMany({ where: { employeeId: empId } });
    await prisma.employeeShift.create({
        data: { employeeId: empId, shiftId: shiftA, sortOrder: 0, isPrimary: true }
    });
    await prisma.employee.update({
        where: { id: empId },
        data: { shiftId: shiftA }
    });
    console.log(`Initial shift assignment set to Shift A (ID: ${shiftA})`);

    // 2. Punch in
    const checkInTime = parsePHTToUTC(dateStr, '08:00');
    await prisma.attendanceLog.create({
        data: { employeeId: empId, timestamp: checkInTime, status: 0 }
    });
    console.log(`Created raw Check-In log at 08:00 AM PHT`);

    // 3. Process logs
    await processAttendanceLogs();
    
    let att = await prisma.attendance.findFirst({
        where: { employeeId: empId, date: todayPHT }
    });
    console.log(`Check-In reconciled. Attendance record created under Shift A (shiftId: ${att?.shiftId})`);

    // 4. HR adds Shift B but keeps Shift A
    await updateEmployeeShifts(empId, [shiftA, shiftB], todayPHT);
    console.log(`HR added Shift B (ID: ${shiftB}) to employee shifts list while retaining Shift A (ID: ${shiftA})`);

    // 5. Verify reassignment DID NOT happen
    att = await prisma.attendance.findFirst({
        where: { employeeId: empId, date: todayPHT }
    });
    if (!att || att.shiftId !== shiftA) {
        throw new Error(`Reassignment happened when it shouldn't: Attendance record shiftId is not ${shiftA}. Found: ${JSON.stringify(att)}`);
    }
    console.log(`✅ Success: Attendance record remained associated with original Shift A (shiftId: ${shiftA})`);
}

async function runScenario3(empId: number, dateStr: string, todayPHT: Date, shiftA: number) {
    console.log(`\n${colors.bright}${colors.cyan}--- SCENARIO 3: SHIFT REMOVED WITHOUT REPLACEMENT ---${colors.reset}`);
    
    // Clean old records
    await prisma.attendanceLog.deleteMany({ where: { employeeId: empId } });
    await prisma.attendance.deleteMany({ where: { employeeId: empId } });

    // 1. Assign to Shift A
    await prisma.employeeShift.deleteMany({ where: { employeeId: empId } });
    await prisma.employeeShift.create({
        data: { employeeId: empId, shiftId: shiftA, sortOrder: 0, isPrimary: true }
    });
    await prisma.employee.update({
        where: { id: empId },
        data: { shiftId: shiftA }
    });
    console.log(`Initial shift assignment set to Shift A (ID: ${shiftA})`);

    // 2. Punch in
    const checkInTime = parsePHTToUTC(dateStr, '08:00');
    await prisma.attendanceLog.create({
        data: { employeeId: empId, timestamp: checkInTime, status: 0 }
    });
    console.log(`Created raw Check-In log at 08:00 AM PHT`);

    // 3. Process logs
    await processAttendanceLogs();
    
    let att = await prisma.attendance.findFirst({
        where: { employeeId: empId, date: todayPHT }
    });
    console.log(`Check-In reconciled. Attendance record created under Shift A (shiftId: ${att?.shiftId})`);

    // 4. HR removes all shifts
    await updateEmployeeShifts(empId, [], todayPHT);
    console.log(`HR removed all shift assignments`);

    // 5. Verify reassignment to null (No Shift)
    att = await prisma.attendance.findFirst({
        where: { employeeId: empId, date: todayPHT }
    });
    if (!att || att.shiftId !== null) {
        throw new Error(`Reassignment failed: Attendance record shiftId is not null. Found: ${JSON.stringify(att)}`);
    }
    console.log(`✅ Success: Attendance record successfully moved to No Shift category (shiftId: null)`);

    // 6. Punch out
    const checkOutTime = parsePHTToUTC(dateStr, '17:00');
    await prisma.attendanceLog.create({
        data: { employeeId: empId, timestamp: checkOutTime, status: 0 }
    });
    console.log(`Created raw Check-Out log at 05:00 PM PHT`);

    // 7. Process logs
    await processAttendanceLogs();

    // 8. Verify check-out completed under No Shift
    att = await prisma.attendance.findFirst({
        where: { employeeId: empId, date: todayPHT }
    });
    if (!att || !att.checkOutTime) {
        throw new Error(`Check-out failed: Attendance record checkOutTime is null. Found: ${JSON.stringify(att)}`);
    }
    console.log(`✅ Success: Attendance record checked out successfully under No Shift!`);
}

async function runScenario4(empId: number, dateStr: string, todayPHT: Date, shiftA: number, shiftB: number) {
    console.log(`\n${colors.bright}${colors.cyan}--- SCENARIO 4: COMPLETED RECORD UNTOUCHED ---${colors.reset}`);
    
    // Clean old records
    await prisma.attendanceLog.deleteMany({ where: { employeeId: empId } });
    await prisma.attendance.deleteMany({ where: { employeeId: empId } });

    // 1. Assign to Shift A
    await prisma.employeeShift.deleteMany({ where: { employeeId: empId } });
    await prisma.employeeShift.create({
        data: { employeeId: empId, shiftId: shiftA, sortOrder: 0, isPrimary: true }
    });
    await prisma.employee.update({
        where: { id: empId },
        data: { shiftId: shiftA }
    });
    console.log(`Initial shift assignment set to Shift A (ID: ${shiftA})`);

    // 2. Punch in and check out (Completed Shift)
    const checkInTime = parsePHTToUTC(dateStr, '08:00');
    const checkOutTime = parsePHTToUTC(dateStr, '12:00');
    await prisma.attendanceLog.createMany({
        data: [
            { employeeId: empId, timestamp: checkInTime, status: 0 },
            { employeeId: empId, timestamp: checkOutTime, status: 0 }
        ]
    });
    console.log(`Created Check-In (08:00 AM) and Check-Out (12:00 PM) logs`);

    // 3. Process logs
    await processAttendanceLogs();
    
    let att = await prisma.attendance.findFirst({
        where: { employeeId: empId, date: todayPHT }
    });
    if (!att || !att.checkOutTime) {
        throw new Error(`Failed to set up completed attendance record. Found: ${JSON.stringify(att)}`);
    }
    console.log(`Attendance reconciled. Completed record created under Shift A (shiftId: ${att.shiftId}, hours: ${att.totalHours})`);

    // 4. HR replaces Shift A with Shift B
    await updateEmployeeShifts(empId, [shiftB], todayPHT);
    console.log(`HR replaced Shift A (ID: ${shiftA}) with Shift B (ID: ${shiftB})`);

    // 5. Verify the completed attendance record remained under Shift A
    att = await prisma.attendance.findFirst({
        where: { employeeId: empId, date: todayPHT }
    });
    if (!att || att.shiftId !== shiftA) {
        throw new Error(`Failed: Completed record was reassigned to Shift B when it should have remained on Shift A. Found: ${JSON.stringify(att)}`);
    }
    console.log(`✅ Success: Completed record remained on original Shift A (shiftId: ${shiftA})`);
}

async function runScenario5(empId: number, dateStr: string, todayPHT: Date, shiftA: number, shiftB: number, shiftC: number) {
    console.log(`\n${colors.bright}${colors.cyan}--- SCENARIO 5: MULTI-SHIFT PAIRING & CONSTRAINT SAFETY ---${colors.reset}`);
    
    // Clean old records
    await prisma.attendanceLog.deleteMany({ where: { employeeId: empId } });
    await prisma.attendance.deleteMany({ where: { employeeId: empId } });

    // -------------------------------------------------------------
    // Part 1: Chronological Pairing (Shift A, Shift B -> Shift C, Shift B)
    // -------------------------------------------------------------
    console.log("--- Part 1: Pairing Shift A -> Shift C, keeping Shift B ---");
    await prisma.employeeShift.deleteMany({ where: { employeeId: empId } });
    await prisma.employeeShift.createMany({
        data: [
            { employeeId: empId, shiftId: shiftA, sortOrder: 0, isPrimary: true },
            { employeeId: empId, shiftId: shiftB, sortOrder: 1, isPrimary: false }
        ]
    });
    await prisma.employee.update({
        where: { id: empId },
        data: { shiftId: shiftA }
    });

    // Create an open record on Shift A
    const checkInTimeA = parsePHTToUTC(dateStr, '08:00');
    await prisma.attendanceLog.create({
        data: { employeeId: empId, timestamp: checkInTimeA, status: 0 }
    });
    await processAttendanceLogs();

    let attA = await prisma.attendance.findFirst({ where: { employeeId: empId, date: todayPHT, shiftId: shiftA } });
    if (!attA) throw new Error("Setup failed: Open record on Shift A not created.");
    console.log("Created open attendance record on Shift A");

    // HR replaces [Shift A, Shift B] with [Shift C, Shift B]
    // Shift A is replaced by Shift C, Shift B is kept.
    await updateEmployeeShifts(empId, [shiftC, shiftB], todayPHT);
    console.log(`HR replaced shifts with Shift C (ID: ${shiftC}) and Shift B (ID: ${shiftB})`);

    // Verify Shift A open record is now on Shift C, and no record is on Shift B
    attA = await prisma.attendance.findFirst({ where: { employeeId: empId, date: todayPHT, id: attA.id } });
    if (!attA || attA.shiftId !== shiftC) {
        throw new Error(`Reassignment failed: Open record was not reassigned to Shift C. Found: ${JSON.stringify(attA)}`);
    }
    console.log("✅ Success: Open record on Shift A was chronologically paired and reassigned to Shift C");

    // -------------------------------------------------------------
    // Part 2: Reduction & Constraint Fallback (Shift A, Shift B -> Shift C)
    // -------------------------------------------------------------
    console.log("\n--- Part 2: Reducing two open records to one shift (colliding -> fallback to null) ---");
    await prisma.attendanceLog.deleteMany({ where: { employeeId: empId } });
    await prisma.attendance.deleteMany({ where: { employeeId: empId } });

    await prisma.employeeShift.deleteMany({ where: { employeeId: empId } });
    await prisma.employeeShift.createMany({
        data: [
            { employeeId: empId, shiftId: shiftA, sortOrder: 0, isPrimary: true },
            { employeeId: empId, shiftId: shiftB, sortOrder: 1, isPrimary: false }
        ]
    });
    await prisma.employee.update({
        where: { id: empId },
        data: { shiftId: shiftA }
    });

    // Create open record on Shift A
    await prisma.attendance.create({
        data: { employeeId: empId, date: todayPHT, shiftId: shiftA, checkInTime: parsePHTToUTC(dateStr, '08:00') }
    });
    // Create open record on Shift B
    await prisma.attendance.create({
        data: { employeeId: empId, date: todayPHT, shiftId: shiftB, checkInTime: parsePHTToUTC(dateStr, '14:00') }
    });
    console.log("Created open records on both Shift A and Shift B");

    // HR replaces [Shift A, Shift B] with [Shift C]
    // Shift A (idx 0) -> Shift C (idx 0)
    // Shift B (idx 1) -> null
    await updateEmployeeShifts(empId, [shiftC], todayPHT);
    console.log(`HR replaced shifts with single Shift C (ID: ${shiftC})`);

    const records = await prisma.attendance.findMany({ where: { employeeId: empId, date: todayPHT } });
    if (records.length !== 2) {
        throw new Error(`Expected 2 records, found: ${records.length}`);
    }
    const recordC = records.find(r => r.shiftId === shiftC);
    const recordNull = records.find(r => r.shiftId === null);
    if (!recordC || !recordNull) {
        throw new Error(`Constraint fallback failed. Records found: ${JSON.stringify(records)}`);
    }
    console.log("✅ Success: No unique constraint crash; Shift A moved to Shift C, and Shift B moved to null");

    // -------------------------------------------------------------
    // Part 3: Fallback when target shift already has a record today
    // -------------------------------------------------------------
    console.log("\n--- Part 3: Target shift already has a record today (colliding -> fallback to null) ---");
    await prisma.attendanceLog.deleteMany({ where: { employeeId: empId } });
    await prisma.attendance.deleteMany({ where: { employeeId: empId } });

    await prisma.employeeShift.deleteMany({ where: { employeeId: empId } });
    await prisma.employeeShift.createMany({
        data: [
            { employeeId: empId, shiftId: shiftA, sortOrder: 0, isPrimary: true }
        ]
    });
    await prisma.employee.update({
        where: { id: empId },
        data: { shiftId: shiftA }
    });

    // Create open record on Shift A
    await prisma.attendance.create({
        data: { employeeId: empId, date: todayPHT, shiftId: shiftA, checkInTime: parsePHTToUTC(dateStr, '08:00') }
    });
    // Create an existing record on Shift C
    await prisma.attendance.create({
        data: { employeeId: empId, date: todayPHT, shiftId: shiftC, checkInTime: parsePHTToUTC(dateStr, '14:00'), checkOutTime: parsePHTToUTC(dateStr, '18:00') }
    });
    console.log(`Created open record on Shift A and completed record on Shift C (ID: ${shiftC})`);

    // HR replaces Shift A with Shift C
    // Since Shift C already has a record today, Shift A's open record should fall back to null
    await updateEmployeeShifts(empId, [shiftC], todayPHT);
    console.log(`HR replaced Shift A with Shift C (ID: ${shiftC})`);

    const finalRecords = await prisma.attendance.findMany({ where: { employeeId: empId, date: todayPHT } });
    const originalShiftARecord = finalRecords.find(r => r.checkInTime.toISOString() === parsePHTToUTC(dateStr, '08:00').toISOString());
    if (!originalShiftARecord || originalShiftARecord.shiftId !== null) {
        throw new Error(`Target collision fallback failed. Record: ${JSON.stringify(originalShiftARecord)}`);
    }
    console.log("✅ Success: Shift A's record successfully fell back to No Shift (null) to avoid unique constraint conflict");
}

async function runScenario6(empId: number, dateStr: string, todayPHT: Date) {
    console.log(`\n${colors.bright}${colors.cyan}--- SCENARIO 6: MULTI-SHIFT PUNCH AFTER SHIFT MODIFICATION ---${colors.reset}`);
    
    // Clean old records
    await prisma.attendanceLog.deleteMany({ where: { employeeId: empId } });
    await prisma.attendance.deleteMany({ where: { employeeId: empId } });
    
    // Clean up any stale test shifts from previous failed runs
    await prisma.shift.deleteMany({
        where: {
            name: {
                in: [
                    'Temp Shift 1 (8:30-12)',
                    'Temp Shift 2 (13-17)',
                    'Temp Shift 1.1 (8-12)'
                ]
            }
        }
    });

    // 1. Create temporary shifts for this test
    const shift1 = await prisma.shift.create({
        data: {
            shiftCode: 'TS1',
            name: 'Temp Shift 1 (8:30-12)',
            startTime: '08:30',
            endTime: '12:00',
            graceMinutes: 0,
            breakMinutes: 0,
            isActive: true,
            workDays: JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
        }
    });

    const shift2 = await prisma.shift.create({
        data: {
            shiftCode: 'TS2',
            name: 'Temp Shift 2 (13-17)',
            startTime: '13:00',
            endTime: '17:00',
            graceMinutes: 0,
            breakMinutes: 0,
            isActive: true,
            workDays: JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
        }
    });

    const shift11 = await prisma.shift.create({
        data: {
            shiftCode: 'TS11',
            name: 'Temp Shift 1.1 (8-12)',
            startTime: '08:00',
            endTime: '12:00',
            graceMinutes: 0,
            breakMinutes: 0,
            isActive: true,
            workDays: JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
        }
    });

    try {
        // 2. Assign employee to Shift 1 and Shift 2
        await prisma.employeeShift.createMany({
            data: [
                { employeeId: empId, shiftId: shift1.id, sortOrder: 0, isPrimary: true },
                { employeeId: empId, shiftId: shift2.id, sortOrder: 1, isPrimary: false }
            ]
        });
        await prisma.employee.update({
            where: { id: empId },
            data: { shiftId: shift1.id }
        });
        console.log(`Assigned employee to Shift 1 (08:30-12:00) and Shift 2 (13:00-17:00)`);

        // 3. Create completed record on Shift 1
        const checkInTime1 = parsePHTToUTC(dateStr, '08:30');
        const checkOutTime1 = parsePHTToUTC(dateStr, '12:00');
        await prisma.attendanceLog.createMany({
            data: [
                { employeeId: empId, timestamp: checkInTime1, status: 0 },
                { employeeId: empId, timestamp: checkOutTime1, status: 0 }
            ]
        });
        await processAttendanceLogs();
        console.log("Created completed attendance record on Shift 1");

        // Verify completed record
        let att1 = await prisma.attendance.findFirst({ where: { employeeId: empId, date: todayPHT, shiftId: shift1.id } });
        if (!att1 || !att1.checkOutTime) {
            throw new Error(`Failed to set up completed record on Shift 1. Found: ${JSON.stringify(att1)}`);
        }

        // 4. HR replaces Shift 1 with Shift 1.1 (keeping Shift 2)
        // Employee shifts are now: Shift 1.1 and Shift 2
        await updateEmployeeShifts(empId, [shift11.id, shift2.id], todayPHT);
        console.log("HR replaced Shift 1 with Shift 1.1. Current assignments: Shift 1.1 and Shift 2");

        // Verify completed record remains on Shift 1
        att1 = await prisma.attendance.findFirst({ where: { employeeId: empId, date: todayPHT, shiftId: shift1.id } });
        if (!att1) {
            throw new Error("Completed record was removed or moved from Shift 1!");
        }
        console.log("✅ Verified: Completed record remained on original Shift 1");

        // 5. Punch in at 12:31 PM
        const checkInTime2 = parsePHTToUTC(dateStr, '12:31');
        await prisma.attendanceLog.create({
            data: { employeeId: empId, timestamp: checkInTime2, status: 0 }
        });
        console.log("Created raw punch at 12:31 PM (expected to check in to Shift 2)");

        // 6. Process logs
        await processAttendanceLogs();

        // 7. Verify the punch is assigned to Shift 2 as a check-in
        const att2 = await prisma.attendance.findFirst({
            where: { employeeId: empId, date: todayPHT, shiftId: shift2.id }
        });
        if (!att2) {
            throw new Error("Failed: Punch at 12:31 PM was not matched to Shift 2.");
        }
        console.log("✅ Success: Punch at 12:31 PM was correctly reconciled and matched to Shift 2!");
        console.log(`   Check-In: ${att2.checkInTime.toISOString()} | Shift: Shift 2 (ID: ${shift2.id})`);

    } finally {
        // Cleanup shifts
        await prisma.employeeShift.deleteMany({ where: { employeeId: empId } });
        await prisma.shift.deleteMany({ where: { id: { in: [shift1.id, shift2.id, shift11.id] } } });
    }
}

async function main() {
    console.log('--- STARTING SHIFT REASSIGNMENT TEST SUITE ---');

    // Fetch active shifts dynamically from database to make test seed-independent
    const activeShifts = await prisma.shift.findMany({
        where: { isActive: true },
        orderBy: { startTime: 'asc' },
        take: 3
    });

    if (activeShifts.length < 3) {
        throw new Error(`Test requires at least 3 active shifts in the database. Found: ${activeShifts.length}`);
    }

    const shiftA = activeShifts[0].id;
    const shiftB = activeShifts[1].id;
    const shiftC = activeShifts[2].id;

    console.log(`Selected active shifts: Shift A (ID: ${shiftA}, ${activeShifts[0].startTime}-${activeShifts[0].endTime}), Shift B (ID: ${shiftB}, ${activeShifts[1].startTime}-${activeShifts[1].endTime}), Shift C (ID: ${shiftC}, ${activeShifts[2].startTime}-${activeShifts[2].endTime})`);

    // 1. Create a temporary test employee
    const tempEmp = await prisma.employee.create({
        data: {
            firstName: 'TempShift',
            lastName: 'TestUser',
            email: 'tempshifttest@example.com',
            role: 'USER',
            employmentStatus: 'ACTIVE',
            updatedAt: new Date()
        }
    });
    console.log(`Created temporary test employee ID: ${tempEmp.id}`);

    const dateStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateOnly = toPHTDate(new Date());

    try {
        await runScenario1(tempEmp.id, dateStr, dateOnly, shiftA, shiftB);
        await runScenario2(tempEmp.id, dateStr, dateOnly, shiftA, shiftB);
        await runScenario3(tempEmp.id, dateStr, dateOnly, shiftA);
        await runScenario4(tempEmp.id, dateStr, dateOnly, shiftA, shiftB);
        await runScenario5(tempEmp.id, dateStr, dateOnly, shiftA, shiftB, shiftC);
        await runScenario6(tempEmp.id, dateStr, dateOnly);
        
        console.log(`\n${colors.bright}${colors.green}=== ALL SHIFT REASSIGNMENT SCENARIOS PASSED ===${colors.reset}\n`);
    } catch (error) {
        console.error(`\n${colors.red}❌ Test Suite Failed:${colors.reset}`, error);
    } finally {
        // Cleanup test data
        console.log('Cleaning up test data...');
        await prisma.attendanceLog.deleteMany({ where: { employeeId: tempEmp.id } });
        await prisma.attendance.deleteMany({ where: { employeeId: tempEmp.id } });
        await prisma.employeeShift.deleteMany({ where: { employeeId: tempEmp.id } });
        await prisma.employee.delete({ where: { id: tempEmp.id } });
        console.log('Cleanup complete.');
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
