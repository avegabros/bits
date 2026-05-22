import { prisma } from '../../shared/lib/prisma';
import { auditBatch } from '../../shared/lib/auditHelpers';
import { ATTENDANCE_LIMITS } from '../system/system.constants';
import { getTodayPHT } from './attendance-utils';
import { recalculateAndPersistAttendanceMetrics } from './attendance-processor';

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
            include: { employee: { include: { Shift: true } }, shift: true }
        });

        if (incompleteRecords.length === 0) return 0;

        let flaggedCount = 0;

        for (const record of incompleteRecords) {
            const shift = record.shift ?? record.employee?.Shift;

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
                },
                shift: true
            }
        });

        if (incompleteRecords.length === 0) return 0;

        let count = 0;

        for (const record of incompleteRecords) {
            const shift = record.shift ?? record.employee?.Shift ?? null;

            let checkoutHour: number = ATTENDANCE_LIMITS.AUTO_CHECKOUT_FALLBACK_HOUR;
            let checkoutMin: number = 0;
            let shiftLabel = 'default (no shift assigned)';

            if (shift) {
                const [h, m] = shift.endTime.split(':').map(Number);
                checkoutHour = h;
                checkoutMin = m;
                shiftLabel = shift.name;
            }

            const checkoutBase = (shift?.isNightShift)
                ? new Date(record.date.getTime() + 24 * 60 * 60 * 1000)
                : new Date(record.date.getTime());

            const autoCheckoutTime = new Date(
                checkoutBase.getTime() +
                (checkoutHour * 60 + checkoutMin) * 60 * 1000
            );

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

            // Persist metrics locked to the record's assigned shift
            await recalculateAndPersistAttendanceMetrics(record.employeeId, record.date);

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
            include: { employee: { include: { Shift: true } }, shift: true }
        });

        if (records.length === 0) return 0;

        let flaggedCount = 0;

        for (const record of records) {
            const shift = record.shift ?? record.employee?.Shift;

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
