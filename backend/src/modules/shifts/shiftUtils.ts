/**
 * Parses a string "HH:MM" into total minutes from midnight.
 */
function parseTimeStr(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

/**
 * Checks if a target total minutes (0-1439) falls inside a window [start, end].
 * Safely handles cross-midnight (e.g., start 23:00, end 01:00).
 */
function isMinuteInWindow(min: number, start: number, end: number): boolean {
    // Normalize to 0-1439
    start = (start + 1440) % 1440;
    end = (end + 1440) % 1440;
    
    if (start <= end) {
        // Normal window (e.g. 08:00 to 17:00 => 480 to 1020)
        return min >= start && min <= end;
    } else {
        // Cross-midnight window (e.g. 23:00 to 01:00 => 1380 to 60)
        return min >= start || min <= end;
    }
}

/**
 * Evaluates if the current time falls inside ANY active shift's "Peak Window".
 * A Peak Window is exactly `shiftBufferMinutes` before and after the shift's Start time,
 * and identically before and after the shift's End time. 
 * The middle of the shift is considered OFF-PEAK.
 * 
 * @param shifts Current active shifts 
 * @param shiftBufferMinutes The configured buffer
 * @returns true if currently in a PEAK rush hour window, false if OFF-PEAK
 */
export function isCurrentlyInPeakWindow(
    shifts: { startTime: string; endTime: string; workDays: string }[], 
    shiftBufferMinutes: number
): boolean {
    if (!shifts || shifts.length === 0) return false;

    // Get current day string matching DB format e.g. "Mon", "Tue"
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short' });
    
    // Calculate current minutes from midnight (Manila time)
    // Hacky way to safely get PHT hours without relying blindly on server's runtime timezone
    const phtStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false, hour: '2-digit', minute: '2-digit' });
    const currentMin = parseTimeStr(phtStr);

    for (const shift of shifts) {
        try {
            // Arrays in Prisma string column are stored as e.g. '["Mon", "Tue"]'
            const workDays: string[] = JSON.parse(shift.workDays);
            if (!workDays.includes(currentDay)) continue;

            const startMin = parseTimeStr(shift.startTime);
            const endMin = parseTimeStr(shift.endTime);

            // Dual Window brackets:
            // Morning Rush Window (Clock In)
            const inWindowStart = startMin - shiftBufferMinutes;
            const inWindowEnd = startMin + shiftBufferMinutes;

            // Evening Rush Window (Clock Out)
            const outWindowStart = endMin - shiftBufferMinutes;
            const outWindowEnd = endMin + shiftBufferMinutes;

            // Check if current minute sits in EITHER of these two dual-windows
            if (isMinuteInWindow(currentMin, inWindowStart, inWindowEnd)) {
                return true;
            }
            if (isMinuteInWindow(currentMin, outWindowStart, outWindowEnd)) {
                return true;
            }

        } catch (error) {
            console.error('[shiftUtils] Error parsing shift properties', error);
            // Skip broken shift records gracefully
            continue;
        }
    }

    return false;
}
