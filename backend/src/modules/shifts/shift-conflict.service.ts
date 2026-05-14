import { prisma } from '../../shared/lib/prisma';
import { SYNC_LIMITS } from '../system/system.constants';

export interface EmployeeConflict {
    employeeId: number;
    employeeName: string;
    conflictingShiftName: string;
    conflictingShiftTime: string;  // "8:00 - 12:00"
    editedShiftTime: string;       // "10:00 - 15:00"
    reason: string;                // 'overlap' | 'insufficient_gap'
    commonDays: string[];          // ["Mon", "Tue"]
}

export interface ShiftConflictReport {
    hasConflicts: boolean;
    conflicts: EmployeeConflict[];
    affectedEmployeeCount: number;
    hasAttendanceRecords: boolean;  // true if any attendance uses this shift
}

export interface ShiftPairConflict {
    hasConflict: boolean;
    reason: 'overlap' | 'insufficient_gap';
    commonDays: string[];
    gapValue?: number;
}

const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

const getIntervals = (startTime: string, endTime: string): number[][] => {
    const s = toMins(startTime);
    const e = toMins(endTime);
    if (e > s) return [[s, e]];        // Normal shift
    return [[s, 1440], [0, e]];         // Night shift wraps past midnight
};

const intervalsOverlap = (a: number[][], b: number[][]): boolean => {
    for (const [a1, a2] of a) {
        for (const [b1, b2] of b) {
            if (a1 < b2 && b1 < a2) return true;
        }
    }
    return false;
};

const getMinGap = (a: number[][], b: number[][]): number => {
    let minDistance = Infinity;
    // Check gap from every end-of-A to every start-of-B, and vice versa
    for (const [, a2] of a) {
        for (const [b1] of b) {
            let gap = b1 - a2;
            if (gap < 0) gap += 1440;
            minDistance = Math.min(minDistance, gap);
        }
    }
    for (const [, b2] of b) {
        for (const [a1] of a) {
            let gap = a1 - b2;
            if (gap < 0) gap += 1440;
            minDistance = Math.min(minDistance, gap);
        }
    }
    return minDistance;
};

const getWorkDaysArray = (workDaysJson: string | null | undefined): string[] => {
    if (!workDaysJson) return [];
    try { return JSON.parse(workDaysJson); } catch { return []; }
};

export function validateShiftPairConflict(
    shiftA: { name: string; startTime: string; endTime: string; workDays: string[] },
    shiftB: { name: string; startTime: string; endTime: string; workDays: string[] },
    minGapMinutes: number
): ShiftPairConflict | null {
    const commonDays = shiftA.workDays.filter((d: string) => shiftB.workDays.includes(d));

    // No overlapping work days → shifts can't conflict, skip this pair
    if (commonDays.length === 0) return null;

    const intervalsA = getIntervals(shiftA.startTime, shiftA.endTime);
    const intervalsB = getIntervals(shiftB.startTime, shiftB.endTime);

    // Block: time ranges overlap on shared days
    if (intervalsOverlap(intervalsA, intervalsB)) {
        return {
            hasConflict: true,
            reason: 'overlap',
            commonDays
        };
    }

    // Block: gap between shifts is less than configured minimum on shared days
    const gap = getMinGap(intervalsA, intervalsB);
    if (gap < minGapMinutes) {
        return {
            hasConflict: true,
            reason: 'insufficient_gap',
            commonDays,
            gapValue: gap
        };
    }

    return null;
}

export async function validateShiftGap(shiftIds: number[]): Promise<string | null> {
    if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length <= 1) return null;

    const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
    const minGap = syncConfig?.minShiftGapMinutes ?? SYNC_LIMITS.MIN_SHIFT_GAP_MIN;
    const shifts = await prisma.shift.findMany({ where: { id: { in: shiftIds } } });

    const orderedShifts = shiftIds.map((id: number) => shifts.find(s => s.id === id)).filter(Boolean);

    // Check every pair of shifts for conflicts on shared days
    for (let i = 0; i < orderedShifts.length; i++) {
        for (let j = i + 1; j < orderedShifts.length; j++) {
            const a = orderedShifts[i];
            const b = orderedShifts[j];
            if (!a || !b) continue;

            const shiftA = {
                name: a.name,
                startTime: a.startTime,
                endTime: a.endTime,
                workDays: getWorkDaysArray(a.workDays)
            };

            const shiftB = {
                name: b.name,
                startTime: b.startTime,
                endTime: b.endTime,
                workDays: getWorkDaysArray(b.workDays)
            };

            const conflict = validateShiftPairConflict(shiftA, shiftB, minGap);

            if (conflict) {
                if (conflict.reason === 'overlap') {
                    return `Shifts "${a.name}" and "${b.name}" have overlapping times on ${conflict.commonDays.join(', ')}`;
                } else if (conflict.reason === 'insufficient_gap') {
                    return `Minimum gap of ${minGap} minutes between "${a.name}" and "${b.name}" not met on ${conflict.commonDays.join(', ')} (gap: ${conflict.gapValue} mins)`;
                }
            }
        }
    }
    return null;
}

export async function validateShiftEditConflicts(
    shiftId: number,
    updatedConfig: { startTime: string; endTime: string; isNightShift: boolean; workDays: string[] }
): Promise<ShiftConflictReport> {
    const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
    const minGap = syncConfig?.minShiftGapMinutes ?? SYNC_LIMITS.MIN_SHIFT_GAP_MIN;

    // 1. Fetch all EmployeeShift records where shiftId matches, include employee
    const employeeShifts = await prisma.employeeShift.findMany({
        where: { shiftId },
        include: {
            employee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                }
            }
        }
    });

    const conflicts: EmployeeConflict[] = [];
    const affectedEmployeeIds = new Set<number>();

    const simulatedShift = {
        name: 'Edited Shift',
        startTime: updatedConfig.startTime,
        endTime: updatedConfig.endTime,
        workDays: updatedConfig.workDays
    };

    // 2. For each employee, get their other assigned shifts (exclude the shift being edited)
    for (const assignment of employeeShifts) {
        const otherAssignments = await prisma.employeeShift.findMany({
            where: {
                employeeId: assignment.employeeId,
                shiftId: { not: shiftId }
            },
            include: {
                shift: true
            }
        });

        if (otherAssignments.length === 0) continue;

        // 3. Compare simulated shift against each other shift
        for (const other of otherAssignments) {
            const otherShift = {
                name: other.shift.name,
                startTime: other.shift.startTime,
                endTime: other.shift.endTime,
                workDays: getWorkDaysArray(other.shift.workDays)
            };

            const conflict = validateShiftPairConflict(simulatedShift, otherShift, minGap);

            if (conflict) {
                conflicts.push({
                    employeeId: assignment.employee.id,
                    employeeName: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
                    conflictingShiftName: otherShift.name,
                    conflictingShiftTime: `${otherShift.startTime} - ${otherShift.endTime}`,
                    editedShiftTime: `${simulatedShift.startTime} - ${simulatedShift.endTime}`,
                    reason: conflict.reason,
                    commonDays: conflict.commonDays
                });
                affectedEmployeeIds.add(assignment.employee.id);
            }
        }
    }

    // 4. Check if any Attendance records reference this shiftId
    const attendanceCount = await prisma.attendance.count({
        where: { shiftId }
    });

    // 5. Return structured ShiftConflictReport
    return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        affectedEmployeeCount: affectedEmployeeIds.size,
        hasAttendanceRecords: attendanceCount > 0
    };
}
