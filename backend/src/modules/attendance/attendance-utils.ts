import { prisma } from '../../shared/lib/prisma';

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
export const getTodayPHT = (): Date => toPHTDate(new Date());

/**
 * Helper: Convert UTC date to Philippine Time string
 */
export function formatToPhilippineTime(utcDate: Date): string {
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
}
