import { prisma } from '../../shared/lib/prisma';
import { Shift } from '@prisma/client';
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

            if (isCompleted) continue;

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

            if (normalizedTimestamp >= windowStart && normalizedTimestamp <= windowEnd) {
                if (needsCheckIn || needsCheckOut) {
                    windowMatches.push({ shift, needsCheckIn, needsCheckOut: !!needsCheckOut, distToStart, distToEnd });
                }
            }

            const minDist = Math.min(distToStart, distToEnd);
            if (minDist < fallbackMinDist) {
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

    const shiftsNeedingCheckout = assignments.filter(a => {
        const record = recordMap.get(a.shift.id);
        return record && !record.checkOutTime;
    });

    if (shiftsNeedingCheckout.length > 0) {
        const match = tryMatch(shiftsNeedingCheckout);
        if (match) return match;
    }

    const dayMatchingShifts = assignments.filter(a => {
        const workDays = getWorkDays(a.shift);
        return workDays.includes(currentDayName);
    });

    if (dayMatchingShifts.length > 0) {
        const match = tryMatch(dayMatchingShifts);
        if (match) return match;
    }

    const match = tryMatch(assignments);
    if (match) return match;

    let bestMatch: Shift | null = null;
    let minDistance = Infinity;
    for (const { shift } of assignments) {
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

            const existingAttendance = await prisma.attendance.findFirst({
                where: {
                    employeeId: log.employeeId,
                    date: dateOnly,
                    shiftId: resolvedShift?.id ?? null
                }
            });

            if (!existingAttendance) {
                const empShift = resolvedShift ?? log.employee?.Shift ?? null;
                const calculatedStatus = calculateAttendanceStatus(log.timestamp, null, dateOnly, empShift);
                const isLate = calculatedStatus === 'late';

                try {
                    const createdRecord = await prisma.attendance.create({
                        data: {
                            employeeId: log.employeeId,
                            date: dateOnly,
                            shiftId: resolvedShift?.id ?? null,
                            checkInTime: log.timestamp,
                            status: isLate ? 'late' : 'present',
                            checkInDeviceId: log.deviceId
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
                            if (recordOts && recordOts.length > 0) {
                                // There is an approved OT for today.
                                // Instead of stretching the normal shift's checkout time, 
                                // we route this scan to the OvertimeRequest actual execution fields.
                                const ot = recordOts[0];
                                
                                // If we already have an actualStartTime but no actualEndTime, this is the OT checkout
                                // If we already have both, we overwrite the actualEndTime
                                if (!ot.actualStartTime) {
                                    await prisma.overtimeRequest.update({
                                        where: { id: ot.id },
                                        data: { actualStartTime: log.timestamp }
                                    });
                                    ot.actualStartTime = log.timestamp;
                                    void audit({
                                        action: 'CHECK_IN',
                                        entityType: 'OvertimeRequest',
                                        entityId: ot.id,
                                        performedBy: log.employeeId,
                                        source: 'device-sync',
                                        details: `Employee biometric OT check-in`
                                    });
                                } else {
                                    // Minimum checkout gap for OT (cap at half the approved OT duration or global minCheckoutHours)
                                    const otCheckInTime = new Date(ot.actualStartTime);
                                    const otDiffMs = log.timestamp.getTime() - otCheckInTime.getTime();
                                    const otDiffHours = otDiffMs / (1000 * 60 * 60);

                                    const [sH, sM] = ot.startTime.split(':').map(Number);
                                    const [eH, eM] = ot.endTime.split(':').map(Number);
                                    let otDurationHours = (eH + eM/60) - (sH + sM/60);
                                    if (otDurationHours < 0) otDurationHours += 24;

                                    const effectiveOTMinCheckout = Math.min(otDurationHours / 2, minCheckoutHours);

                                    if (otDiffHours < effectiveOTMinCheckout) {
                                        await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                                        continue;
                                    }

                                    await prisma.overtimeRequest.update({
                                        where: { id: ot.id },
                                        data: { actualEndTime: log.timestamp }
                                    });
                                    ot.actualEndTime = log.timestamp;
                                    void audit({
                                        action: 'CHECK_OUT',
                                        entityType: 'OvertimeRequest',
                                        entityId: ot.id,
                                        performedBy: log.employeeId,
                                        source: 'device-sync',
                                        details: `Employee biometric OT check-out`
                                    });
                                }

                                await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                                continue;
                            }

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
                            const empShift = log.employee?.Shift;
                            if (empShift) {
                                const [startH, startM] = empShift.startTime.split(':').map(Number);
                                const grace = empShift.graceMinutes ?? 0;
                                const checkInPHT = new Date(existingAttendance.checkInTime.getTime() + 8 * 60 * 60 * 1000);
                                const checkInMins = checkInPHT.getUTCHours() * 60 + checkInPHT.getUTCMinutes();
                                updateData.status = checkInMins <= (startH * 60 + startM + grace) ? 'present' : 'late';
                            } else {
                                updateData.status = 'present';
                            }

                            if (existingAttendance.notes?.includes('No checkout recorded')) {
                                updateData.notes = existingAttendance.notes.replace(/\s*\|?\s*No checkout recorded.*$/i, '') || null;
                            }
                        }

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
