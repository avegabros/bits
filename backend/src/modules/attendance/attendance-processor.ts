import { prisma } from '../../shared/lib/prisma';
import { Shift, Prisma, EmployeeShift, SyncConfig } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import attendanceEmitter from '../../shared/events/attendanceEmitter';
import { audit } from '../../shared/lib/auditLogger';
import { toPHTDate, formatToPhilippineTime, normalizeTime } from './attendance-utils';
import { calculateAttendanceMetrics, calculateAttendanceStatus } from './attendance-calculator';
import { ProcessResult } from './attendance.types';

interface ShiftResolutionContext {
    employeeId: number;
    timestamp: Date;
    normalizedTimestamp: Date;
    dateOnly: Date;
    assignments: (EmployeeShift & { shift: Shift })[];
    filteredAssignments: (EmployeeShift & { shift: Shift })[];
    dayMatchingShifts: (EmployeeShift & { shift: Shift })[];
    recordMap: Map<number | null, { shiftId: number | null; checkOutTime: Date | null }>;
    syncConfig: SyncConfig | null;
    bufferMins: number;
    bufferMs: number;
    currentDayName: string;
    phtTimestamp: Date;
    getWorkDays: (shift: Shift) => string[];
}

async function loadShiftContext(
    employeeId: number,
    timestamp: Date,
    dateOnly: Date,
    assignments: (EmployeeShift & { shift: Shift })[]
): Promise<ShiftResolutionContext> {
    const normalizedTimestamp = normalizeTime(timestamp);

    const records = await prisma.attendance.findMany({
        where: { employeeId, date: dateOnly },
        select: { shiftId: true, checkOutTime: true }
    });

    const recordMap = new Map(records.map(r => [r.shiftId, r]));

    // Find the maximum sortOrder of any assigned shift that has a record on this date.
    // If multiple shifts have records, we should only allow matching to shifts with sortOrder >= maxWorkedSortOrder.
    // This prevents subsequent punches from erroneously matching earlier, missed shifts.
    let maxWorkedSortOrder = -1;
    for (const assignment of assignments) {
        if (recordMap.has(assignment.shift.id)) {
            if (assignment.sortOrder > maxWorkedSortOrder) {
                maxWorkedSortOrder = assignment.sortOrder;
            }
        }
    }

    const filteredAssignments = maxWorkedSortOrder >= 0
        ? assignments.filter(a => a.sortOrder >= maxWorkedSortOrder)
        : assignments;

    const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
    const bufferMins = syncConfig?.shiftBufferMinutes ?? 120;
    const bufferMs = bufferMins * 60 * 1000;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const phtTimestamp = new Date(normalizedTimestamp.getTime() + 8 * 60 * 60 * 1000);
    const currentDayName = dayNames[phtTimestamp.getUTCDay()];

    const getWorkDays = (shift: Shift): string[] => {
        try { return JSON.parse(shift.workDays || '[]'); } catch { return []; }
    };

    const dayMatchingShifts = filteredAssignments.filter(a => {
        const workDays = getWorkDays(a.shift);
        return workDays.includes(currentDayName);
    });

    return {
        employeeId,
        timestamp,
        normalizedTimestamp,
        dateOnly,
        assignments,
        filteredAssignments,
        dayMatchingShifts,
        recordMap,
        syncConfig,
        bufferMins,
        bufferMs,
        currentDayName,
        phtTimestamp,
        getWorkDays
    };
}

function tryMatch(
    ctx: ShiftResolutionContext,
    candidateShifts: (EmployeeShift & { shift: Shift })[],
    allowFallback = true
): { shift: Shift; isNewCheckin: boolean } | null {
    const { recordMap, dateOnly, bufferMs, normalizedTimestamp } = ctx;

    const windowMatches: { shift: Shift; needsCheckIn: boolean; needsCheckOut: boolean; distToStart: number; distToEnd: number }[] = [];
    let fallbackMatch: Shift | null = null;
    let fallbackIsNew = true;
    let fallbackMinDist = Infinity;

    for (const { shift } of candidateShifts) {
        const record = recordMap.get(shift.id);
        const needsCheckIn = !record;
        const needsCheckOut = record && !record.checkOutTime;
        const isCompleted = record && record.checkOutTime;

        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);

        const shiftStart = new Date(dateOnly.getTime() + (startH * 60 + startM) * 60 * 1000);
        const shiftEnd = new Date(dateOnly.getTime() + (endH * 60 + endM) * 60 * 1000);

        if (shiftEnd <= shiftStart) {
            shiftEnd.setTime(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
        }

        const windowStart = new Date(shiftStart.getTime() - bufferMs);
        const windowEnd = new Date(shiftEnd.getTime() + bufferMs);

        const distToStart = Math.abs(normalizedTimestamp.getTime() - shiftStart.getTime());
        const distToEnd = Math.abs(normalizedTimestamp.getTime() - shiftEnd.getTime());

        if (!isCompleted && normalizedTimestamp >= windowStart && normalizedTimestamp <= windowEnd) {
            if (needsCheckOut) {
                windowMatches.push({ shift, needsCheckIn: false, needsCheckOut: true, distToStart, distToEnd });
            } else if (needsCheckIn && normalizedTimestamp <= shiftEnd) {
                windowMatches.push({ shift, needsCheckIn: true, needsCheckOut: false, distToStart, distToEnd });
            }
        }

        const minDist = Math.min(distToStart, distToEnd);
        const isEligibleFallback = needsCheckOut || (needsCheckIn && normalizedTimestamp <= shiftEnd);
        if (isEligibleFallback && minDist < fallbackMinDist) {
            fallbackMinDist = minDist;
            fallbackMatch = shift;
            fallbackIsNew = needsCheckIn;
        }
    }

    if (windowMatches.length > 0) {
        const checkouts = windowMatches.filter(m => m.needsCheckOut);
        if (checkouts.length > 0) {
            checkouts.sort((a, b) => a.distToEnd - b.distToEnd);
            return { shift: checkouts[0].shift, isNewCheckin: false };
        }

        const checkins = windowMatches.filter(m => m.needsCheckIn);
        if (checkins.length > 0) {
            checkins.sort((a, b) => a.distToStart - b.distToStart);
            return { shift: checkins[0].shift, isNewCheckin: true };
        }
    }

    if (allowFallback && fallbackMatch) {
        return { shift: fallbackMatch, isNewCheckin: fallbackIsNew };
    }
    return null;
}

async function tryCloseOpenRecord(
    ctx: ShiftResolutionContext
): Promise<{ shift: Shift; isNewCheckin: boolean } | null> {
    const {
        employeeId,
        dateOnly,
        normalizedTimestamp,
        filteredAssignments,
        recordMap,
        syncConfig,
        dayMatchingShifts,
        bufferMs
    } = ctx;

    const shiftsNeedingCheckout = filteredAssignments.filter(a => {
        const record = recordMap.get(a.shift.id);
        return record && !record.checkOutTime;
    });

    if (shiftsNeedingCheckout.length === 0) {
        return null;
    }

    // Tier 1: Window-Only Match in Shifts Needing Checkout
    const match = tryMatch(ctx, shiftsNeedingCheckout, false);
    if (match) return match;

    // ── Tier 1.5: CLOSE-BEFORE-OPEN RULE ─────────────────────────────
    // Fetch the actual check-in times for the open records
    const openRecords = await prisma.attendance.findMany({
        where: {
            employeeId,
            date: dateOnly,
            checkOutTime: null,
            shiftId: { in: shiftsNeedingCheckout.map(a => a.shift.id) }
        },
        orderBy: { checkInTime: 'asc' }
    });

    const minCheckoutMins = syncConfig?.globalMinCheckoutMinutes ?? 120;

    for (const openRecord of openRecords) {
        const shiftAssignment = shiftsNeedingCheckout.find(
            a => a.shift.id === openRecord.shiftId
        );
        if (!shiftAssignment) continue;

        const checkInTime = new Date(openRecord.checkInTime);
        const diffMs = normalizedTimestamp.getTime() - checkInTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Calculate effective min checkout for this shift
        const shift = shiftAssignment.shift;
        const [sH, sM] = shift.startTime.split(':').map(Number);
        const [eH, eM] = shift.endTime.split(':').map(Number);
        let shiftDurationHours = (eH + eM / 60) - (sH + sM / 60);
        if (shiftDurationHours < 0) shiftDurationHours += 24;
        const effectiveMinCheckout = Math.min(
            shiftDurationHours / 2,
            minCheckoutMins / 60
        );

        if (diffHours >= effectiveMinCheckout) {
            // ── CLOSE-FIRST RULE ─────────────────────────────────────────────
            // If an employee has an open (unclosed) shift and enough time has
            // passed since check-in, always close it. This is predictable and
            // avoids buffer-window-based guessing about whether the punch
            // belongs to a later shift.  Employees who genuinely need to start
            // a new shift without checking out of the previous one should use
            // a manual adjustment.
            // ── END CLOSE-FIRST RULE ─────────────────────────────────────────
            return { shift: shift, isNewCheckin: false };
        }
    }

    return null;
}

async function tryOtRestDayGate(
    ctx: ShiftResolutionContext
): Promise<{ shift: Shift | null; isNewCheckin: boolean } | null> {
    const {
        employeeId,
        dateOnly,
        phtTimestamp,
        bufferMins,
        bufferMs,
        normalizedTimestamp,
        dayMatchingShifts,
        filteredAssignments,
        currentDayName,
        getWorkDays
    } = ctx;

    const approvedOts = await prisma.overtimeRequest.findMany({
        where: {
            employeeId,
            date: dateOnly,
            status: 'APPROVED'
        }
    });

    if (approvedOts.length === 0) {
        return null;
    }

    const phtScanMin = phtTimestamp.getUTCHours() * 60 + phtTimestamp.getUTCMinutes();
    const matchingOt = approvedOts.find(ot => {
        const [sH, sM] = ot.startTime.split(':').map(Number);
        const otStartMin = sH * 60 + sM;
        const diff = Math.abs(phtScanMin - otStartMin);
        const dist = Math.min(diff, 1440 - diff);
        return dist <= bufferMins;
    });

    if (!matchingOt) {
        return null;
    }

    let insideScheduledWindow = false;
    for (const { shift } of dayMatchingShifts) {
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);

        const shiftStart = new Date(dateOnly.getTime() + (startH * 60 + startM) * 60 * 1000);
        const shiftEnd = new Date(dateOnly.getTime() + (endH * 60 + endM) * 60 * 1000);

        if (shiftEnd <= shiftStart) {
            shiftEnd.setTime(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
        }

        const windowStart = new Date(shiftStart.getTime() - bufferMs);
        const windowEnd = new Date(shiftEnd.getTime() + bufferMs);

        if (normalizedTimestamp >= windowStart && normalizedTimestamp <= windowEnd) {
            insideScheduledWindow = true;
            break;
        }
    }

    // If the scan matches an approved OT and is completely outside the buffer window
    // of all regular scheduled shifts for the day, route it directly to rest-day OT!
    if (!insideScheduledWindow) {
        const restDayShifts = filteredAssignments.filter(a => {
            const workDays = getWorkDays(a.shift);
            return !workDays.includes(currentDayName);
        });

        for (const { shift } of restDayShifts) {
            const [startH, startM] = shift.startTime.split(':').map(Number);
            const [endH, endM] = shift.endTime.split(':').map(Number);

            const shiftStart = new Date(dateOnly.getTime() + (startH * 60 + startM) * 60 * 1000);
            const shiftEnd = new Date(dateOnly.getTime() + (endH * 60 + endM) * 60 * 1000);

            if (shiftEnd <= shiftStart) {
                shiftEnd.setTime(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
            }

            const windowStart = new Date(shiftStart.getTime() - bufferMs);
            const windowEnd = new Date(shiftEnd.getTime() + bufferMs);

            if (normalizedTimestamp >= windowStart && normalizedTimestamp <= windowEnd) {
                return { shift, isNewCheckin: true };
            }
        }

        // If no assigned rest-day shift matches the time, treat as OT-only (null shift)
        return { shift: null, isNewCheckin: true };
    }

    return null;
}

function findBestShiftForNewCheckin(
    ctx: ShiftResolutionContext
): { shift: Shift | null; isNewCheckin: boolean } | null {
    const {
        dayMatchingShifts,
        filteredAssignments,
        recordMap,
        dateOnly,
        normalizedTimestamp
    } = ctx;

    // Tier 2: Window-Only Match in Day-Matching (Scheduled) Shifts
    if (dayMatchingShifts.length > 0) {
        const match = tryMatch(ctx, dayMatchingShifts, false);
        if (match) return match;
    }

    // Tier 3: Window-Only Match in All assigned shifts (including rest-day shifts)
    const windowMatchAll = tryMatch(ctx, filteredAssignments, false);
    if (windowMatchAll) return windowMatchAll;

    // Tier 4: Fallback Match in Shifts Needing Checkout
    const shiftsNeedingCheckout = filteredAssignments.filter(a => {
        const record = recordMap.get(a.shift.id);
        return record && !record.checkOutTime;
    });
    if (shiftsNeedingCheckout.length > 0) {
        const match = tryMatch(ctx, shiftsNeedingCheckout, true);
        if (match) return match;
    }

    // Tier 5: Fallback Match in Day-Matching (Scheduled) Shifts
    if (dayMatchingShifts.length > 0) {
        const match = tryMatch(ctx, dayMatchingShifts, true);
        if (match) return match;
    }

    // Tier 6: Fallback Match in All Assigned Shifts
    const match = tryMatch(ctx, filteredAssignments, true);
    if (match) return match;
    // ── END MULTI-TIER SEQUENCE ──────────────────────────────────────────────

    // Ultimate fallback: closest shift by absolute time distance
    let bestMatch: Shift | null = null;
    let minDistance = Infinity;
    const candidates = dayMatchingShifts.length > 0 ? dayMatchingShifts : filteredAssignments;
    for (const { shift } of candidates) {
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);

        const shiftStart = new Date(dateOnly.getTime() + (startH * 60 + startM) * 60 * 1000);
        const shiftEnd = new Date(dateOnly.getTime() + (endH * 60 + endM) * 60 * 1000);

        if (shiftEnd <= shiftStart) {
            shiftEnd.setTime(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
        }

        const distStart = Math.abs(normalizedTimestamp.getTime() - shiftStart.getTime());
        const distEnd = Math.abs(normalizedTimestamp.getTime() - shiftEnd.getTime());
        const minDist = Math.min(distStart, distEnd);

        if (minDist < minDistance) {
            minDistance = minDist;
            bestMatch = shift;
        }
    }

    if (bestMatch) {
        return { shift: bestMatch, isNewCheckin: true };
    }
    return null;
}

export async function resolveShiftForTimestamp(
    employeeId: number,
    timestamp: Date,
    dateOnly: Date,
    fallbackEmployeeShift?: Shift | null
): Promise<{ shift: Shift | null; isNewCheckin: boolean }> {
    const assignments = await prisma.employeeShift.findMany({
        where: { employeeId },
        include: { shift: true },
        orderBy: { sortOrder: 'asc' }
    });

    // 1. Legacy fallback (no EmployeeShift assignments)
    if (assignments.length === 0) {
        let legacyShift = fallbackEmployeeShift;
        if (!legacyShift) {
            const emp = await prisma.employee.findUnique({
                where: { id: employeeId },
                include: { Shift: true }
            });
            legacyShift = emp?.Shift;
        }
        return { shift: legacyShift ?? null, isNewCheckin: true };
    }

    // 2. Build shared context
    const ctx = await loadShiftContext(employeeId, timestamp, dateOnly, assignments);

    // 3. Priority 1: Close an open record
    const closeResult = await tryCloseOpenRecord(ctx);
    if (closeResult) return closeResult;

    // 4. Priority 2: OT rest-day gate
    const otResult = await tryOtRestDayGate(ctx);
    if (otResult) return otResult;

    // 5. Priority 3: Find best shift for new check-in
    const newCheckinResult = findBestShiftForNewCheckin(ctx);
    if (newCheckinResult) return newCheckinResult;

    // 6. No match
    return { shift: null, isNewCheckin: true };
}

/**
 * Recalculates and persists attendance metrics for all records belonging to a
 * specific employee on a specific date. Call this after any write operation
 * (check-in, check-out, manual edit, adjustment approval) to keep the stored
 * metrics in sync with the actual check-in/check-out times.
 *
 * Uses the shift linked to each attendance record — NOT the employee's current
 * shift — so historical metrics are always locked to the original shift context.
 */
export async function recalculateAndPersistAttendanceMetrics(
    employeeId: number,
    date: Date,
    tx?: Prisma.TransactionClient
): Promise<void> {
    const client = tx ?? prisma;

    const getPhtDateStr = (d: Date): string => {
        const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
        return pht.toISOString().slice(0, 10);
    };

    const records = await client.attendance.findMany({
        where: { employeeId, date },
        include: { shift: true }
    });

    if (records.length === 0) return;

    const employee = await client.employee.findUnique({
        where: { id: employeeId },
        select: { branchId: true }
    });

    const holiday = await client.holiday.findFirst({
        where: { date },
        include: { branches: true }
    });

    const isHoliday = (() => {
        if (!holiday) return false;
        if (holiday.branches.length === 0) return true;
        const empBranchId = employee?.branchId;
        if (!empBranchId) return false;
        return holiday.branches.some(b => b.branchId === empBranchId);
    })();

    // Build date representations for OT lookup (raw + UTC midnight)
    const phtDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const utcMidnight = new Date(Date.UTC(phtDate.getUTCFullYear(), phtDate.getUTCMonth(), phtDate.getUTCDate()));

    const approvedOts = await client.overtimeRequest.findMany({
        where: {
            employeeId,
            date: { in: [date, utcMidnight] },
            status: 'APPROVED'
        },
        select: {
            id: true,
            startTime: true,
            endTime: true,
            actualStartTime: true,
            actualEndTime: true
        }
    });

    // OT de-duplication: only the latest check-in record per day receives OTs
    // to prevent double-counting when an employee has multiple shifts on one day.
    const latestRecord = records.reduce<typeof records[number] | null>((latest, r) => {
        if (!r.checkInTime) return latest;
        if (!latest || !latest.checkInTime) return r;
        return new Date(r.checkInTime).getTime() > new Date(latest.checkInTime).getTime() ? r : latest;
    }, null);

    for (const record of records) {
        const isLatestForDay = latestRecord?.id === record.id;
        const otsForRecord = isLatestForDay ? approvedOts : [];

        const metrics = calculateAttendanceMetrics(
            { date: record.date, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime, status: record.status, isHoliday },
            record.shift,
            otsForRecord
        );

        await client.attendance.update({
            where: { id: record.id },
            data: {
                lateMinutes: metrics.lateMinutes,
                undertimeMinutes: metrics.undertimeMinutes,
                overtimeMinutes: metrics.overtimeMinutes,
                totalHours: metrics.totalHours,
                isAnomaly: metrics.isAnomaly,
                isEarlyOut: metrics.isEarlyOut,
                gracePeriodApplied: metrics.gracePeriodApplied,
            }
        });
    }
}

let isProcessingAttendanceLogs = false;

export const processAttendanceLogs = async (): Promise<ProcessResult> => {
    if (isProcessingAttendanceLogs) {
        console.log('[AttendanceProcessor] Already processing logs, skipping concurrent run.');
        return { success: true, processed: 0, created: 0, updated: 0 };
    }
    isProcessingAttendanceLogs = true;
    try {
        return await runProcessAttendanceLogs();
    } finally {
        isProcessingAttendanceLogs = false;
    }
};

const runProcessAttendanceLogs = async (): Promise<ProcessResult> => {
    const pendingAudits = new Map<string, any>();
    const auditPromises: Promise<void>[] = [];
    const originalRecords = new Map<string, any>();
    const originalOts = new Map<string, any>();
    try {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Pre-processing step: Retrieve all currently unprocessed logs to identify which employees
        // and dates require chronological re-processing.
        const unprocessedLogs = await prisma.attendanceLog.findMany({
            where: { 
                timestamp: { gte: cutoff },
                processedAt: null
            },
            select: { employeeId: true, timestamp: true }
        });

        if (unprocessedLogs.length > 0) {
            const reprocessKeys = new Set<string>();
            const reprocessPairs: { employeeId: number; date: Date }[] = [];

            unprocessedLogs.forEach(log => {
                const d1 = toPHTDate(log.timestamp);
                const d2 = new Date(d1.getTime() - 24 * 60 * 60 * 1000);

                [d1, d2].forEach(d => {
                    const key = `${log.employeeId}_${d.getTime()}`;
                    if (!reprocessKeys.has(key)) {
                        reprocessKeys.add(key);
                        reprocessPairs.push({ employeeId: log.employeeId, date: d });
                    }
                });
            });

            for (const { employeeId, date } of reprocessPairs) {
                const existingRecords = await prisma.attendance.findMany({
                    where: { employeeId, date }
                });

                let hasManualOrAdjustments = false;
                for (const rec of existingRecords) {
                    if (rec.checkoutSource === 'manual') {
                        hasManualOrAdjustments = true;
                        break;
                    }
                    const adjustmentsCount = await prisma.attendanceAdjustment.count({
                        where: {
                            attendanceId: rec.id,
                            status: { in: ['pending', 'approved'] }
                        }
                    });
                    if (adjustmentsCount > 0) {
                        hasManualOrAdjustments = true;
                        break;
                    }
                }

                if (!hasManualOrAdjustments) {
                    // Capture original records before deletion/clearing
                    for (const rec of existingRecords) {
                        const key = `${employeeId}_${date.getTime()}_${rec.shiftId}`;
                        originalRecords.set(key, rec);
                    }

                    const existingOts = await prisma.overtimeRequest.findMany({
                        where: {
                            employeeId,
                            date,
                            status: 'APPROVED'
                        }
                    });
                    for (const ot of existingOts) {
                        const key = `${employeeId}_${date.getTime()}_${ot.id}`;
                        originalOts.set(key, ot);
                    }

                    const startRange = date;
                    const endRange = new Date(date.getTime() + 32 * 60 * 60 * 1000);

                    // Reset processedAt = null for all raw logs of this employee in this target date range
                    await prisma.attendanceLog.updateMany({
                        where: {
                            employeeId,
                            timestamp: { gte: startRange, lt: endRange }
                        },
                        data: { processedAt: null }
                    });

                    // Clear the actual times on any approved OvertimeRequest for this employee and date
                    await prisma.overtimeRequest.updateMany({
                        where: {
                            employeeId,
                            date,
                            status: 'APPROVED'
                        },
                        data: {
                            actualStartTime: null,
                            actualEndTime: null
                        }
                    });

                    // Delete the pure device-based Attendance records
                    if (existingRecords.length > 0) {
                        await prisma.attendance.deleteMany({
                            where: { employeeId, date }
                        });
                    }
                }
            }
        }

        const logs = await prisma.attendanceLog.findMany({
            where: { 
                timestamp: { gte: cutoff },
                processedAt: null
            },
            orderBy: { timestamp: 'asc' },
            include: { employee: { include: { Shift: true } } }
        });

        const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
        const minCheckoutMins = syncConfig?.globalMinCheckoutMinutes ?? 120;
        const minCheckoutHours = minCheckoutMins / 60;
        const bufferMins = syncConfig?.shiftBufferMinutes ?? 120;

        const employeeIds = [...new Set(logs.map(l => l.employeeId))];
        
        const dateValues = new Set<number>();
        logs.forEach(l => {
            const dateOnly = toPHTDate(l.timestamp);
            dateValues.add(dateOnly.getTime());
            
            const phtDate = new Date(dateOnly.getTime() + 8 * 60 * 60 * 1000);
            const utcMidnight = new Date(Date.UTC(phtDate.getUTCFullYear(), phtDate.getUTCMonth(), phtDate.getUTCDate()));
            dateValues.add(utcMidnight.getTime());

            // Add previous day for night-shifts and crossing-midnight OTs
            const prevDate = new Date(dateOnly.getTime() - 24 * 60 * 60 * 1000);
            dateValues.add(prevDate.getTime());
            
            const prevPhtDate = new Date(prevDate.getTime() + 8 * 60 * 60 * 1000);
            const prevUtcMidnight = new Date(Date.UTC(prevPhtDate.getUTCFullYear(), prevPhtDate.getUTCMonth(), prevPhtDate.getUTCDate()));
            dateValues.add(prevUtcMidnight.getTime());
        });
        const queryDates = Array.from(dateValues).map(ms => new Date(ms));

        const approvedOts = await prisma.overtimeRequest.findMany({
            where: {
                employeeId: { in: employeeIds },
                date: { in: queryDates },
                status: 'APPROVED'
            },
            select: { id: true, employeeId: true, date: true, startTime: true, endTime: true, actualStartTime: true, actualEndTime: true }
        });

        const getPhtDateStr = (d: Date) => {
            const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
            return pht.toISOString().slice(0, 10);
        };

        const otsByEmpAndDate = new Map<string, typeof approvedOts>();
        for (const ot of approvedOts) {
            const key = `${ot.employeeId}_${getPhtDateStr(ot.date)}`;
            const list = otsByEmpAndDate.get(key) || [];
            list.push(ot);
            otsByEmpAndDate.set(key, list);
        }

        const holidays = await prisma.holiday.findMany({
            where: {
                date: { in: queryDates }
            },
            include: { branches: true }
        });

        let created = 0;
        let updated = 0;

        for (const log of logs) {
            const dateOnly = toPHTDate(log.timestamp);

            // ── NIGHT SHIFT / OVERTIME RESOLUTION ─────────────────────────────────────
            // Determine if this punch belongs to a night shift or crossing-midnight OT
            // starting on the previous day.
            let targetDate = dateOnly;
            const prevDate = new Date(dateOnly.getTime() - 24 * 60 * 60 * 1000);

            // Fetch any open attendance record from the previous day
            const openPrevAttendance = await prisma.attendance.findFirst({
                where: {
                    employeeId: log.employeeId,
                    date: prevDate,
                    checkOutTime: null
                },
                include: {
                    shift: true
                }
            });

            let matchedPrev = false;

            if (openPrevAttendance && openPrevAttendance.shift) {
                const shift = openPrevAttendance.shift;
                // Night session condition: shift.isNightShift === true OR startTime > endTime
                const [sH, sM] = shift.startTime.split(':').map(Number);
                const [eH, eM] = shift.endTime.split(':').map(Number);
                const isNightSession = shift.isNightShift || (sH * 60 + sM > eH * 60 + eM);

                if (isNightSession) {
                    // Check if current log timestamp is within the check-out window of the previous day's shift
                    let expectedEnd = new Date(prevDate.getTime() + (eH * 60 + eM) * 60 * 1000);
                    if (eH * 60 + eM <= sH * 60 + sM) {
                        expectedEnd.setTime(expectedEnd.getTime() + 24 * 60 * 60 * 1000);
                    }

                    const shiftBufferMins = syncConfig?.shiftBufferMinutes ?? 120;
                    const nightShiftBufferMins = syncConfig?.nightShiftBufferMinutes ?? 120;

                    const windowStart = new Date(expectedEnd.getTime() - shiftBufferMins * 60 * 1000);
                    const windowEnd = new Date(expectedEnd.getTime() + nightShiftBufferMins * 60 * 1000);

                    if (log.timestamp >= windowStart && log.timestamp <= windowEnd) {
                        targetDate = prevDate;
                        matchedPrev = true;
                    }
                }
            }

            // If we haven't matched a previous day's shift, check for a crossing-midnight OT starting on the previous day
            if (!matchedPrev) {
                const openPrevOt = await prisma.overtimeRequest.findFirst({
                    where: {
                        employeeId: log.employeeId,
                        date: prevDate,
                        status: 'APPROVED',
                        actualStartTime: { not: null },
                        actualEndTime: null
                    }
                });

                if (openPrevOt) {
                    const [sH, sM] = openPrevOt.startTime.split(':').map(Number);
                    const [eH, eM] = openPrevOt.endTime.split(':').map(Number);
                    const isOtPastMidnight = (sH * 60 + sM > eH * 60 + eM);

                    if (isOtPastMidnight) {
                        // Check if current log timestamp is within the check-out window of this OT
                        const expectedEnd = new Date(prevDate.getTime() + (eH * 60 + eM) * 60 * 1000);
                        expectedEnd.setTime(expectedEnd.getTime() + 24 * 60 * 60 * 1000);

                        const shiftBufferMins = syncConfig?.shiftBufferMinutes ?? 120;
                        const nightShiftBufferMins = syncConfig?.nightShiftBufferMinutes ?? 120;

                        const windowStart = new Date(expectedEnd.getTime() - shiftBufferMins * 60 * 1000);
                        const windowEnd = new Date(expectedEnd.getTime() + nightShiftBufferMins * 60 * 1000);

                        if (log.timestamp >= windowStart && log.timestamp <= windowEnd) {
                            targetDate = prevDate;
                        }
                    }
                }
            }
            // ─────────────────────────────────────────────────────────────────────────

            const dateKey = `${log.employeeId}_${getPhtDateStr(targetDate)}`;
            const recordOts = otsByEmpAndDate.get(dateKey) || [];

            const { shift: resolvedShift } = await resolveShiftForTimestamp(
                log.employeeId, 
                log.timestamp, 
                targetDate, 
                log.employee?.Shift
            );

            // ── REST DAY & HOLIDAY DETECTION ──────────────────────────────────────────
            // If the resolved shift exists but today is a Rest Day or Holiday, the employee
            // has no scheduled shift — any work is treated like a Rest Day.
            // We therefore treat the shift as null ("effectiveShift") so that:
            //  • Attendance records get shiftId: null (OT-only, no shift-based metrics).
            //  • The unique constraint (employeeId, date, shiftId) prevents duplicates.
            //  • lateMinutes / undertimeMinutes are not calculated.
            // resolvedShift is kept for the post-shift guard which needs the raw shift.
            const isHoliday = (() => {
                const dayMs = targetDate.getTime();
                const matchedHoliday = holidays.find(h => toPHTDate(h.date).getTime() === dayMs);
                if (!matchedHoliday) return false;
                if (matchedHoliday.branches.length === 0) return true;
                const empBranchId = log.employee?.branchId;
                if (!empBranchId) return false;
                return matchedHoliday.branches.some(b => b.branchId === empBranchId);
            })();

            const isRestDay = (() => {
                if (!resolvedShift) return false;
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const phtTs = new Date(log.timestamp.getTime() + 8 * 60 * 60 * 1000);
                const todayName = dayNames[phtTs.getUTCDay()];
                try {
                    const workDays: string[] = JSON.parse(resolvedShift.workDays || '[]');
                    return workDays.length > 0 && !workDays.includes(todayName);
                } catch {
                    return false;
                }
            })();
            let effectiveShift = (isRestDay || isHoliday) ? null : resolvedShift;
            // ── END REST DAY & HOLIDAY DETECTION ──────────────────────────────────────

            // ── UNIFIED OVERTIME LOGIC GATE ──────────────────────────────────────────
            if (recordOts.length > 0) {
                const phtScanMin = (() => {
                    const pht = new Date(log.timestamp.getTime() + 8 * 60 * 60 * 1000);
                    return pht.getUTCHours() * 60 + pht.getUTCMinutes();
                })();

                // Determine targetShiftId: if the shift has already ended and the employee didn't check in to it,
                // link the OT to null (OT-only) instead of the ended shift.
                let targetShiftId: number | null = effectiveShift?.id ?? null;
                if (effectiveShift) {
                    const [eH, eM] = effectiveShift.endTime.split(':').map(Number);
                    const shiftEndMs = dateOnly.getTime() + (eH * 60 + eM) * 60 * 1000;
                    const [sH, sM] = effectiveShift.startTime.split(':').map(Number);
                    const shiftStartMs = dateOnly.getTime() + (sH * 60 + sM) * 60 * 1000;
                    const adjustedShiftEndMs = shiftEndMs <= shiftStartMs
                        ? shiftEndMs + 24 * 60 * 60 * 1000
                        : shiftEndMs;

                    if (log.timestamp.getTime() > adjustedShiftEndMs) {
                        const shiftRecordExists = await prisma.attendance.findFirst({
                            where: {
                                employeeId: log.employeeId,
                                date: targetDate,
                                shiftId: effectiveShift.id
                            }
                        });
                        if (!shiftRecordExists) {
                            targetShiftId = null;
                        }
                    }
                }

                // ── OPEN-RECORD GUARD ─────────────────────────────────────────────────
                // If the employee still has an open attendance record for their regular
                // shift (checked-in but no check-out), the current punch must close
                // that record first. Skipping this guard would cause the OT gate to
                // stamp actualStartTime on the OT request and then `continue` to the
                // next log, leaving the regular shift record permanently open.
                const openRegularRecord = effectiveShift
                    ? await prisma.attendance.findFirst({
                        where: {
                            employeeId: log.employeeId,
                            date: targetDate,
                            shiftId: effectiveShift.id,
                            checkOutTime: null
                        }
                    })
                    : null;
                // ── END OPEN-RECORD GUARD ─────────────────────────────────────────────

                // Check for a pending OT check-in (only when no open regular-shift record)
                const pendingOtCheckIn = !openRegularRecord
                    ? recordOts.find(ot => {
                        if (ot.actualStartTime) return false;
                        const [sH, sM] = ot.startTime.split(':').map(Number);
                        const otStartMin = sH * 60 + sM;
                        return phtScanMin >= otStartMin - bufferMins && phtScanMin <= otStartMin + bufferMins;
                    })
                    : undefined;

                if (pendingOtCheckIn) {
                    await prisma.overtimeRequest.update({
                        where: { id: pendingOtCheckIn.id },
                        data: { actualStartTime: log.timestamp }
                    });
                    pendingOtCheckIn.actualStartTime = log.timestamp;

                    const audPayload1 = {
                        action: 'CHECK_IN',
                        entityType: 'OvertimeRequest',
                        entityId: pendingOtCheckIn.id,
                        performedBy: log.employeeId,
                        source: 'device-sync',
                        details: `Employee biometric OT check-in`,
                        compareKey: `${log.employeeId}_${targetDate.getTime()}_${pendingOtCheckIn.id}`,
                        actualStartTime: log.timestamp
                    };
                    pendingAudits.set(`${audPayload1.performedBy}_${audPayload1.entityType}_${audPayload1.entityId}_${audPayload1.action}`, audPayload1);

                    const existingAtt = await prisma.attendance.findFirst({
                        where: {
                            employeeId: log.employeeId,
                            date: targetDate,
                            shiftId: targetShiftId
                        }
                    });

                    if (!existingAtt) {
                        const empShift = targetShiftId ? effectiveShift : null;
                        const calculatedStatus = calculateAttendanceStatus(log.timestamp, null, targetDate, empShift, recordOts, isHoliday);
                        const checkInStatus = calculatedStatus === 'late' ? 'late' : 'present';

                        const checkInMetrics = calculateAttendanceMetrics(
                            { date: targetDate, checkInTime: log.timestamp, checkOutTime: null, status: checkInStatus, isHoliday },
                            empShift,
                            recordOts
                        );

                        const createdOtRecord = await prisma.attendance.create({
                            data: {
                                employeeId: log.employeeId,
                                date: targetDate,
                                shiftId: targetShiftId,
                                checkInTime: log.timestamp,
                                status: checkInStatus,
                                checkInDeviceId: log.deviceId,
                                checkInAuthMethod: log.authMethod,
                                lateMinutes: checkInMetrics.lateMinutes,
                                undertimeMinutes: checkInMetrics.undertimeMinutes,
                                overtimeMinutes: checkInMetrics.overtimeMinutes,
                                totalHours: checkInMetrics.totalHours,
                                isAnomaly: checkInMetrics.isAnomaly,
                                isEarlyOut: checkInMetrics.isEarlyOut,
                                gracePeriodApplied: checkInMetrics.gracePeriodApplied
                            },
                            include: {
                                employee: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        Department: { select: { name: true } },
                                        Branch: { select: { name: true } },
                                        Shift: true,
                                    }
                                },
                                checkInDevice: { select: { name: true } },
                                checkOutDevice: { select: { name: true } }
                            }
                        });
                        created++;

                        const otCheckInShift = targetShiftId ? effectiveShift : null;
                        const otCheckInMetrics = calculateAttendanceMetrics({ ...createdOtRecord, isHoliday }, otCheckInShift, recordOts);

                        attendanceEmitter.emit('new-record', {
                            type: 'check-in',
                            record: {
                                ...createdOtRecord,
                                checkInDeviceName: createdOtRecord.checkInDevice?.name || null,
                                checkOutDeviceName: createdOtRecord.checkOutDevice?.name || null,
                                checkInTimePH: formatToPhilippineTime(createdOtRecord.checkInTime),
                                checkOutTimePH: null,
                                ...otCheckInMetrics,
                            },
                        });
                    } else {
                        const fullAtt = await prisma.attendance.findUnique({
                            where: { id: existingAtt.id },
                            include: {
                                employee: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        Department: { select: { name: true } },
                                        Branch: { select: { name: true } },
                                        Shift: true,
                                    }
                                },
                                checkInDevice: { select: { name: true } },
                                checkOutDevice: { select: { name: true } }
                            }
                        });

                        if (fullAtt) {
                            const otCheckInShift = targetShiftId ? effectiveShift : null;
                            const otCheckInMetrics = calculateAttendanceMetrics({ ...fullAtt, isHoliday }, otCheckInShift, recordOts);

                            attendanceEmitter.emit('new-record', {
                                type: 'check-in',
                                record: {
                                    ...fullAtt,
                                    checkInTime: log.timestamp,
                                    checkInDeviceName: fullAtt.checkInDevice?.name || null,
                                    checkOutDeviceName: fullAtt.checkOutDevice?.name || null,
                                    checkInTimePH: formatToPhilippineTime(log.timestamp),
                                    checkOutTimePH: fullAtt.checkOutTime ? formatToPhilippineTime(fullAtt.checkOutTime) : null,
                                    ...otCheckInMetrics,
                                },
                            });
                        }
                    }

                    await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                    continue;
                }

                // Check for an active OT check-out
                const pendingOtCheckOut = recordOts.find(ot => {
                    if (!ot.actualStartTime || ot.actualEndTime) return false;
                    
                    const otCheckInTime = new Date(ot.actualStartTime);
                    const otDiffMs = log.timestamp.getTime() - otCheckInTime.getTime();
                    const otDiffHours = otDiffMs / (1000 * 60 * 60);

                    const [sH, sM] = ot.startTime.split(':').map(Number);
                    const [eH, eM] = ot.endTime.split(':').map(Number);
                    let otDurationHours = (eH + eM/60) - (sH + sM/60);
                    if (otDurationHours < 0) otDurationHours += 24;

                    const effectiveOTMinCheckout = Math.min(otDurationHours / 2, minCheckoutHours);
                    return otDiffHours >= effectiveOTMinCheckout;
                });

                if (pendingOtCheckOut) {
                    await prisma.overtimeRequest.update({
                        where: { id: pendingOtCheckOut.id },
                        data: { actualEndTime: log.timestamp }
                    });
                    pendingOtCheckOut.actualEndTime = log.timestamp;

                    const audPayload2 = {
                        action: 'CHECK_OUT',
                        entityType: 'OvertimeRequest',
                        entityId: pendingOtCheckOut.id,
                        performedBy: log.employeeId,
                        source: 'device-sync',
                        details: `Employee biometric OT check-out`,
                        compareKey: `${log.employeeId}_${targetDate.getTime()}_${pendingOtCheckOut.id}`,
                        actualEndTime: log.timestamp
                    };
                    pendingAudits.set(`${audPayload2.performedBy}_${audPayload2.entityType}_${audPayload2.entityId}_${audPayload2.action}`, audPayload2);

                    let existingAtt = await prisma.attendance.findFirst({
                        where: {
                            employeeId: log.employeeId,
                            date: targetDate,
                            checkInTime: new Date(pendingOtCheckOut.actualStartTime!)
                        }
                    });

                    if (!existingAtt && targetShiftId !== null) {
                        existingAtt = await prisma.attendance.findFirst({
                            where: {
                                employeeId: log.employeeId,
                                date: targetDate,
                                shiftId: targetShiftId
                            }
                        });
                    }

                    if (existingAtt) {
                        targetShiftId = existingAtt.shiftId;
                    }

                    if (existingAtt) {
                        const updateData: Record<string, unknown> = {
                            updatedAt: new Date()
                        };

                        if (!existingAtt.checkOutTime || log.timestamp > existingAtt.checkOutTime) {
                            updateData.checkOutTime = log.timestamp;
                            updateData.checkOutDeviceId = log.deviceId;
                            updateData.checkoutSource = 'device';
                            updateData.checkOutAuthMethod = log.authMethod;

                            if (existingAtt.status === 'incomplete' || existingAtt.checkOutTime) {
                                updateData.status = calculateAttendanceStatus(existingAtt.checkInTime, log.timestamp, existingAtt.date, targetShiftId ? effectiveShift : null, recordOts, isHoliday);

                                if (existingAtt.notes?.includes('No checkout recorded')) {
                                    updateData.notes = existingAtt.notes.replace(/\s*\|?\s*No checkout recorded.*$/i, '') || null;
                                }
                            }
                        }

                        const updatedOtRecord = await prisma.attendance.update({
                            where: { id: existingAtt.id },
                            data: updateData,
                            include: {
                                employee: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        Department: { select: { name: true } },
                                        Branch: { select: { name: true } },
                                        Shift: true,
                                    }
                                },
                                checkInDevice: { select: { name: true } },
                                checkOutDevice: { select: { name: true } }
                            }
                        });
                        updated++;

                        const otCoShift = targetShiftId ? effectiveShift : null;
                        const otCoMetrics = calculateAttendanceMetrics({ ...updatedOtRecord, isHoliday }, otCoShift, recordOts);

                        attendanceEmitter.emit('new-record', {
                            type: 'check-out',
                            record: {
                                ...updatedOtRecord,
                                checkInDeviceName: updatedOtRecord.checkInDevice?.name || null,
                                checkOutDeviceName: updatedOtRecord.checkOutDevice?.name || null,
                                checkInTimePH: formatToPhilippineTime(updatedOtRecord.checkInTime),
                                checkOutTimePH: updatedOtRecord.checkOutTime ? formatToPhilippineTime(updatedOtRecord.checkOutTime) : null,
                                ...otCoMetrics,
                            },
                        });

                        await recalculateAndPersistAttendanceMetrics(log.employeeId, targetDate);
                    } else {
                        const otCheckIn = new Date(pendingOtCheckOut.actualStartTime!);
                        const calculatedStatus = calculateAttendanceStatus(otCheckIn, log.timestamp, targetDate, targetShiftId ? effectiveShift : null, recordOts, isHoliday);

                        const checkMetrics = calculateAttendanceMetrics(
                            { date: targetDate, checkInTime: otCheckIn, checkOutTime: log.timestamp, status: calculatedStatus, isHoliday },
                            targetShiftId ? effectiveShift : null,
                            recordOts
                        );

                        const createdOtCoRecord = await prisma.attendance.create({
                            data: {
                                employeeId: log.employeeId,
                                date: targetDate,
                                shiftId: targetShiftId,
                                checkInTime: otCheckIn,
                                checkOutTime: log.timestamp,
                                status: calculatedStatus,
                                checkInDeviceId: log.deviceId,
                                checkOutDeviceId: log.deviceId,
                                checkInAuthMethod: 'MANUAL',
                                checkOutAuthMethod: log.authMethod,
                                checkoutSource: 'device',
                                lateMinutes: checkMetrics.lateMinutes,
                                undertimeMinutes: checkMetrics.undertimeMinutes,
                                overtimeMinutes: checkMetrics.overtimeMinutes,
                                totalHours: checkMetrics.totalHours,
                                isAnomaly: checkMetrics.isAnomaly,
                                isEarlyOut: checkMetrics.isEarlyOut,
                                gracePeriodApplied: checkMetrics.gracePeriodApplied
                            },
                            include: {
                                employee: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        Department: { select: { name: true } },
                                        Branch: { select: { name: true } },
                                        Shift: true,
                                    }
                                },
                                checkInDevice: { select: { name: true } },
                                checkOutDevice: { select: { name: true } }
                            }
                        });
                        created++;

                        const otNewCoShift = targetShiftId ? effectiveShift : null;
                        const otNewCoMetrics = calculateAttendanceMetrics({ ...createdOtCoRecord, isHoliday }, otNewCoShift, recordOts);

                        attendanceEmitter.emit('new-record', {
                            type: 'check-out',
                            record: {
                                ...createdOtCoRecord,
                                checkInDeviceName: createdOtCoRecord.checkInDevice?.name || null,
                                checkOutDeviceName: createdOtCoRecord.checkOutDevice?.name || null,
                                checkInTimePH: formatToPhilippineTime(createdOtCoRecord.checkInTime),
                                checkOutTimePH: createdOtCoRecord.checkOutTime ? formatToPhilippineTime(createdOtCoRecord.checkOutTime) : null,
                                ...otNewCoMetrics,
                            },
                        });
                    }

                    await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                    continue;
                }
            }
            // ── END UNIFIED OVERTIME LOGIC GATE ──────────────────────────────────────

            // ── POST-SHIFT GUARD DEMOTION ─────────────────────────────────────────
            // If the employee's shift has already ended and there is no approved OT,
            // demote the shift to "No Shift" (null) before checking the database.
            // This ensures any checkout punch without a check-in is saved under
            // the "No Shift" category instead of being silently skipped.
            // We ONLY demote if there isn't already an open check-in for this shift.
            if (resolvedShift) {
                const [eH, eM] = resolvedShift.endTime.split(':').map(Number);
                const shiftEndMs = targetDate.getTime() + (eH * 60 + eM) * 60 * 1000;
                const [sH, sM] = resolvedShift.startTime.split(':').map(Number);
                const shiftStartMs = targetDate.getTime() + (sH * 60 + sM) * 60 * 1000;
                const adjustedShiftEndMs = shiftEndMs <= shiftStartMs
                    ? shiftEndMs + 24 * 60 * 60 * 1000
                    : shiftEndMs;

                if (log.timestamp.getTime() > adjustedShiftEndMs) {
                    const hasRecordForShift = await prisma.attendance.findFirst({
                        where: {
                            employeeId: log.employeeId,
                            date: targetDate,
                            shiftId: resolvedShift.id
                        }
                    });
                    if (!hasRecordForShift) {
                        effectiveShift = null;
                    }
                }
            }
            // ── END POST-SHIFT GUARD DEMOTION ─────────────────────────────────────

            const existingAttendance = await prisma.attendance.findFirst({
                where: {
                    employeeId: log.employeeId,
                    date: targetDate,
                    shiftId: effectiveShift?.id ?? null
                }
            });

            if (!existingAttendance) {

                const calculatedStatus = calculateAttendanceStatus(log.timestamp, null, targetDate, effectiveShift, recordOts, isHoliday);
                const isLate = calculatedStatus === 'late';
                const checkInStatus = isLate ? 'late' : 'present';

                // Calculate and persist initial metrics at check-in time.
                // undertimeMinutes / totalHours / isEarlyOut will be 0/false until checkout.
                const checkInMetrics = calculateAttendanceMetrics(
                    { date: targetDate, checkInTime: log.timestamp, checkOutTime: null, status: checkInStatus, isHoliday },
                    effectiveShift,
                    recordOts
                );

                try {
                    const createdRecord = await prisma.attendance.create({
                        data: {
                            employeeId: log.employeeId,
                            date: targetDate,
                            shiftId: effectiveShift?.id ?? null,
                            checkInTime: log.timestamp,
                            status: checkInStatus,
                            checkInDeviceId: log.deviceId,
                            checkInAuthMethod: log.authMethod,
                            lateMinutes: checkInMetrics.lateMinutes,
                            undertimeMinutes: checkInMetrics.undertimeMinutes,
                            overtimeMinutes: checkInMetrics.overtimeMinutes,
                            totalHours: checkInMetrics.totalHours,
                            isAnomaly: checkInMetrics.isAnomaly,
                            isEarlyOut: checkInMetrics.isEarlyOut,
                            gracePeriodApplied: checkInMetrics.gracePeriodApplied
                        },
                        include: {
                            employee: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    Department: { select: { name: true } },
                                    Branch: { select: { name: true } },
                                    Shift: true,
                                }
                            },
                            checkInDevice: { select: { name: true } },
                            checkOutDevice: { select: { name: true } }
                        }
                    });
                    created++;

                    const audPayload3 = {
                        action: 'CHECK_IN',
                        entityType: 'Attendance',
                        entityId: createdRecord.id,
                        performedBy: createdRecord.employeeId,
                        source: 'device-sync',
                        details: `Employee checked in (${isLate ? 'Late' : 'On-time'})`,
                        metadata: { snapshot: { status: createdRecord.status, checkInTime: formatToPhilippineTime(createdRecord.checkInTime) } },
                        compareKey: `${createdRecord.employeeId}_${createdRecord.date.getTime()}_${createdRecord.shiftId}`,
                        checkInTime: createdRecord.checkInTime
                    };
                    pendingAudits.set(`${audPayload3.performedBy}_${audPayload3.entityType}_${audPayload3.entityId}_${audPayload3.action}`, audPayload3);

                    const shift = effectiveShift;
                    const metrics = calculateAttendanceMetrics({ ...createdRecord, isHoliday }, shift, recordOts);

                    attendanceEmitter.emit('new-record', {
                        type: 'check-in',
                        record: {
                            ...createdRecord,
                            checkInDeviceName: createdRecord.checkInDevice?.name || null,
                            checkOutDeviceName: createdRecord.checkOutDevice?.name || null,
                            checkInTimePH: formatToPhilippineTime(createdRecord.checkInTime),
                            checkOutTimePH: null,
                            ...metrics,
                        },
                    });

                    await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                } catch (err: unknown) {
                    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
                        console.debug(`[Attendance] Duplicate record skipped for employeeId=${log.employeeId} on ${targetDate}`);
                        await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                        continue;
                    }
                    console.error(
                        `[Attendance] Failed to process check-in log id=${log.id} for employeeId=${log.employeeId} on ${targetDate}:`,
                        err
                    );
                    continue;
                }
            } else {
                try {
                    const checkInTime = new Date(existingAttendance.checkInTime);
                    const logTime = new Date(log.timestamp);
                    const diffMs = logTime.getTime() - checkInTime.getTime();
                    const diffHours = diffMs / (1000 * 60 * 60);

                    const shiftDurationHours = effectiveShift 
                        ? (() => {
                            const [sH, sM] = effectiveShift.startTime.split(':').map(Number);
                            const [eH, eM] = effectiveShift.endTime.split(':').map(Number);
                            let duration = (eH + eM/60) - (sH + sM/60);
                            if (duration < 0) duration += 24;
                            return duration;
                        })()
                        : null;
                    const effectiveMinCheckout = shiftDurationHours ? Math.min(shiftDurationHours / 2, minCheckoutHours) : minCheckoutHours;

                    if (diffHours < effectiveMinCheckout) {
                        console.log(
                            `[Attendance] Log ignored: employee="${log.employee.firstName} ${log.employee.lastName}" (ID=${log.employeeId}), ` +
                            `timestamp=${formatToPhilippineTime(log.timestamp)}, ` +
                            `reason=Within minimum checkout gap (${(effectiveMinCheckout * 60).toFixed(0)} minutes from check-in at ${formatToPhilippineTime(checkInTime)})`
                        );

                        const snapshot = {
                            status: 'ignored',
                            checkInTime: formatToPhilippineTime(checkInTime),
                            ignoredPunchTime: formatToPhilippineTime(log.timestamp)
                        };

                        const existingIgnoredAudit = await prisma.auditLog.findFirst({
                            where: {
                                performedBy: log.employeeId,
                                details: `Punch ignored (Within minimum checkout gap of ${(effectiveMinCheckout * 60).toFixed(0)} minutes)`,
                                metadata: {
                                    equals: { snapshot }
                                }
                            }
                        });

                        if (!existingIgnoredAudit) {
                            const ignoredAudPayload = {
                                action: 'CHECK_OUT' as const,
                                entityType: 'Attendance' as const,
                                entityId: existingAttendance.id,
                                performedBy: log.employeeId,
                                source: 'device-sync' as const,
                                details: `Punch ignored (Within minimum checkout gap of ${(effectiveMinCheckout * 60).toFixed(0)} minutes)`,
                                metadata: snapshot
                            };
                            auditPromises.push(audit(ignoredAudPayload));
                        }

                        await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                        continue;
                    }

                    if (existingAttendance.checkOutTime) {
                        if (log.timestamp > existingAttendance.checkOutTime) {
                            // OVERTIME BIOMETRIC CHECK-IN LOGIC


                            const updateData: Record<string, unknown> = {
                                checkOutTime: log.timestamp,
                                updatedAt: new Date(),
                                checkOutDeviceId: log.deviceId,
                                checkoutSource: 'device',
                                checkOutAuthMethod: log.authMethod,
                            };

                            if (existingAttendance.status === 'incomplete') {
                                updateData.status = calculateAttendanceStatus(existingAttendance.checkInTime, log.timestamp, existingAttendance.date, effectiveShift, recordOts, isHoliday);

                                if (existingAttendance.notes?.includes('No checkout recorded')) {
                                    updateData.notes = existingAttendance.notes.replace(/\s*\|?\s*No checkout recorded.*$/i, '') || null;
                                }
                            }

                            // Persist checkout metrics
                            const coStatus1 = (updateData.status as string) ?? existingAttendance.status;
                            const coMetrics1 = calculateAttendanceMetrics(
                                { date: existingAttendance.date, checkInTime: existingAttendance.checkInTime, checkOutTime: log.timestamp, status: coStatus1, isHoliday },
                                effectiveShift,
                                recordOts
                            );
                            updateData.lateMinutes = coMetrics1.lateMinutes;
                            updateData.undertimeMinutes = coMetrics1.undertimeMinutes;
                            updateData.overtimeMinutes = coMetrics1.overtimeMinutes;
                            updateData.totalHours = coMetrics1.totalHours;
                            updateData.isAnomaly = coMetrics1.isAnomaly;
                            updateData.isEarlyOut = coMetrics1.isEarlyOut;
                            updateData.gracePeriodApplied = coMetrics1.gracePeriodApplied;

                            const updatedRecord = await prisma.attendance.update({
                                where: { id: existingAttendance.id },
                                data: updateData,
                                include: {
                                    employee: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            Department: { select: { name: true } },
                                            Branch: { select: { name: true } },
                                            Shift: true,
                                        }
                                    },
                                    checkInDevice: { select: { name: true } },
                                    checkOutDevice: { select: { name: true } }
                                }
                            });
                            updated++;

                            const audPayload4 = {
                                action: 'CHECK_OUT',
                                entityType: 'Attendance',
                                entityId: updatedRecord.id,
                                performedBy: updatedRecord.employeeId,
                                source: 'device-sync',
                                details: `Employee checked out (updated)`,
                                metadata: { changes: [{ field: 'checkOutTime', oldValue: existingAttendance.checkOutTime ? formatToPhilippineTime(existingAttendance.checkOutTime) : null, newValue: formatToPhilippineTime(log.timestamp) }] },
                                compareKey: `${updatedRecord.employeeId}_${updatedRecord.date.getTime()}_${updatedRecord.shiftId}`,
                                checkOutTime: updatedRecord.checkOutTime
                            };
                            pendingAudits.set(`${audPayload4.performedBy}_${audPayload4.entityType}_${audPayload4.entityId}_${audPayload4.action}`, audPayload4);

                            const shift = effectiveShift;
                            const metrics = calculateAttendanceMetrics({ ...updatedRecord, isHoliday }, shift, recordOts);

                            attendanceEmitter.emit('new-record', {
                                type: 'check-out',
                                record: {
                                    ...updatedRecord,
                                    checkInDeviceName: updatedRecord.checkInDevice?.name || null,
                                    checkOutDeviceName: updatedRecord.checkOutDevice?.name || null,
                                    checkInTimePH: formatToPhilippineTime(updatedRecord.checkInTime),
                                    checkOutTimePH: updatedRecord.checkOutTime ? formatToPhilippineTime(updatedRecord.checkOutTime) : null,
                                    ...metrics,
                                },
                            });
                        }
                    } else {
                        const updateData: Record<string, unknown> = {
                            checkOutTime: log.timestamp,
                            updatedAt: new Date(),
                            checkOutDeviceId: log.deviceId,
                            checkoutSource: 'device',
                            checkOutAuthMethod: log.authMethod,
                        };

                        if (existingAttendance.status === 'incomplete') {
                            updateData.status = calculateAttendanceStatus(existingAttendance.checkInTime, log.timestamp, existingAttendance.date, effectiveShift, recordOts, isHoliday);

                            if (existingAttendance.notes?.includes('No checkout recorded')) {
                                updateData.notes = existingAttendance.notes.replace(/\s*\|?\s*No checkout recorded.*$/i, '') || null;
                            }
                        }

                        // Persist checkout metrics
                        const coStatus2 = (updateData.status as string) ?? existingAttendance.status;
                        const coMetrics2 = calculateAttendanceMetrics(
                            { date: existingAttendance.date, checkInTime: existingAttendance.checkInTime, checkOutTime: log.timestamp, status: coStatus2, isHoliday },
                            effectiveShift,
                            recordOts
                        );
                        updateData.lateMinutes = coMetrics2.lateMinutes;
                        updateData.undertimeMinutes = coMetrics2.undertimeMinutes;
                        updateData.overtimeMinutes = coMetrics2.overtimeMinutes;
                        updateData.totalHours = coMetrics2.totalHours;
                        updateData.isAnomaly = coMetrics2.isAnomaly;
                        updateData.isEarlyOut = coMetrics2.isEarlyOut;
                        updateData.gracePeriodApplied = coMetrics2.gracePeriodApplied;

                        const updatedRecord2 = await prisma.attendance.update({
                            where: { id: existingAttendance.id },
                            data: updateData,
                            include: {
                                employee: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        Department: { select: { name: true } },
                                        Branch: { select: { name: true } },
                                        Shift: true,
                                    }
                                },
                                checkInDevice: { select: { name: true } },
                                checkOutDevice: { select: { name: true } }
                            }
                        });
                        updated++;

                        const audPayload5 = {
                            action: 'CHECK_OUT',
                            entityType: 'Attendance',
                            entityId: updatedRecord2.id,
                            performedBy: updatedRecord2.employeeId,
                            source: 'device-sync',
                            details: `Employee checked out`,
                            metadata: { changes: [{ field: 'checkOutTime', oldValue: null, newValue: formatToPhilippineTime(log.timestamp) }] },
                            compareKey: `${updatedRecord2.employeeId}_${updatedRecord2.date.getTime()}_${updatedRecord2.shiftId}`,
                            checkOutTime: updatedRecord2.checkOutTime
                        };
                        pendingAudits.set(`${audPayload5.performedBy}_${audPayload5.entityType}_${audPayload5.entityId}_${audPayload5.action}`, audPayload5);

                        const shift2 = effectiveShift;
                        const metrics2 = calculateAttendanceMetrics({ ...updatedRecord2, isHoliday }, shift2, recordOts);

                        attendanceEmitter.emit('new-record', {
                            type: 'check-out',
                            record: {
                                ...updatedRecord2,
                                checkInDeviceName: updatedRecord2.checkInDevice?.name || null,
                                checkOutDeviceName: updatedRecord2.checkOutDevice?.name || null,
                                checkInTimePH: formatToPhilippineTime(updatedRecord2.checkInTime),
                                checkOutTimePH: updatedRecord2.checkOutTime ? formatToPhilippineTime(updatedRecord2.checkOutTime) : null,
                                ...metrics2,
                            },
                        });
                    }

                    await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                } catch (err: unknown) {
                    console.error(`[Attendance] Failed to process check-out log id=${log.id} for employeeId=${log.employeeId}:`, err);
                    continue;
                }
            }
        }

        // Write the consolidated audits at the end of the batch run, checking if values actually changed
        for (const payload of pendingAudits.values()) {
            let shouldLog = true;

            if (payload.entityType === 'Attendance') {
                const orig = originalRecords.get(payload.compareKey);
                if (orig) {
                    if (payload.action === 'CHECK_IN') {
                        if (orig.checkInTime.getTime() === payload.checkInTime.getTime()) {
                            shouldLog = false;
                        }
                    } else if (payload.action === 'CHECK_OUT') {
                        const origTime = orig.checkOutTime?.getTime() || null;
                        const newTime = payload.checkOutTime?.getTime() || null;
                        if (origTime === newTime) {
                            shouldLog = false;
                        }
                    }
                }
            } else if (payload.entityType === 'OvertimeRequest') {
                const origOt = originalOts.get(payload.compareKey);
                if (origOt) {
                    if (payload.action === 'CHECK_IN') {
                        const origTime = origOt.actualStartTime?.getTime() || null;
                        const newTime = payload.actualStartTime?.getTime() || null;
                        if (origTime === newTime) {
                            shouldLog = false;
                        }
                    } else if (payload.action === 'CHECK_OUT') {
                        const origTime = origOt.actualEndTime?.getTime() || null;
                        const newTime = payload.actualEndTime?.getTime() || null;
                        if (origTime === newTime) {
                            shouldLog = false;
                        }
                    }
                }
            }

            if (shouldLog) {
                const { compareKey, checkInTime, checkOutTime, actualStartTime, actualEndTime, ...cleanPayload } = payload;
                auditPromises.push(audit(cleanPayload));
            }
        }
        await Promise.all(auditPromises);

        console.log(`[Attendance] Processed ${logs.length} logs: ${created} created, ${updated} updated`);

        return {
            success: true,
            processed: logs.length,
            created,
            updated
        };
    } catch (error: unknown) {
        console.error('[Attendance] Error processing logs:', error);
        return {
            success: false,
            processed: 0,
            created: 0,
            updated: 0
        };
    }
};
