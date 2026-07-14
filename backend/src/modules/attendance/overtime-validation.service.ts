import { prisma } from '../../shared/lib/prisma';
import { getPhtDateStr } from '../../shared/utils/date.utils';

export interface OTValidationError {
    code: 'PAST_DATE' | 'ZERO_DURATION' | 'EXCESSIVE_DURATION' | 'SHIFT_OVERLAP' | 'OT_OVERLAP' | 'ATTENDANCE_OVERLAP';
    message: string;
    details?: Record<string, unknown>;
}

export interface OTValidationResult {
    valid: boolean;
    errors: OTValidationError[];
}

export interface OTValidationParams {
    employeeId: number;
    date: Date;                   // The OT date (already parsed)
    startTime: string;            // HH:mm format
    endTime: string;              // HH:mm format
    excludeOvertimeId?: number;   // For edits — exclude self from overlap check
    excludeOvertimeIds?: number[]; // Multiple exclusions (e.g. self and original OT)
}

function timeStringToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}


/** Returns [startMin, endMin, durationMin, isCrossMidnight] */
function computeOTWindow(startTime: string, endTime: string): {
    startMin: number;
    endMin: number;
    durationMin: number;
    isCrossMidnight: boolean;
} {
    const startMin = timeStringToMinutes(startTime);
    const endMin = timeStringToMinutes(endTime);

    if (startMin === endMin) {
        return { startMin, endMin, durationMin: 0, isCrossMidnight: false };
    }

    const isCrossMidnight = startMin > endMin;
    const durationMin = isCrossMidnight
        ? (24 * 60 - startMin + endMin)
        : (endMin - startMin);

    return { startMin, endMin, durationMin, isCrossMidnight };
}

/**
 * Check if two time-of-day windows overlap.
 * Handles cross-midnight windows by splitting them into two segments.
 */
function timeWindowsOverlap(
    aStart: number, aEnd: number, aIsCrossMidnight: boolean,
    bStart: number, bEnd: number, bIsCrossMidnight: boolean
): boolean {
    // Normalize to segments: cross-midnight creates two segments [start, 1440] and [0, end]
    const segmentsA = aIsCrossMidnight
        ? [[aStart, 1440], [0, aEnd]]
        : [[aStart, aEnd]];
    const segmentsB = bIsCrossMidnight
        ? [[bStart, 1440], [0, bEnd]]
        : [[bStart, bEnd]];

    for (const [s1, e1] of segmentsA) {
        for (const [s2, e2] of segmentsB) {
            if (Math.max(s1, s2) < Math.min(e1, e2)) return true;
        }
    }
    return false;
}

/** Convert a UTC Date to minute-of-day in PHT */
function dateToMinutesPHT(d: Date): number {
    const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    return pht.getUTCHours() * 60 + pht.getUTCMinutes();
}

export async function validateOvertimeRequest(
    params: OTValidationParams
): Promise<OTValidationResult> {
    const errors: OTValidationError[] = [];
    const { employeeId, date, startTime, endTime, excludeOvertimeId } = params;

    // ── 1. Past-date check ───────────────────────────────────────────────
    const todayPHT = getPhtDateStr(new Date());
    const otDateStr = getPhtDateStr(date);
    if (otDateStr < todayPHT) {
        errors.push({
            code: 'PAST_DATE',
            message: `Cannot create overtime for a past date (${otDateStr}). Today is ${todayPHT}.`,
        });
        // Early return — no point checking further
        return { valid: false, errors };
    }

    // ── 2. Time range validation ─────────────────────────────────────────
    const otWindow = computeOTWindow(startTime, endTime);

    if (otWindow.durationMin === 0) {
        errors.push({
            code: 'ZERO_DURATION',
            message: 'Start time and end time cannot be the same.',
        });
        return { valid: false, errors };
    }

    const MAX_OT_DURATION_MINUTES = 16 * 60; // 16 hours
    if (otWindow.durationMin > MAX_OT_DURATION_MINUTES) {
        errors.push({
            code: 'EXCESSIVE_DURATION',
            message: `Overtime duration (${Math.round(otWindow.durationMin / 60)}h) exceeds maximum allowed (16h).`,
        });
        return { valid: false, errors };
    }

    // ── 3. Shift conflict check ──────────────────────────────────────────
    const employeeShifts = await prisma.employeeShift.findMany({
        where: { employeeId },
        include: { shift: true },
    });

    for (const es of employeeShifts) {
        if (!es.shift.isActive) continue;

        // Check if this shift applies to the OT date's day of week
        let workDays: string[] = [];
        try { workDays = JSON.parse(es.shift.workDays); } catch { /* ignore */ }

        const otDayOfWeek = new Date(date).toLocaleDateString('en-US', {
            weekday: 'short',
            timeZone: 'Asia/Manila',
        });
        if (workDays.length > 0 && !workDays.includes(otDayOfWeek)) continue;

        const shiftWindow = computeOTWindow(es.shift.startTime, es.shift.endTime);

        if (timeWindowsOverlap(
            otWindow.startMin, otWindow.endMin, otWindow.isCrossMidnight,
            shiftWindow.startMin, shiftWindow.endMin, shiftWindow.isCrossMidnight
        )) {
            errors.push({
                code: 'SHIFT_OVERLAP',
                message: `Overtime (${startTime}–${endTime}) overlaps with shift "${es.shift.name}" (${es.shift.startTime}–${es.shift.endTime}).`,
                details: { shiftId: es.shift.id, shiftName: es.shift.name },
            });
        }
    }

    // ── 4. Existing OT conflict check ────────────────────────────────────
    const excludeIds: number[] = [];
    if (params.excludeOvertimeId) excludeIds.push(params.excludeOvertimeId);
    if (params.excludeOvertimeIds) excludeIds.push(...params.excludeOvertimeIds);

    const existingOTs = await prisma.overtimeRequest.findMany({
        where: {
            employeeId,
            date,
            status: { in: ['APPROVED', 'PENDING'] },
            ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        },
    });

    for (const ot of existingOTs) {
        const existingWindow = computeOTWindow(ot.startTime, ot.endTime);

        if (timeWindowsOverlap(
            otWindow.startMin, otWindow.endMin, otWindow.isCrossMidnight,
            existingWindow.startMin, existingWindow.endMin, existingWindow.isCrossMidnight
        )) {
            errors.push({
                code: 'OT_OVERLAP',
                message: `Overtime (${startTime}–${endTime}) overlaps with existing OT request (${ot.startTime}–${ot.endTime}, status: ${ot.status}).`,
                details: { conflictingOtId: ot.id, status: ot.status },
            });
        }
    }

    // ── 5. Existing attendance conflict check ────────────────────────────
    const attendanceRecords = await prisma.attendance.findMany({
        where: { employeeId, date },
        include: { shift: { select: { name: true } } },
    });

    for (const att of attendanceRecords) {
        if (!att.checkOutTime || !att.checkInTime) continue; // Open or missing check-in — no definitive window

        const checkInMin = dateToMinutesPHT(att.checkInTime);
        const checkOutMin = dateToMinutesPHT(att.checkOutTime);
        const attIsCrossMidnight = checkInMin > checkOutMin;

        if (timeWindowsOverlap(
            otWindow.startMin, otWindow.endMin, otWindow.isCrossMidnight,
            checkInMin, checkOutMin, attIsCrossMidnight
        )) {
            errors.push({
                code: 'ATTENDANCE_OVERLAP',
                message: `Overtime overlaps with existing attendance record (${att.shift?.name || 'Unknown Shift'}).`,
                details: { attendanceId: att.id },
            });
        }
    }

    return { valid: errors.length === 0, errors };
}
