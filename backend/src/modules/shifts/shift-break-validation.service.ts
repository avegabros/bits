import { parseTimeStr } from './shiftUtils';

export interface BreakInput {
    from?: string;
    to?: string;
    start?: string;
    end?: string;
}

interface NormalizedBreak {
    startStr: string;
    endStr: string;
    startMins: number;
    endMins: number;
    relStart: number;
    relEnd: number;
    originalIdx: number;
}

/**
 * Centralized service for validating shift breaks.
 * Ensures breaks are formatted correctly, chronologically valid,
 * fall within shift boundaries, and do not overlap.
 */
export function validateShiftBreaks(
    shiftStartTime: string,
    shiftEndTime: string,
    breaks: BreakInput[]
): string | null {
    if (!Array.isArray(breaks) || breaks.length === 0) return null;

    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    
    // Fallback if shift times are invalid format
    if (!timeRegex.test(shiftStartTime) || !timeRegex.test(shiftEndTime)) {
        return 'Shift start and end times must be in H:MM or HH:MM format.';
    }

    const shiftStartMins = parseTimeStr(shiftStartTime);
    const shiftEndMins = parseTimeStr(shiftEndTime);

    const relativeTime = (mins: number) => {
        return (mins - shiftStartMins + 1440) % 1440;
    };

    let shiftDuration = relativeTime(shiftEndMins);
    if (shiftDuration === 0 && shiftStartMins !== shiftEndMins) {
        shiftDuration = 1440;
    } else if (shiftDuration === 0 && shiftStartMins === shiftEndMins) {
        // Zero duration shift
        return 'Shift duration cannot be zero.';
    }

    const normalizedBreaks: NormalizedBreak[] = [];

    for (let i = 0; i < breaks.length; i++) {
        const brk = breaks[i];
        const brkStart = (brk.from || brk.start || '').trim();
        const brkEnd = (brk.to || brk.end || '').trim();

        if (!brkStart || !brkEnd) {
            return 'Each break must have both a "from" and "to" time.';
        }

        if (!timeRegex.test(brkStart) || !timeRegex.test(brkEnd)) {
            return 'Break times must be in H:MM or HH:MM format (24-hour).';
        }

        const startMins = parseTimeStr(brkStart);
        const endMins = parseTimeStr(brkEnd);

        if (startMins === endMins) {
            return `Break "to" time (${brkEnd}) must be later than "from" time (${brkStart}).`;
        }

        const relStart = relativeTime(startMins);
        let relEnd = relativeTime(endMins);

        if (relEnd === 0 && startMins !== endMins) {
            relEnd = 1440; // Handles exactly matching a 24h shift boundary
        }

        if (relEnd <= relStart) {
            return `Break "to" time (${brkEnd}) must be later than "from" time (${brkStart}) within the shift schedule.`;
        }

        if (relStart > shiftDuration || relEnd > shiftDuration) {
            return `Break ${brkStart}–${brkEnd} must fall within the shift hours (${shiftStartTime}–${shiftEndTime}).`;
        }

        normalizedBreaks.push({
            startStr: brkStart,
            endStr: brkEnd,
            startMins,
            endMins,
            relStart,
            relEnd,
            originalIdx: i + 1
        });
    }

    // Overlap detection
    const sortedBreaks = [...normalizedBreaks].sort((a, b) => a.relStart - b.relStart);

    for (let i = 0; i < sortedBreaks.length - 1; i++) {
        const current = sortedBreaks[i];
        const next = sortedBreaks[i + 1];

        if (next.relStart < current.relEnd) {
            return `Break conflict detected: Break ${next.originalIdx} (${next.startStr} - ${next.endStr}) overlaps with Break ${current.originalIdx} (${current.startStr} - ${current.endStr}).`;
        }
    }

    return null;
}
