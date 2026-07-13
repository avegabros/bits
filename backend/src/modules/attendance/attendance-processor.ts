import { prisma } from '../../shared/lib/prisma';
import { Shift, Prisma, EmployeeShift, SyncConfig } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import attendanceEmitter from '../../shared/events/attendanceEmitter';
import { audit } from '../../shared/lib/auditLogger';
import { toPHTDate, formatToPhilippineTime, normalizeTime } from './attendance-utils';
import { calculateAttendanceMetrics, calculateAttendanceStatus } from './attendance-calculator';
import { ProcessResult } from './attendance.types';


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

    let shifts: Shift[] = [];
    if (assignments.length > 0) {
        shifts = assignments.map(a => a.shift);
    } else {
        let legacyShift = fallbackEmployeeShift;
        if (!legacyShift) {
            const emp = await prisma.employee.findUnique({
                where: { id: employeeId },
                include: { Shift: true }
            });
            legacyShift = emp?.Shift;
        }
        if (legacyShift) {
            shifts = [legacyShift];
        }
    }

    if (shifts.length === 0) {
        return { shift: null, isNewCheckin: true };
    }

    // Filter by day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const phtTimestamp = new Date(timestamp.getTime() + 8 * 60 * 60 * 1000);
    const currentDayName = dayNames[phtTimestamp.getUTCDay()];

    const matchingShifts = shifts.filter(s => {
        try {
            const workDays = JSON.parse(s.workDays || '[]');
            return workDays.includes(currentDayName);
        } catch {
            return false;
        }
    });

    const candidates = matchingShifts.length > 0 ? matchingShifts : shifts;

    // Find closest shift by startTime proximity
    let bestShift: Shift | null = null;
    let minDistance = Infinity;

    for (const shift of candidates) {
        const [startH, startM] = shift.startTime.split(':').map(Number);
        // Compute absolute shift start on dateOnly
        const shiftStart = new Date(dateOnly.getTime() + (startH * 60 + startM) * 60 * 1000);
        const dist = Math.abs(normalizeTime(timestamp).getTime() - shiftStart.getTime());

        if (dist < minDistance) {
            minDistance = dist;
            bestShift = shift;
        }
    }

    return { shift: bestShift, isNewCheckin: true };
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
                isAnomaly: record.notes?.includes('Missing Overtime-In') ? true : metrics.isAnomaly,
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
    const originalRecords = new Map<string, any>();
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

        const holidays = await prisma.holiday.findMany({
            include: { branches: true }
        });

        let created = 0;
        let updated = 0;

        for (const log of logs) {
            const dateOnly = toPHTDate(log.timestamp);
            const isIN = log.status === 0 || log.status === 4;
            const isOUT = log.status === 1 || log.status === 5;

            if (isIN) {
                // Find if there is an active open record for this employee (within a 24h window)
                const openRecord = await prisma.attendance.findFirst({
                    where: {
                        employeeId: log.employeeId,
                        checkOutTime: null,
                        date: {
                            gte: new Date(dateOnly.getTime() - 24 * 60 * 60 * 1000),
                            lte: dateOnly
                        }
                    }
                });

                if (openRecord) {
                    // Duplicate IN punch — log and skip
                    console.log(`[Attendance] Duplicate IN punch ignored for employeeId=${log.employeeId} at ${formatToPhilippineTime(log.timestamp)}`);
                    await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                    continue;
                }

                // Resolve shift template
                const { shift: resolvedShift } = await resolveShiftForTimestamp(
                    log.employeeId,
                    log.timestamp,
                    dateOnly,
                    log.employee?.Shift
                );

                // Holiday / Rest Day detection
                const isHoliday = (() => {
                    const dayMs = dateOnly.getTime();
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

                // If regular shift already worked or it's holiday/rest day, demote to No Shift (null)
                let targetShiftId = (isRestDay || isHoliday) ? null : (resolvedShift?.id ?? null);
                if (targetShiftId !== null) {
                    const exists = await prisma.attendance.findFirst({
                        where: { employeeId: log.employeeId, date: dateOnly, shiftId: targetShiftId }
                    });
                    if (exists) {
                        targetShiftId = null; // Demote to No Shift to support overtime / second session
                    }
                }

                const calculatedStatus = calculateAttendanceStatus(log.timestamp, null, dateOnly, targetShiftId ? resolvedShift : null, [], isHoliday);
                const checkInStatus = calculatedStatus === 'late' ? 'late' : 'present';

                const createdRecord = await prisma.attendance.create({
                    data: {
                        employeeId: log.employeeId,
                        date: dateOnly,
                        shiftId: targetShiftId,
                        checkInTime: log.timestamp,
                        status: checkInStatus,
                        checkInDeviceId: log.deviceId,
                        checkInAuthMethod: log.authMethod
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

                attendanceEmitter.emit('new-record', {
                    type: 'check-in',
                    record: {
                        ...createdRecord,
                        checkInDeviceName: createdRecord.checkInDevice?.name || null,
                        checkOutDeviceName: createdRecord.checkOutDevice?.name || null,
                        checkInTimePH: formatToPhilippineTime(createdRecord.checkInTime),
                        checkOutTimePH: null,
                    },
                });

                await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                await recalculateAndPersistAttendanceMetrics(log.employeeId, dateOnly);
            }
            else if (isOUT) {
                // Find the active open record for this employee (within a 24h window)
                let openRecord = await prisma.attendance.findFirst({
                    where: {
                        employeeId: log.employeeId,
                        checkOutTime: null,
                        date: {
                            gte: new Date(dateOnly.getTime() - 24 * 60 * 60 * 1000),
                            lte: dateOnly
                        }
                    },
                    orderBy: { checkInTime: 'desc' }
                });

                // 24-hour expiration: prevent punches from attaching to records from previous days
                if (openRecord) {
                    const hoursSinceCheckIn = (log.timestamp.getTime() - openRecord.checkInTime.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceCheckIn > 24) {
                        console.log(`[Attendance] Open record id=${openRecord.id} expired (${hoursSinceCheckIn.toFixed(1)}h since check-in) — will not attach punch`);
                        openRecord = null;
                    }
                }

                if (!openRecord) {
                    // Search for a closed record in the last 24 hours
                    const closedRecord = await prisma.attendance.findFirst({
                        where: {
                            employeeId: log.employeeId,
                            checkOutTime: { not: null },
                            date: {
                                gte: new Date(dateOnly.getTime() - 24 * 60 * 60 * 1000),
                                lte: dateOnly
                            }
                        },
                        orderBy: { checkOutTime: 'desc' }
                    });

                    if (closedRecord && log.timestamp > closedRecord.checkOutTime!) {
                        // 24-hour expiration: don't update records where check-in was >24h ago
                        const hoursSinceCheckIn = (log.timestamp.getTime() - closedRecord.checkInTime.getTime()) / (1000 * 60 * 60);

                        if (hoursSinceCheckIn <= 24) {
                            const updatedRecord = await prisma.attendance.update({
                                where: { id: closedRecord.id },
                                data: {
                                    checkOutTime: log.timestamp,
                                    checkOutDeviceId: log.deviceId,
                                    checkoutSource: 'device',
                                    checkOutAuthMethod: log.authMethod
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

                            console.log(`[Attendance] Updated check-out time of existing record id=${closedRecord.id} for employeeId=${log.employeeId} to ${formatToPhilippineTime(log.timestamp)}`);

                            attendanceEmitter.emit('new-record', {
                                type: 'check-out',
                                record: {
                                    ...updatedRecord,
                                    checkInDeviceName: updatedRecord.checkInDevice?.name || null,
                                    checkOutDeviceName: updatedRecord.checkOutDevice?.name || null,
                                    checkInTimePH: formatToPhilippineTime(updatedRecord.checkInTime),
                                    checkOutTimePH: formatToPhilippineTime(updatedRecord.checkOutTime!),
                                },
                            });

                            await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                            await recalculateAndPersistAttendanceMetrics(log.employeeId, closedRecord.date);
                            continue;
                        }

                        console.log(`[Attendance] Closed record id=${closedRecord.id} expired (${hoursSinceCheckIn.toFixed(1)}h since check-in) — creating No Shift record instead`);
                    }

                    // Orphan OUT punch — create a No Shift record with checkIn = checkOut
                    console.log(`[Attendance] Creating No Shift record for orphan OUT punch — employeeId=${log.employeeId} at ${formatToPhilippineTime(log.timestamp)}`);
                    const noShiftRecord = await prisma.attendance.create({
                        data: {
                            employeeId: log.employeeId,
                            date: dateOnly,
                            shiftId: null,
                            checkInTime: log.timestamp,
                            checkOutTime: log.timestamp,
                            status: 'present',
                            notes: 'Missing Check-In (orphan punch)',
                            checkOutDeviceId: log.deviceId,
                            checkoutSource: 'device',
                            checkOutAuthMethod: log.authMethod
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

                    attendanceEmitter.emit('new-record', {
                        type: 'check-out',
                        record: {
                            ...noShiftRecord,
                            checkInDeviceName: noShiftRecord.checkInDevice?.name || null,
                            checkOutDeviceName: noShiftRecord.checkOutDevice?.name || null,
                            checkInTimePH: formatToPhilippineTime(noShiftRecord.checkInTime),
                            checkOutTimePH: formatToPhilippineTime(noShiftRecord.checkOutTime!),
                        },
                    });

                    await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                    await recalculateAndPersistAttendanceMetrics(log.employeeId, dateOnly);
                    continue;
                }

                const updatedRecord = await prisma.attendance.update({
                    where: { id: openRecord.id },
                    data: {
                        checkOutTime: log.timestamp,
                        checkOutDeviceId: log.deviceId,
                        checkoutSource: 'device',
                        checkOutAuthMethod: log.authMethod
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

                updated++;

                attendanceEmitter.emit('new-record', {
                    type: 'check-out',
                    record: {
                        ...updatedRecord,
                        checkInDeviceName: updatedRecord.checkInDevice?.name || null,
                        checkOutDeviceName: updatedRecord.checkOutDevice?.name || null,
                        checkInTimePH: formatToPhilippineTime(updatedRecord.checkInTime),
                        checkOutTimePH: formatToPhilippineTime(updatedRecord.checkOutTime!),
                    },
                });

                await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                await recalculateAndPersistAttendanceMetrics(log.employeeId, openRecord.date);
            }
            else {
                // If it is not IN or OUT, just mark it processed to avoid blocking the queue
                await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
            }
        }

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
