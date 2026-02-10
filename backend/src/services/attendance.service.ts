import { prisma } from '../lib/prisma';

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
}

/**
 * Process unprocessed attendance logs into Attendance records
 * This implements the toggle logic: check-in → check-out
 */
export const processAttendanceLogs = async (): Promise<ProcessResult> => {
    try {
        // Get all logs ordered by timestamp
        const logs = await prisma.attendanceLog.findMany({
            orderBy: { timestamp: 'asc' },
            include: { employee: true }
        });

        let created = 0;
        let updated = 0;

        for (const log of logs) {
            // Normalize date to midnight for grouping (e.g., 2026-02-10 08:30:00 → 2026-02-10 00:00:00)
            const dateOnly = new Date(log.timestamp);
            dateOnly.setHours(0, 0, 0, 0);

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
                await prisma.attendance.create({
                    data: {
                        employeeId: log.employeeId,
                        date: dateOnly,
                        checkInTime: log.timestamp,
                        status: 'present'
                    }
                });
                created++;
            } else {
                // Record exists. Check if this is a valid check-out or just a duplicate/early scan
                const checkInTime = new Date(existingAttendance.checkInTime);
                const logTime = new Date(log.timestamp);
                const diffMs = logTime.getTime() - checkInTime.getTime();
                const diffHours = diffMs / (1000 * 60 * 60); //for every 1000 milliseconds, it will be 1 second

                // RULE: User must be checked in for at least 2 hours before checking out
                if (diffHours < 2) {
                    // Too soon to check out - ignore this log
                    // This prevents accidental double-scans from closing the attendance
                    continue;
                }

                // If existing check-out exists, only update if this new log is LATER (user left later)
                if (existingAttendance.checkOutTime) {
                    if (log.timestamp > existingAttendance.checkOutTime) {
                        await prisma.attendance.update({
                            where: { id: existingAttendance.id },
                            data: {
                                checkOutTime: log.timestamp,
                                updatedAt: new Date()
                            }
                        });
                        updated++;
                    }
                } else {
                    // No check-out yet, and > 2 hours have passed -> Valid Check-Out
                    await prisma.attendance.update({
                        where: { id: existingAttendance.id },
                        data: {
                            checkOutTime: log.timestamp,
                            updatedAt: new Date()
                        }
                    });
                    updated++;
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
    } catch (error: any) {
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find all records before today with no check-out time
        const result = await prisma.attendance.updateMany({
            where: {
                date: { lt: today },
                checkOutTime: null
            },
            data: {
                status: 'incomplete',
                updatedAt: new Date()
            }
        });

        console.log(`[Attendance] Auto-closed ${result.count} incomplete records`);
        return result.count;
    } catch (error: any) {
        console.error('[Attendance] Error auto-closing records:', error);
        return 0;
    }
};

/**
 * Get attendance records with filters
 */
export const getAttendanceRecords = async (filters: AttendanceFilters = {}) => {
    const where: any = {};

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

    const records = await prisma.attendance.findMany({
        where,
        include: {
            employee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeNumber: true,
                    department: true,
                    position: true
                }
            }
        },
        orderBy: { date: 'desc' }
    });

    // Add Philippine Time formatted strings for easier reading
    return records.map((record) => ({
        ...record,
        checkInTimePH: formatToPhilippineTime(record.checkInTime),
        checkOutTimePH: record.checkOutTime ? formatToPhilippineTime(record.checkOutTime) : null
    }));
};

/**
 * Helper: Convert UTC date to Philippine Time string
 */
const formatToPhilippineTime = (utcDate: Date): string => {
    const phDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000)); // Add 8 hours
    return phDate.toLocaleString('en-PH', {
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await getAttendanceRecords({
        startDate: today,
        endDate: today
    });
};

/**
 * Get attendance history for a specific employee
 */
export const getEmployeeAttendanceHistory = async (
    employeeId: number,
    startDate?: Date,
    endDate?: Date
) => {
    return await getAttendanceRecords({
        employeeId,
        startDate,
        endDate
    });
};
