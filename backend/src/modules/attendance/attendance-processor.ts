import { prisma } from '../../shared/lib/prisma';
import { Shift, Prisma } from '@prisma/client';
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
    const normalizedTimestamp = normalizeTime(timestamp);

    const assignments = await prisma.employeeShift.findMany({
        where: { employeeId },
        include: { shift: true },
        orderBy: { sortOrder: 'asc' }
    });

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

    const tryMatch = (candidateShifts: typeof assignments): { shift: Shift; isNewCheckin: boolean } | null => {
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
                    // Check-out: the full buffer window (including post-shift) is valid.
                    windowMatches.push({ shift, needsCheckIn: false, needsCheckOut: true, distToStart, distToEnd });
                } else if (needsCheckIn && normalizedTimestamp <= shiftEnd) {
                    // New check-in: only valid while the shift is still active.
                    // The post-shift buffer (shiftEnd → windowEnd) is exclusively for check-outs;
                    // a missed shift whose end time has passed must NOT capture future scans.
                    windowMatches.push({ shift, needsCheckIn: true, needsCheckOut: false, distToStart, distToEnd });
                }
            }

            const minDist = Math.min(distToStart, distToEnd);
            // For the fallback: same rule — don't propose an already-ended shift as the
            // target for a brand-new check-in. The buffer tail is check-out territory only.
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

        if (fallbackMatch) return { shift: fallbackMatch, isNewCheckin: fallbackIsNew };
        return null;
    };

    const shiftsNeedingCheckout = filteredAssignments.filter(a => {
        const record = recordMap.get(a.shift.id);
        return record && !record.checkOutTime;
    });

    if (shiftsNeedingCheckout.length > 0) {
        const match = tryMatch(shiftsNeedingCheckout);
        if (match) return match;
    }

    const dayMatchingShifts = filteredAssignments.filter(a => {
        const workDays = getWorkDays(a.shift);
        return workDays.includes(currentDayName);
    });

    if (dayMatchingShifts.length > 0) {
        const match = tryMatch(dayMatchingShifts);
        if (match) return match;
    }

    const match = tryMatch(filteredAssignments);
    if (match) return match;

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

    return { shift: bestMatch, isNewCheckin: true };
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
            { date: record.date, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime, status: record.status },
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

export const processAttendanceLogs = async (): Promise<ProcessResult> => {
    try {
        const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

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

        let created = 0;
        let updated = 0;

        for (const log of logs) {
            const dateOnly = toPHTDate(log.timestamp);
            const dateKey = `${log.employeeId}_${getPhtDateStr(dateOnly)}`;
            const recordOts = otsByEmpAndDate.get(dateKey) || [];

            const { shift: resolvedShift } = await resolveShiftForTimestamp(
                log.employeeId, 
                log.timestamp, 
                dateOnly, 
                log.employee?.Shift
            );

            // ── UNIFIED OVERTIME LOGIC GATE ──────────────────────────────────────────
            if (recordOts.length > 0) {
                const phtScanMin = (() => {
                    const pht = new Date(log.timestamp.getTime() + 8 * 60 * 60 * 1000);
                    return pht.getUTCHours() * 60 + pht.getUTCMinutes();
                })();

                // Check for a pending OT check-in
                const pendingOtCheckIn = recordOts.find(ot => {
                    if (ot.actualStartTime) return false;
                    const [sH, sM] = ot.startTime.split(':').map(Number);
                    const otStartMin = sH * 60 + sM;
                    return phtScanMin >= otStartMin - bufferMins && phtScanMin <= otStartMin + bufferMins;
                });

                if (pendingOtCheckIn) {
                    await prisma.overtimeRequest.update({
                        where: { id: pendingOtCheckIn.id },
                        data: { actualStartTime: log.timestamp }
                    });
                    pendingOtCheckIn.actualStartTime = log.timestamp;

                    void audit({
                        action: 'CHECK_IN',
                        entityType: 'OvertimeRequest',
                        entityId: pendingOtCheckIn.id,
                        performedBy: log.employeeId,
                        source: 'device-sync',
                        details: `Employee biometric OT check-in`
                    });

                    const existingAtt = await prisma.attendance.findFirst({
                        where: {
                            employeeId: log.employeeId,
                            date: dateOnly,
                            shiftId: resolvedShift?.id ?? null
                        }
                    });

                    if (!existingAtt) {
                        const empShift = resolvedShift ?? log.employee?.Shift ?? null;
                        const calculatedStatus = calculateAttendanceStatus(log.timestamp, null, dateOnly, empShift);
                        const checkInStatus = calculatedStatus === 'late' ? 'late' : 'present';

                        const checkInMetrics = calculateAttendanceMetrics(
                            { date: dateOnly, checkInTime: log.timestamp, checkOutTime: null, status: checkInStatus },
                            empShift,
                            recordOts
                        );

                        const createdOtRecord = await prisma.attendance.create({
                            data: {
                                employeeId: log.employeeId,
                                date: dateOnly,
                                shiftId: resolvedShift?.id ?? null,
                                checkInTime: log.timestamp,
                                status: checkInStatus,
                                checkInDeviceId: log.deviceId,
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

                        const otCheckInShift = createdOtRecord.employee?.Shift ?? null;
                        const otCheckInMetrics = calculateAttendanceMetrics(createdOtRecord, otCheckInShift, recordOts);

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
                            const otCheckInShift = fullAtt.employee?.Shift ?? null;
                            const otCheckInMetrics = calculateAttendanceMetrics(fullAtt, otCheckInShift, recordOts);

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

                    void audit({
                        action: 'CHECK_OUT',
                        entityType: 'OvertimeRequest',
                        entityId: pendingOtCheckOut.id,
                        performedBy: log.employeeId,
                        source: 'device-sync',
                        details: `Employee biometric OT check-out`
                    });

                    const existingAtt = await prisma.attendance.findFirst({
                        where: {
                            employeeId: log.employeeId,
                            date: dateOnly,
                            shiftId: resolvedShift?.id ?? null
                        }
                    });

                    if (existingAtt) {
                        const updateData: Record<string, unknown> = {
                            updatedAt: new Date()
                        };

                        if (!existingAtt.checkOutTime) {
                            updateData.checkOutTime = log.timestamp;
                            updateData.checkOutDeviceId = log.deviceId;
                            updateData.checkoutSource = 'device';

                            if (existingAtt.status === 'incomplete') {
                                const empShift = resolvedShift ?? log.employee?.Shift ?? null;
                                updateData.status = calculateAttendanceStatus(existingAtt.checkInTime, log.timestamp, existingAtt.date, empShift);

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

                        const otCoShift = updatedOtRecord.employee?.Shift ?? null;
                        const otCoMetrics = calculateAttendanceMetrics(updatedOtRecord, otCoShift, recordOts);

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

                        await recalculateAndPersistAttendanceMetrics(log.employeeId, dateOnly);
                    } else {
                        const empShift = resolvedShift ?? log.employee?.Shift ?? null;
                        const otCheckIn = new Date(pendingOtCheckOut.actualStartTime!);
                        const calculatedStatus = calculateAttendanceStatus(otCheckIn, log.timestamp, dateOnly, empShift);

                        const checkMetrics = calculateAttendanceMetrics(
                            { date: dateOnly, checkInTime: otCheckIn, checkOutTime: log.timestamp, status: calculatedStatus },
                            empShift,
                            recordOts
                        );

                        const createdOtCoRecord = await prisma.attendance.create({
                            data: {
                                employeeId: log.employeeId,
                                date: dateOnly,
                                shiftId: resolvedShift?.id ?? null,
                                checkInTime: otCheckIn,
                                checkOutTime: log.timestamp,
                                status: calculatedStatus,
                                checkInDeviceId: log.deviceId,
                                checkOutDeviceId: log.deviceId,
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

                        const otNewCoShift = createdOtCoRecord.employee?.Shift ?? null;
                        const otNewCoMetrics = calculateAttendanceMetrics(createdOtCoRecord, otNewCoShift, recordOts);

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

            const existingAttendance = await prisma.attendance.findFirst({
                where: {
                    employeeId: log.employeeId,
                    date: dateOnly,
                    shiftId: resolvedShift?.id ?? null
                }
            });

            if (!existingAttendance) {
                // ── POST-SHIFT GUARD ──────────────────────────────────────────────────
                // If the employee's shift has already ended and there is no approved OT,
                // skip this scan entirely. This prevents phantom attendance records from
                // being created when an employee scans the biometric device after their
                // shift is over (e.g. shift 09:30–10:30, scan at 11:00).
                // OT scans are already handled by the Unified OT Gate above.
                if (resolvedShift && recordOts.length === 0) {
                    const [eH, eM] = resolvedShift.endTime.split(':').map(Number);
                    const shiftEndMs = dateOnly.getTime() + (eH * 60 + eM) * 60 * 1000;
                    // Handle overnight shifts where endTime < startTime
                    const [sH, sM] = resolvedShift.startTime.split(':').map(Number);
                    const shiftStartMs = dateOnly.getTime() + (sH * 60 + sM) * 60 * 1000;
                    const adjustedShiftEndMs = shiftEndMs <= shiftStartMs
                        ? shiftEndMs + 24 * 60 * 60 * 1000
                        : shiftEndMs;

                    if (log.timestamp.getTime() > adjustedShiftEndMs) {
                        await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                        continue;
                    }
                }
                // ── END POST-SHIFT GUARD ──────────────────────────────────────────────

                const empShift = resolvedShift ?? log.employee?.Shift ?? null;
                const calculatedStatus = calculateAttendanceStatus(log.timestamp, null, dateOnly, empShift);
                const isLate = calculatedStatus === 'late';
                const checkInStatus = isLate ? 'late' : 'present';

                // Calculate and persist initial metrics at check-in time.
                // undertimeMinutes / totalHours / isEarlyOut will be 0/false until checkout.
                const checkInMetrics = calculateAttendanceMetrics(
                    { date: dateOnly, checkInTime: log.timestamp, checkOutTime: null, status: checkInStatus },
                    empShift,
                    recordOts
                );

                try {
                    const createdRecord = await prisma.attendance.create({
                        data: {
                            employeeId: log.employeeId,
                            date: dateOnly,
                            shiftId: resolvedShift?.id ?? null,
                            checkInTime: log.timestamp,
                            status: checkInStatus,
                            checkInDeviceId: log.deviceId,
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

                    void audit({
                        action: 'CHECK_IN',
                        entityType: 'Attendance',
                        entityId: createdRecord.id,
                        performedBy: createdRecord.employeeId,
                        source: 'device-sync',
                        details: `Employee checked in (${isLate ? 'Late' : 'On-time'})`,
                        metadata: { snapshot: { status: createdRecord.status, checkInTime: createdRecord.checkInTime.toISOString() } }
                    });

                    const shift = createdRecord.employee?.Shift ?? null;
                    const metrics = calculateAttendanceMetrics(createdRecord, shift, recordOts);

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
                        console.debug(`[Attendance] Duplicate record skipped for employeeId=${log.employeeId} on ${dateOnly}`);
                        await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                        continue;
                    }
                    console.error(
                        `[Attendance] Failed to process check-in log id=${log.id} for employeeId=${log.employeeId} on ${dateOnly}:`,
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

                    const shiftDurationHours = resolvedShift 
                        ? (() => {
                            const [sH, sM] = resolvedShift.startTime.split(':').map(Number);
                            const [eH, eM] = resolvedShift.endTime.split(':').map(Number);
                            let duration = (eH + eM/60) - (sH + sM/60);
                            if (duration < 0) duration += 24;
                            return duration;
                        })()
                        : null;
                    const effectiveMinCheckout = shiftDurationHours ? Math.min(shiftDurationHours / 2, minCheckoutHours) : minCheckoutHours;

                    if (diffHours < effectiveMinCheckout) {
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
                            };

                            if (existingAttendance.status === 'incomplete') {
                                const empShift = resolvedShift ?? log.employee?.Shift ?? null;
                                updateData.status = calculateAttendanceStatus(existingAttendance.checkInTime, log.timestamp, existingAttendance.date, empShift);

                                if (existingAttendance.notes?.includes('No checkout recorded')) {
                                    updateData.notes = existingAttendance.notes.replace(/\s*\|?\s*No checkout recorded.*$/i, '') || null;
                                }
                            }

                            // Persist checkout metrics
                            const coShift1 = resolvedShift ?? log.employee?.Shift ?? null;
                            const coStatus1 = (updateData.status as string) ?? existingAttendance.status;
                            const coMetrics1 = calculateAttendanceMetrics(
                                { date: existingAttendance.date, checkInTime: existingAttendance.checkInTime, checkOutTime: log.timestamp, status: coStatus1 },
                                coShift1,
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

                            void audit({
                                action: 'CHECK_OUT',
                                entityType: 'Attendance',
                                entityId: updatedRecord.id,
                                performedBy: updatedRecord.employeeId,
                                source: 'device-sync',
                                details: `Employee checked out (updated)`,
                                metadata: { changes: [{ field: 'checkOutTime', oldValue: existingAttendance.checkOutTime ? existingAttendance.checkOutTime.toISOString() : null, newValue: log.timestamp.toISOString() }] }
                            });

                            const shift = updatedRecord.employee?.Shift ?? null;
                            const metrics = calculateAttendanceMetrics(updatedRecord, shift, recordOts);

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
                        };

                        if (existingAttendance.status === 'incomplete') {
                            const empShift = resolvedShift ?? log.employee?.Shift ?? null;
                            updateData.status = calculateAttendanceStatus(existingAttendance.checkInTime, log.timestamp, existingAttendance.date, empShift);

                            if (existingAttendance.notes?.includes('No checkout recorded')) {
                                updateData.notes = existingAttendance.notes.replace(/\s*\|?\s*No checkout recorded.*$/i, '') || null;
                            }
                        }

                        // Persist checkout metrics
                        const coShift2 = resolvedShift ?? log.employee?.Shift ?? null;
                        const coStatus2 = (updateData.status as string) ?? existingAttendance.status;
                        const coMetrics2 = calculateAttendanceMetrics(
                            { date: existingAttendance.date, checkInTime: existingAttendance.checkInTime, checkOutTime: log.timestamp, status: coStatus2 },
                            coShift2,
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

                        void audit({
                            action: 'CHECK_OUT',
                            entityType: 'Attendance',
                            entityId: updatedRecord2.id,
                            performedBy: updatedRecord2.employeeId,
                            source: 'device-sync',
                            details: `Employee checked out`,
                            metadata: { changes: [{ field: 'checkOutTime', oldValue: null, newValue: log.timestamp.toISOString() }] }
                        });

                        const shift2 = updatedRecord2.employee?.Shift ?? null;
                        const metrics2 = calculateAttendanceMetrics(updatedRecord2, shift2, recordOts);

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
