import { prisma } from '../../shared/lib/prisma';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import attendanceEmitter from '../../shared/events/attendanceEmitter';
import { audit } from '../../shared/lib/auditLogger';
import { auditBatch } from '../../shared/lib/auditHelpers';
import { ATTENDANCE_LIMITS } from '../system/system.constants';

/**
 * Helper: Fetch all holidays within a date range and return a Set of
 * date strings (YYYY-MM-DD) for O(1) lookup during report generation.
 */
export async function getHolidaySetForRange(startDate: Date, endDate: Date): Promise<Set<string>> {
    const holidays = await prisma.holiday.findMany({
        where: { date: { gte: startDate, lte: endDate } }
    });
    return new Set(holidays.map(h => h.date.toISOString().split('T')[0]));
}

/**
 * Attendance Service - Strategy C (Grace Period Toggle)
 * 
 * This service processes raw AttendanceLog records into clean Attendance check-in/check-out pairs.
 * 
 * Logic:
 * - First scan of the day → Create new Attendance record with checkInTime
 * - Second scan of the day → Update same record with checkOutTime
 * - Midnight cleanup → Mark incomplete records from previous days
 */

/**
 * Convert a UTC timestamp to its Philippine calendar date, stored as UTC.
 * e.g. 7 AM PHT Feb 28 (= 11 PM UTC Feb 27) → PHT midnight Feb 28 (= 4 PM UTC Feb 27)
 * This ensures scans between 12 AM–8 AM PHT are grouped under the correct PHT date.
 */
export const toPHTDate = (utcDate: Date): Date => {
    // Shift to PHT (+8 hours)
    const pht = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    // Zero out time to get PHT midnight (still represented as UTC internally)
    pht.setUTCHours(0, 0, 0, 0);
    // Shift back to UTC: PHT midnight = UTC - 8 hours
    return new Date(pht.getTime() - 8 * 60 * 60 * 1000);
};

/** Get "today" in Philippine Time, returned as UTC equivalent of PHT midnight */
const getTodayPHT = (): Date => toPHTDate(new Date());

interface ProcessResult {
    success: boolean;
    processed: number;
    created: number;
    updated: number;
}

interface AttendanceFilters {
    startDate?: Date;
    endDate?: Date;
    employeeId?: number;
    status?: string;
    branchId?: number;        // filter by employee.branchId (FK)
    departmentId?: number;    // filter by employee.departmentId (FK)
}

/**
 * Process unprocessed attendance logs into Attendance records
 * This implements the toggle logic: check-in → check-out
 */
export const processAttendanceLogs = async (): Promise<ProcessResult> => {
    try {
        // Only process logs from the last 2 days — records older than that are
        // already settled (check-in + check-out completed) and re-processing them
        // on every 30-second cron tick wastes DB I/O and can cause duplicates.
        const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

        // Get recent logs ordered by timestamp
        const logs = await prisma.attendanceLog.findMany({
            where: { 
                timestamp: { gte: cutoff },
                processedAt: null // Fix #3: Only process logs that haven't been synced to an Attendance record
            },
            orderBy: { timestamp: 'asc' },
            include: { employee: { include: { Shift: true } } }
        });

        // Fetch System settings for dynamic constraints
        const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
        const minCheckoutMins = syncConfig?.globalMinCheckoutMinutes ?? 120;
        const minCheckoutHours = minCheckoutMins / 60;

        let created = 0;
        let updated = 0;

        for (const log of logs) {
            // Normalize to Philippine calendar date for consistent grouping
            const dateOnly = toPHTDate(log.timestamp);

            // Check if attendance record exists for this employee on this date
            const existingAttendance = await prisma.attendance.findUnique({
                where: {
                    employeeId_date: {
                        employeeId: log.employeeId,
                        date: dateOnly
                    }
                }
            });

            if (!existingAttendance) {
                // No record exists → This is a CHECK-IN
                // Determine if late using centralized SHIFT-AWARE logic
                const empShift = log.employee?.Shift ?? null;
                const calculatedStatus = calculateAttendanceStatus(log.timestamp, null, dateOnly, empShift);
                const isLate = calculatedStatus === 'late';

                try {
                    const createdRecord = await prisma.attendance.create({
                        data: {
                            employeeId: log.employeeId,
                            date: dateOnly,
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
                    const metrics = calculateAttendanceMetrics(createdRecord, shift);

                    // Notify SSE subscribers that a new check-in has been processed.
                    // Fire-and-forget — if no subscribers exist the event is dropped.
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

                    // Mark log as successfully processed
                    await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                } catch (err: unknown) {
                    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
                        // Duplicate record — silently skip, this is expected behavior
                        console.debug(`[Attendance] Duplicate record skipped for employeeId=${log.employeeId} on ${dateOnly}`);
                        await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                        continue;
                    }
                    // Unexpected error on this individual log — log full context and advance to the
                    // next log rather than re-throwing. Re-throwing would abort the entire batch,
                    // leaving all subsequent logs unprocessed (orphaned) for this tick.
                    // Fix #1 ensures processAttendanceLogs() is retried on the next tick, so this
                    // log will be re-evaluated automatically without requiring a second punch.
                    console.error(
                        `[Attendance] Failed to process check-in log id=${log.id} for employeeId=${log.employeeId} on ${dateOnly}:`,
                        err
                    );
                    continue;
                }
            } else {
                try {
                    // Record exists. Check if this is a valid check-out or just a duplicate/early scan
                    const checkInTime = new Date(existingAttendance.checkInTime);
                const logTime = new Date(log.timestamp);
                const diffMs = logTime.getTime() - checkInTime.getTime();
                const diffHours = diffMs / (1000 * 60 * 60); //for every 1000 milliseconds, it will be 1 second

                // RULE: User must be checked in for at least the configured minimum hours before checking out
                if (diffHours < minCheckoutHours) {
                    // Too soon to check out - ignore this log
                    // This prevents accidental double-scans from closing the attendance
                    await prisma.attendanceLog.update({ where: { id: log.id }, data: { processedAt: new Date() } });
                    continue;
                }

                // If existing check-out exists, only update if this new log is LATER (user left later)
                if (existingAttendance.checkOutTime) {
                    if (log.timestamp > existingAttendance.checkOutTime) {
                        const updateData: Record<string, unknown> = {
                            checkOutTime: log.timestamp,
                            updatedAt: new Date(),
                            checkOutDeviceId: log.deviceId,
                            checkoutSource: 'device',
                        };

                        if (existingAttendance.status === 'incomplete') {
                            const empShift = log.employee?.Shift ?? null;
                            updateData.status = calculateAttendanceStatus(existingAttendance.checkInTime, log.timestamp, existingAttendance.date, empShift);

                            if (existingAttendance.notes?.includes('No checkout recorded')) {
                                updateData.notes = existingAttendance.notes.replace(/\s*\|?\s*No checkout recorded.*$/i, '') || null;
                            }

                            console.log(
                                `[Attendance] Self-healed: employee ${existingAttendance.employeeId} ` +
                                `record restored from 'incomplete' to '${updateData.status}' via delayed device scan`
                            );
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
                        const metrics = calculateAttendanceMetrics(updatedRecord, shift);

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

                        console.log(
                            `[Attendance] Self-healed: employee ${existingAttendance.employeeId} ` +
                            `record restored from 'incomplete' to '${updateData.status}' via delayed device scan`
                        );
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
                    const metrics2 = calculateAttendanceMetrics(updatedRecord2, shift2);

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

                // Mark log as successfully processed for all checkout paths
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

/**
 * Auto-close incomplete attendance records from previous days
 * Runs at midnight to mark forgotten check-outs
 */
export const autoCloseIncompleteAttendance = async (): Promise<number> => {
    try {
        const today = getTodayPHT();

        const incompleteRecords = await prisma.attendance.findMany({
            where: {
                date: { lt: today },
                checkOutTime: null,
                checkoutSource: null,
                status: { not: 'incomplete' }
            },
            include: { employee: { include: { Shift: true } } }
        });

        if (incompleteRecords.length === 0) return 0;

        let flaggedCount = 0;

        for (const record of incompleteRecords) {
            const shift = record.employee?.Shift;

            if (shift?.isNightShift) {
                const [endH, endM] = shift.endTime.split(':').map(Number);
                const recordDateMs = record.date.getTime() + 8 * 60 * 60 * 1000;
                const shiftEndAbsolute = new Date(
                    recordDateMs + 24 * 60 * 60 * 1000
                    + (endH * 60 + endM) * 60 * 1000
                    - 8 * 60 * 60 * 1000
                );
                if (Date.now() < shiftEndAbsolute.getTime()) {
                    continue;
                }
            }

            const existingNotes = record.notes || '';
            const flagNote = 'No checkout recorded \u2014 please review and adjust manually';
            const newNotes = existingNotes
                ? `${existingNotes} | ${flagNote}`
                : flagNote;

            await prisma.attendance.update({
                where: { id: record.id },
                data: {
                    status: 'incomplete',
                    notes: newNotes,
                    updatedAt: new Date()
                }
            });
            flaggedCount++;
        }

        if (flaggedCount > 0) {
            void auditBatch({
                action: 'FLAG_MISSING_CHECKOUT',
                entityType: 'System',
                source: 'cron',
                details: `Flagged ${flaggedCount} incomplete records (no checkout) for manual review`
            }, {
                affectedCount: flaggedCount,
                summary: `Flagged ${flaggedCount} incomplete attendance records for manual review.`
            });
        }

        console.log(`[Attendance] Flagged ${flaggedCount} incomplete records (no checkout) for manual review`);
        return flaggedCount;
    } catch (error: unknown) {
        console.error('[Attendance] Error flagging incomplete records:', error);
        return 0;
    }
};

/**
 * Auto-checkout employees who haven't manually checked out
 * Runs at 11:59 PM and uses each employee's assigned shift end time.
 * Falls back to 5:00 PM for employees without an assigned shift.
 * Night shifts correctly check out on the next calendar day.
 */
export const autoCheckoutEmployees = async (): Promise<number> => {
    try {
        const today = getTodayPHT();

        const incompleteRecords = await prisma.attendance.findMany({
            where: {
                date: today,
                checkOutTime: null,
            },
            include: {
                employee: {
                    include: { Shift: true }
                }
            }
        });

        if (incompleteRecords.length === 0) return 0;

        let count = 0;

        for (const record of incompleteRecords) {
            const shift = record.employee?.Shift ?? null;

            let checkoutHour: number = ATTENDANCE_LIMITS.AUTO_CHECKOUT_FALLBACK_HOUR;
            let checkoutMin: number = 0;
            let shiftLabel = 'default (no shift assigned)';

            if (shift) {
                const [h, m] = shift.endTime.split(':').map(Number);
                checkoutHour = h;
                checkoutMin = m;
                shiftLabel = shift.name;
            }

            // For night shifts, the end time belongs to the NEXT calendar day.
            // Push the base forward by 24 hours before adding the end time hours.
            const checkoutBase = (shift?.isNightShift)
                ? new Date(record.date.getTime() + 24 * 60 * 60 * 1000)
                : new Date(record.date.getTime());

            const autoCheckoutTime = new Date(
                checkoutBase.getTime() +
                (checkoutHour * 60 + checkoutMin) * 60 * 1000
            );

            // Safety guard: never write a checkout that is at or before check-in.
            // This can happen with misconfigured shift data or very late check-ins.
            if (autoCheckoutTime <= record.checkInTime) {
                console.warn(
                    `[Attendance] Auto-checkout skipped for employee ${record.employeeId} ` +
                    `on ${record.date.toISOString().split('T')[0]} — calculated checkout ` +
                    `(${autoCheckoutTime.toISOString()}) is before or equal to check-in ` +
                    `(${record.checkInTime.toISOString()}). Needs manual correction.`
                );
                continue;
            }

            await prisma.attendance.update({
                where: { id: record.id },
                data: {
                    checkOutTime: autoCheckoutTime,
                    notes: `Auto checkout — estimated shift end (${shiftLabel})`,
                    updatedAt: new Date()
                }
            });

            count++;
            console.log(
                `[Attendance] Auto-checkout set for employee ${record.employeeId} ` +
                `at ${autoCheckoutTime.toISOString()} (${shiftLabel})`
            );
        }

        if (count > 0) {
            void auditBatch({
                action: 'AUTO_CHECKOUT',
                entityType: 'System',
                source: 'cron',
                details: `Auto-checkout applied to ${count} records`
            }, {
                affectedCount: count,
                summary: `Automatically checked out ${count} employees.`
            });
        }

        console.log(
            `[Attendance] Auto-checkout completed: ${count} processed, ` +
            `${incompleteRecords.length - count} skipped.`
        );
        return count;
    } catch (error: unknown) {
        console.error('[Attendance] Error during auto-checkout:', error);
        return 0;
    }
};

/**
 * Startup Repair: Fix any missing checkouts from previous days
 * This ensures that if the server was off at 11:59 PM, the records are fixed on next startup.
 * Uses each employee's assigned shift end time; falls back to 5:00 PM.
 */
export const repairMissingCheckouts = async (): Promise<number> => {
    try {
        const today = getTodayPHT();

        const records = await prisma.attendance.findMany({
            where: {
                date: { lt: today },
                checkOutTime: null,
                checkoutSource: null,
                status: { not: 'incomplete' }
            },
            include: { employee: { include: { Shift: true } } }
        });

        if (records.length === 0) return 0;

        let flaggedCount = 0;

        for (const record of records) {
            const shift = record.employee?.Shift;

            if (shift?.isNightShift) {
                const [endH, endM] = shift.endTime.split(':').map(Number);
                const recordDateMs = record.date.getTime() + 8 * 60 * 60 * 1000;
                const shiftEndAbsolute = new Date(
                    recordDateMs + 24 * 60 * 60 * 1000
                    + (endH * 60 + endM) * 60 * 1000
                    - 8 * 60 * 60 * 1000
                );
                if (Date.now() < shiftEndAbsolute.getTime()) {
                    continue;
                }
            }

            const existingNotes = record.notes || '';
            const flagNote = 'No checkout recorded \u2014 please review and adjust manually';
            const newNotes = existingNotes
                ? `${existingNotes} | ${flagNote}`
                : flagNote;

            await prisma.attendance.update({
                where: { id: record.id },
                data: {
                    status: 'incomplete',
                    notes: newNotes,
                    updatedAt: new Date()
                }
            });

            flaggedCount++;
            console.log(
                `[Attendance] Startup flag: employee ${record.employeeId} ` +
                `on ${record.date.toISOString().split('T')[0]} — no checkout, flagged for review`
            );
        }

        if (flaggedCount > 0) {
            void auditBatch({
                action: 'FLAG_MISSING_CHECKOUT',
                entityType: 'System',
                source: 'startup-repair',
                details: `Startup: Flagged ${flaggedCount} records with missing checkouts for manual review`
            }, {
                affectedCount: flaggedCount,
                summary: `Startup repair: Flagged ${flaggedCount} incomplete attendance records for manual review.`
            });
        }

        console.log(
            `[Attendance] Startup repair complete: flagged ${flaggedCount} records for review`
        );
        return flaggedCount;

    } catch (error: unknown) {
        console.error('[Attendance] Error during startup repair:', error);
        return 0;
    }
};

/**
 * Get attendance records with filters
 */
export const getAttendanceRecords = async (filters: AttendanceFilters = {}, page: number = 1, limit: number = 10000) => {
    const where: Prisma.AttendanceWhereInput = {};

    if (filters.startDate || filters.endDate) {
        where.date = {};
        if (filters.startDate) where.date.gte = filters.startDate;
        if (filters.endDate) where.date.lte = filters.endDate;
    }

    if (filters.employeeId) {
        where.employeeId = filters.employeeId;
    }

    if (filters.status) {
        where.status = filters.status;
    }

    // Branch / department filters — applied via nested employee relation
    const empConditions: Prisma.EmployeeWhereInput = {}
    if (filters.branchId) empConditions.branchId = filters.branchId

    if (filters.departmentId) {
        if (Object.keys(empConditions).length > 0) {
            where.employee = { ...empConditions, departmentId: filters.departmentId }
        } else {
            where.employee = { departmentId: filters.departmentId }
        }
    } else if (Object.keys(empConditions).length > 0) {
        where.employee = empConditions
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
        prisma.attendance.count({ where }),
        prisma.attendance.findMany({
            where,
            include: {
                checkInDevice: { select: { name: true } },
                checkOutDevice: { select: { name: true } },
                employee: {
                    include: {
                        Department: {
                            select: { name: true }
                        },
                        Branch: { select: { name: true } },
                        Shift: true
                    }
                },
                AttendanceAdjustment: {
                    where: { status: 'pending' },
                    select: { id: true }
                }
            },
            orderBy: [{ date: 'desc' }, { checkInTime: 'desc' }],
            skip,
            take: limit
        })
    ]);

    // Enrich each record with shift-based calculations
    const data = records.map((record) => {
        const shift = record.employee?.Shift ?? null;
        let finalStatus = record.status;
        if (finalStatus === 'pending') {
            finalStatus = record.checkInTime 
                ? calculateAttendanceStatus(record.checkInTime, record.checkOutTime, record.date, shift)
                : 'absent';
        }

        const metrics = calculateAttendanceMetrics({ ...record, status: finalStatus }, shift);
        return {
            ...record,
            checkInDeviceName: record.checkInDevice?.name || null,
            checkOutDeviceName: record.checkOutDevice?.name || null,
            checkInTimePH: formatToPhilippineTime(record.checkInTime),
            checkOutTimePH: record.checkOutTime ? formatToPhilippineTime(record.checkOutTime) : null,
            isEarlyPunch: (record.notes ?? '').includes('Early punch'),
            isMissingCheckout: (record.notes ?? '').includes('No checkout recorded'),
            isEdited: !!(record.checkin_updated || record.checkout_updated),
            isPending: record.AttendanceAdjustment && record.AttendanceAdjustment.length > 0,
            ...metrics,
        };
    });

    return { data, total };
};

interface BasicAttendanceRecord {
    date: Date;
    checkInTime: Date | null;
    checkOutTime: Date | null;
    status: string | null;
}

/**
 * Calculate attendance metrics based on an employee's assigned Shift
 * All times are stored as UTC where PHT midnight = UTC midnight offset by -8h
 * i.e. a stored timestamp of 2026-02-10T00:00:00Z represents 2026-02-10T08:00:00+08:00 PHT midnight workaround
 */
export function calculateAttendanceMetrics(record: BasicAttendanceRecord, shift: Prisma.ShiftGetPayload<{}> | null) {
    const shiftCode = shift?.shiftCode ?? null;

    if (!record.checkInTime) {
        return { 
            shiftCode: null, lateMinutes: 0, overtimeMinutes: 0, undertimeMinutes: 0, 
            totalHours: 0, isAnomaly: false, isEarlyOut: false, isShiftActive: false, 
            status: record.status, gracePeriodApplied: false, latePenaltyMinutes: 0, workedHours: 0 
        };
    }

    if (!shift) {
        // No shift assigned – fall back to a generic 8-hour day
        const checkIn = new Date(record.checkInTime);
        const checkOut = record.checkOutTime ? new Date(record.checkOutTime) : null;
        const totalMs = checkOut ? checkOut.getTime() - checkIn.getTime() : 0;
        const totalHours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(2));
        const expectedHours = ATTENDANCE_LIMITS.DEFAULT_EXPECTED_HOURS;
        const overtime = Math.max(0, totalHours - expectedHours);
        const undertime = totalHours > 0 ? Math.max(0, expectedHours - totalHours) : 0;

        // Late: after default shift start PHT
        const checkInPHT = new Date(checkIn.getTime() + 8 * 60 * 60 * 1000);
        const lateMinutes = Math.max(0, checkInPHT.getUTCHours() * 60 + checkInPHT.getUTCMinutes() - ATTENDANCE_LIMITS.DEFAULT_SHIFT_START_HOUR * 60);

        // Anomaly: Tap in is more than threshold away from default shift start
        const ANOMALY_THRESHOLD_MINS = ATTENDANCE_LIMITS.ANOMALY_THRESHOLD_MINS;
        const diffMins = Math.abs(checkInPHT.getUTCHours() * 60 + checkInPHT.getUTCMinutes() - ATTENDANCE_LIMITS.DEFAULT_SHIFT_START_HOUR * 60);
        const isAnomaly = diffMins > ANOMALY_THRESHOLD_MINS;

        const today = getTodayPHT();
        const recordDateStr = new Date(record.date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const todayStr = new Date(today.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const isToday = recordDateStr === todayStr;
        const isShiftActive = !!record.checkInTime && !record.checkOutTime && isToday && record.status !== 'pending';
        const status = isShiftActive ? "IN_PROGRESS" : record.status;

        return { 
            shiftCode: null, 
            lateMinutes, 
            overtimeMinutes: parseFloat((overtime * 60).toFixed(1)), 
            undertimeMinutes: parseFloat((undertime * 60).toFixed(1)), 
            totalHours, 
            isAnomaly, 
            isEarlyOut: false,
            isShiftActive,
            status,
            gracePeriodApplied: false,
            latePenaltyMinutes: lateMinutes,
            workedHours: totalHours
        };
    }

    // --- Shift-aware calculation ---
    // record.date is "PHT midnight stored as UTC" e.g. 2026-02-10T16:00:00.000Z = Feb 11 00:00 PHT
    // We add 8h to get back to the actual PHT calendar date's midnight UTC representation usable for Date math
    const dateMs = new Date(record.date).getTime() + 8 * 60 * 60 * 1000; // PHT midnight in ms

    // Parse shift start/end ("HH:MM" 24-hour)
    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [endH, endM] = shift.endTime.split(':').map(Number);

    // Build expected check-in / check-out as UTC timestamps on that PHT date
    // Formula: PHT midnight (ms) + hours*3600000 - 8*3600000 (to convert PHT back to UTC)
    const expectedStart = new Date(dateMs + (startH * 60 + startM) * 60 * 1000 - 8 * 60 * 60 * 1000);
    let expectedEnd = new Date(dateMs + (endH * 60 + endM) * 60 * 1000 - 8 * 60 * 60 * 1000);

    // Night shift: end time is next day
    if (shift.isNightShift && endH < startH) {
        expectedEnd = new Date(expectedEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    // Check if it's a half-day (adjust expected end time to halfway between start and end)
    let halfDays: string[] = [];
    try { halfDays = JSON.parse(shift.halfDays || '[]'); } catch { }
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const phtDate = new Date(new Date(record.date).getTime() + 8 * 60 * 60 * 1000);
    const dayName = dayNames[phtDate.getUTCDay()];
    const isHalfDay = halfDays.includes(dayName);

    // Parse explicit breaks
    let explicitBreaks: { start: Date, end: Date }[] = [];
    try {
        const parsedBreaks = JSON.parse(shift.breaks || '[]');
        explicitBreaks = parsedBreaks.map((b: { start: string; end: string }) => {
            const [bhStart, bmStart] = b.start.split(':').map(Number);
            const [bhEnd, bmEnd] = b.end.split(':').map(Number);
            
            let bStart = new Date(dateMs + (bhStart * 60 + bmStart) * 60 * 1000 - 8 * 60 * 60 * 1000);
            let bEnd = new Date(dateMs + (bhEnd * 60 + bmEnd) * 60 * 1000 - 8 * 60 * 60 * 1000);
            
            if (shift.isNightShift && bhStart < startH) bStart = new Date(bStart.getTime() + 24 * 60 * 60 * 1000);
            if (shift.isNightShift && bhEnd < startH) bEnd = new Date(bEnd.getTime() + 24 * 60 * 60 * 1000);

            return { start: bStart, end: bEnd };
        });
    } catch (e) { }

    let calculatedBreakMins = 0;
    if (explicitBreaks.length > 0) {
        explicitBreaks.forEach(b => {
             calculatedBreakMins += (b.end.getTime() - b.start.getTime()) / 60000;
        });
    }

    if (isHalfDay) {
        if (shift.halfDayHours != null && shift.halfDayHours > 0) {
            // Configurable: expected work = exactly halfDayHours from shift start
            expectedEnd = new Date(expectedStart.getTime() + shift.halfDayHours * 60 * 60 * 1000);
        } else {
            // Automatic fallback: midpoint between start and full end
            const halfMs = (expectedEnd.getTime() - expectedStart.getTime()) / 2;
            expectedEnd = new Date(expectedStart.getTime() + halfMs);
        }
    }

    // Full expected shift duration (minutes), without break
    const fullShiftMins = (expectedEnd.getTime() - expectedStart.getTime()) / (1000 * 60);

    const checkIn = new Date(record.checkInTime);
    const checkOut = record.checkOutTime ? new Date(record.checkOutTime) : null;

    // Build the effective break windows for overlap calculation.
    // When explicit break ranges are defined → use them directly.
    // When only breakMinutes is set (no ranges) → synthesize a virtual
    // break window centered at the shift midpoint. This avoids the old
    // all-or-nothing threshold and instead only deducts the actual time
    // the employee's presence overlapped with the break window.
    let effectiveBreaks = explicitBreaks;
    if (!isHalfDay && explicitBreaks.length === 0 && (shift.breakMinutes ?? 0) > 0) {
        const shiftMidMs = expectedStart.getTime() + (expectedEnd.getTime() - expectedStart.getTime()) / 2;
        const halfBreakMs = ((shift.breakMinutes ?? 60) / 2) * 60 * 1000;
        effectiveBreaks = [{ start: new Date(shiftMidMs - halfBreakMs), end: new Date(shiftMidMs + halfBreakMs) }];
    }

    const rawBreakMins = isHalfDay ? 0 : effectiveBreaks.reduce((sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 60000, 0);

    // Late: actual check-in minus (expected start + grace)
    const graceMins = shift.graceMinutes ?? 0;
    const lateMs = checkIn.getTime() - (expectedStart.getTime() + graceMins * 60 * 1000);
    // Use Math.floor instead of Math.round. This truncates seconds completely.
    // E.g., being late by 120 minutes and 59 seconds evaluates strictly to 120 minutes.
    const lateMinutes = Math.max(0, Math.floor(lateMs / 60000));

    // Expected net worked minutes (after break deduction)
    const fullExpectedMins = fullShiftMins - rawBreakMins;

    // Anomaly: Tap in is more than threshold away from expected shift start
    const ANOMALY_THRESHOLD_MINS = ATTENDANCE_LIMITS.ANOMALY_THRESHOLD_MINS;
    const diffFromExpectedMins = Math.abs(Math.round((checkIn.getTime() - expectedStart.getTime()) / (1000 * 60)));
    const isAnomaly = diffFromExpectedMins > ANOMALY_THRESHOLD_MINS;

    // Total Hours = (checkOut - effectiveCheckIn) - break overlap, floored at 0
    let totalHours = 0;
    let undertimeMinutes = 0;
    let overtimeMinutes = 0;
    let isEarlyOut = false;

    if (checkOut) {
        // GUARD: If employee checked out BEFORE their shift even started,
        // they did not work any shift hours.
        if (checkOut.getTime() <= expectedStart.getTime()) {
            return {
                shiftCode, lateMinutes: 0, undertimeMinutes: parseFloat(fullExpectedMins.toFixed(1)),
                overtimeMinutes: 0, totalHours: 0, isAnomaly, isEarlyOut: true,
                isShiftActive: false, status: record.status, gracePeriodApplied: false,
                latePenaltyMinutes: 0, workedHours: 0
            };
        }

        // The grace period protects the employee from deductions until the threshold is crossed.
        // To ensure absolute consistency across lateMinutes, undertimeMinutes, and totalHours,
        // regular hour deductions at the start of the shift MUST exactly match the late penalty.
        // - If within grace: lateMinutes = 0 -> effectiveCheckIn = expectedStart
        // - If beyond grace: lateMinutes = X -> effectiveCheckIn = expectedStart + X mins
        const effectiveCheckIn = new Date(expectedStart.getTime() + lateMinutes * 60 * 1000);
        const rawWorkedMins = (checkOut.getTime() - effectiveCheckIn.getTime()) / 60000;
        
        // Calculate exact break time that overlaps with the attended period.
        // Only the portion of the break window that the employee was actually
        // present for gets deducted — this is "break-window encroachment".
        let overlappingBreakMins = 0;
        if (!isHalfDay) {
            effectiveBreaks.forEach(b => {
                const overlapStart = Math.max(effectiveCheckIn.getTime(), b.start.getTime());
                const overlapEnd = Math.min(checkOut.getTime(), b.end.getTime());
                if (overlapEnd > overlapStart) {
                    overlappingBreakMins += (overlapEnd - overlapStart) / 60000;
                }
            });
        }

        const workedMins = Math.max(0, rawWorkedMins - overlappingBreakMins);
        totalHours = parseFloat((workedMins / 60).toFixed(2));

        // Undertime: missed time strictly after checkout until expectedEnd
        let missingMins = 0;
        if (checkOut.getTime() < expectedEnd.getTime()) {
            const missingBlockStart = Math.max(checkOut.getTime(), expectedStart.getTime());
            const rawMissingMins = (expectedEnd.getTime() - missingBlockStart) / 60000;
            
            // Subtract any break time that falls within the missed block,
            // so employees aren't penalised for the break they would have taken.
            let missingBreakMins = 0;
            if (!isHalfDay) {
                effectiveBreaks.forEach(b => {
                    const overlapStart = Math.max(missingBlockStart, b.start.getTime());
                    const overlapEnd = Math.min(expectedEnd.getTime(), b.end.getTime());
                    if (overlapEnd > overlapStart) {
                        missingBreakMins += (overlapEnd - overlapStart) / 60000;
                    }
                });
            }
            missingMins = Math.max(0, rawMissingMins - missingBreakMins);
        }
        // Force truncation of any fractional seconds to prevent petty 1-min deductions
        undertimeMinutes = Math.floor(missingMins);

        // Overtime: employee stayed beyond expected end
        const actualEndMs = checkOut.getTime();
        const expectedEndMs = expectedEnd.getTime();
        const otMs = Math.max(0, actualEndMs - expectedEndMs);
        overtimeMinutes = parseFloat((otMs / (1000 * 60)).toFixed(1));
    }

    const today = getTodayPHT();
    const recordDateStr = new Date(record.date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayStr = new Date(today.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const isToday = recordDateStr === todayStr;
    const isShiftActive = !!checkIn && !checkOut && isToday && record.status !== 'pending';
    const status = isShiftActive ? "IN_PROGRESS" : record.status;
    const gracePeriodApplied = checkIn.getTime() > expectedStart.getTime() && lateMinutes === 0;

    return { 
        shiftCode, 
        lateMinutes, 
        undertimeMinutes, 
        overtimeMinutes, 
        totalHours, 
        isAnomaly, 
        isEarlyOut,
        isShiftActive,
        status,
        gracePeriodApplied,
        latePenaltyMinutes: lateMinutes,
        workedHours: totalHours
    };
};

/**
 * Shared wrapper around calculateAttendanceMetrics to determine the final status.
 * Used consistently across biometric sync, manual creation, and adjustment approvals.
 */
export function calculateAttendanceStatus(
    checkInTime: Date,
    checkOutTime: Date | null,
    date: Date,
    shift: Prisma.ShiftGetPayload<{}> | null
): string {
    const record = { date, checkInTime, checkOutTime, status: 'present' };
    const metrics = calculateAttendanceMetrics(record as any, shift);
    
    if (!checkOutTime) return 'incomplete';
    if (metrics.lateMinutes > 0) return 'late';
    return 'present';
}

/**
 * Helper: Convert UTC date to Philippine Time string
 */
export function formatToPhilippineTime(utcDate: Date): string {
    // Just use toLocaleString with timeZone option. 
    // The input utcDate is already a valid Date object (UTC).
    return utcDate.toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

/**
 * Get today's attendance
 */
export const getTodayAttendance = async () => {
    const todayStart = getTodayPHT();
    // End of today = start of tomorrow minus 1ms
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const result = await getAttendanceRecords({
        startDate: todayStart,
        endDate: todayEnd
    });
    return result.data;
};

/**
 * Get attendance history for a specific employee
 */
export const getEmployeeAttendanceHistory = async (
    employeeId: number,
    startDate?: Date,
    endDate?: Date
) => {
    const result = await getAttendanceRecords({
        employeeId,
        startDate,
        endDate
    });
    return result.data;
};

/**
 * Get today's raw attendance logs (individual scan events)
 * Returns each scan as a separate entry for a real-time activity feed
 */
export const getTodayLogs = async () => {
    const todayStart = getTodayPHT();
    // End of today in PHT: PHT midnight + 24 hours
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const logs = await prisma.attendanceLog.findMany({
        where: {
            timestamp: {
                gte: todayStart,
                lt: todayEnd
            }
        },
        include: {
            employee: {
                include: {
                    Department: { select: { name: true } }
                }
            }
        },
        orderBy: { timestamp: 'desc' }
    });

    return logs.map((log) => ({
        id: log.id,
        employeeId: log.employeeId,
        timestamp: log.timestamp,
        timestampPH: formatToPhilippineTime(log.timestamp),
        employee: log.employee
    }));
};
