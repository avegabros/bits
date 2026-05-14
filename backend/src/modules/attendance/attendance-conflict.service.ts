import { prisma } from '../../shared/lib/prisma';
import { normalizeTime } from './attendance-utils';
import { AttendanceConflict, AttendanceConflictReport } from './attendance.types';

/**
 * Format a Date to a human-readable PHT time string (e.g. "8:00 AM").
 * Used exclusively for conflict message display — NOT for calculations.
 */
function formatTimePHT(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}


/**
 * Check if two time windows overlap.
 * Windows are defined as [startA, endA] and [startB, endB] in epoch ms.
 * Overlap exists when max(startA, startB) < min(endA, endB).
 */
function windowsOverlap(
    startA: number, endA: number,
    startB: number, endB: number
): boolean {
    return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Validate attendance times against other records and shift boundaries.
 *
 * Used by:
 * - updateAttendance (editing existing record)
 * - createManualAttendance (creating new record)
 * - reviewAdjustment (approving pending adjustment)
 *
 * @param params.excludeAttendanceId - Exclude this record from overlap check (for edits)
 */
export async function validateAttendanceConflicts(params: {
    employeeId: number;
    date: Date;
    checkInTime: Date;
    checkOutTime: Date | null;
    excludeAttendanceId?: number;
}): Promise<AttendanceConflictReport> {
    const { employeeId, date, checkInTime, checkOutTime, excludeAttendanceId } = params;
    const conflicts: AttendanceConflict[] = [];

    const normalizedCheckIn = normalizeTime(checkInTime);
    const editStart = normalizedCheckIn.getTime();
    const editEnd = checkOutTime ? normalizeTime(checkOutTime).getTime() : null;

    const editStartStr = formatTimePHT(normalizedCheckIn);
    const editEndStr = checkOutTime ? formatTimePHT(normalizeTime(checkOutTime)) : 'pending';
    const editedTimeRange = `${editStartStr} – ${editEndStr}`;

    // ── 1. Overlap Detection ─────────────────────────────────────────────
    if (editEnd !== null) {
        const otherRecords = await prisma.attendance.findMany({
            where: {
                employeeId,
                date,
                ...(excludeAttendanceId ? { id: { not: excludeAttendanceId } } : {}),
            },
            include: { shift: { select: { name: true } } },
        });

        for (const record of otherRecords) {
            if (!record.checkOutTime) continue;

            const recStart = normalizeTime(record.checkInTime).getTime();
            const recEnd = normalizeTime(record.checkOutTime).getTime();

            if (windowsOverlap(editStart, editEnd, recStart, recEnd)) {
                const recStartStr = formatTimePHT(record.checkInTime);
                const recEndStr = formatTimePHT(record.checkOutTime);
                const shiftName = record.shift?.name ?? 'Unknown Shift';

                conflicts.push({
                    type: 'overlap',
                    conflictingRecordId: record.id,
                    conflictingShiftName: shiftName,
                    conflictingTimeRange: `${recStartStr} – ${recEndStr}`,
                    editedTimeRange,
                    message: `Attendance overlaps with existing ${shiftName} record (${recStartStr} – ${recEndStr}).`,
                });
            }
        }
    }


    return {
        hasConflicts: conflicts.length > 0,
        conflicts,
    };
}
