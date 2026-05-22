import { prisma } from '../../shared/lib/prisma';

/**
 * Normalizes a shift's start time for chronological sorting.
 * Shifts between 00:00 and 04:59 are treated as the end of the "business day"
 * and are shifted to the end for sorting purposes.
 * 
 * @param startTime "HH:mm" (24-hour format)
 * @returns normalized minutes from a standard boundary
 */
export function getNormalizedSortMinutes(startTime: string): number {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = (h * 60) + m;
    
    // Business day boundary: 05:00 AM (300 minutes)
    // Times before 05:00 AM are treated as late night shifts of the logical day
    if (totalMinutes < 300) {
        return totalMinutes + 1440; // Shift to end of the 24h cycle
    }
    return totalMinutes;
}

/**
 * Sorts an array of shifts chronologically based on their startTime.
 * Handles night shifts and cross-midnight overlaps by normalizing time
 * against a 05:00 AM business day boundary.
 * 
 * @param shifts Array of objects containing at least the startTime property
 * @returns Sorted array of shifts
 */
export function sortShiftsChronologically<T extends { startTime: string }>(shifts: T[]): T[] {
    // Create a new array to avoid mutating the original array during sort
    return [...shifts].sort((a, b) => {
        const minA = getNormalizedSortMinutes(a.startTime);
        const minB = getNormalizedSortMinutes(b.startTime);
        return minA - minB;
    });
}

/**
 * Resolves an array of shift IDs to their chronological order.
 * Fetches the shifts from the database, sorts them, and returns the ordered IDs.
 * 
 * @param shiftIds Array of shift IDs
 * @returns Promise resolving to the chronologically ordered array of shift IDs
 */
export async function getChronologicalShiftIds(shiftIds: number[]): Promise<number[]> {
    if (!shiftIds || shiftIds.length === 0) return [];

    // Filter out potential nulls/undefined/NaNs from bad input
    const validIds = shiftIds.filter(id => id != null && !isNaN(id));
    if (validIds.length === 0) return [];

    const shifts = await prisma.shift.findMany({
        where: { id: { in: validIds } },
        select: { id: true, startTime: true }
    });

    // If some shifts were deleted or invalid, we only sort the existing ones
    const sortedShifts = sortShiftsChronologically(shifts);
    
    return sortedShifts.map(s => s.id);
}
