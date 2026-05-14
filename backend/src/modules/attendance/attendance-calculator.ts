import { Prisma } from '@prisma/client';
import { ATTENDANCE_LIMITS } from '../system/system.constants';
import { getTodayPHT, normalizeTime } from './attendance-utils';
import { BasicAttendanceRecord } from './attendance.types';

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
        const checkIn = normalizeTime(new Date(record.checkInTime));
        const checkOut = record.checkOutTime ? normalizeTime(new Date(record.checkOutTime)) : null;
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
    // We strictly follow the isNightShift flag, but also add a safety check
    // to prevent negative durations for legacy data or misconfigured shifts.
    if (shift.isNightShift && expectedEnd.getTime() <= expectedStart.getTime()) {
        expectedEnd = new Date(expectedEnd.getTime() + 24 * 60 * 60 * 1000);
    } else if (expectedEnd.getTime() <= expectedStart.getTime()) {
        // Fallback for legacy data where isNightShift might be false but times cross midnight
        // Adding 24h ensures duration is positive, but we should probably log this.
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

    const checkIn = normalizeTime(new Date(record.checkInTime));
    const checkOut = record.checkOutTime ? normalizeTime(new Date(record.checkOutTime)) : null;

    // Build the effective break windows for overlap calculation.
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
        if (checkOut.getTime() <= expectedStart.getTime()) {
            return {
                shiftCode, lateMinutes: 0, undertimeMinutes: parseFloat(fullExpectedMins.toFixed(1)),
                overtimeMinutes: 0, totalHours: 0, isAnomaly, isEarlyOut: true,
                isShiftActive: false, status: record.status, gracePeriodApplied: false,
                latePenaltyMinutes: 0, workedHours: 0
            };
        }

        const effectiveCheckIn = new Date(expectedStart.getTime() + lateMinutes * 60 * 1000);
        const rawWorkedMins = (checkOut.getTime() - effectiveCheckIn.getTime()) / 60000;
        
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
}

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
    const record = { 
        date, 
        checkInTime: normalizeTime(checkInTime), 
        checkOutTime: checkOutTime ? normalizeTime(checkOutTime) : null, 
        status: 'present' 
    };
    const metrics = calculateAttendanceMetrics(record as any, shift);
    
    if (!checkOutTime) return 'incomplete';
    if (metrics.lateMinutes > 0) return 'late';
    return 'present';
}
