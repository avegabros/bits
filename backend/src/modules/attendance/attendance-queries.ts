import { prisma } from '../../shared/lib/prisma';
import { Prisma } from '@prisma/client';
import { getTodayPHT, formatToPhilippineTime } from './attendance-utils';
import { calculateAttendanceMetrics } from './attendance-calculator';
import { AttendanceFilters } from './attendance.types';

/**
 * Get attendance records with filters
 */
export const getAttendanceRecords = async (filters: AttendanceFilters = {}, page: number = 1, limit: number = 10000) => {
    const where: Prisma.AttendanceWhereInput = {};

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

    // Branch / department filters — applied via nested employee relation
    const empConditions: Prisma.EmployeeWhereInput = {}
    if (filters.branchId) empConditions.branchId = filters.branchId

    if (filters.managerDepartmentIds) {
        if (filters.departmentId) {
            empConditions.departmentId = filters.managerDepartmentIds.includes(filters.departmentId) 
                ? filters.departmentId 
                : -1; // User requested a department they don't have access to
        } else {
            empConditions.departmentId = { in: filters.managerDepartmentIds };
        }
    } else if (filters.departmentId) {
        empConditions.departmentId = filters.departmentId;
    }

    if (Object.keys(empConditions).length > 0) {
        where.employee = empConditions;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
        prisma.attendance.count({ where }),
        prisma.attendance.findMany({
            where,
            include: {
                checkInDevice: { select: { name: true } },
                checkOutDevice: { select: { name: true } },
                shift: true,
                employee: {
                    include: {
                        Department: {
                            select: { name: true }
                        },
                        Branch: { select: { name: true } },
                        Shift: true
                    }
                },
                AttendanceAdjustment: {
                    where: { status: 'pending' },
                    select: { id: true }
                }
            },
            orderBy: [{ date: 'desc' }, { checkInTime: 'desc' }],
            skip,
            take: limit
        })
    ]);

    // Fetch approved overtime requests for the fetched records
    const employeeIds = [...new Set(records.map(r => r.employeeId))];
    
    // Build an array of possible date representations
    const dateValues = new Set<number>();
    records.forEach(r => {
        dateValues.add(r.date.getTime()); // The raw attendance date (e.g. 16:00 UTC)
        
        // The UTC midnight representation of the PHT date
        const phtDate = new Date(r.date.getTime() + 8 * 60 * 60 * 1000);
        const utcMidnight = new Date(Date.UTC(phtDate.getUTCFullYear(), phtDate.getUTCMonth(), phtDate.getUTCDate()));
        dateValues.add(utcMidnight.getTime());
    });
    const queryDates = Array.from(dateValues).map(ms => new Date(ms));

    const approvedOts = await prisma.overtimeRequest.findMany({
        where: {
            employeeId: { in: employeeIds },
            date: { in: queryDates },
            status: 'APPROVED'
        },
        select: {
            employeeId: true,
            date: true,
            startTime: true,
            endTime: true,
            actualStartTime: true,
            actualEndTime: true
        }
    });

    // Group OTs by employeeId + PHT Date String
    const getPhtDateStr = (d: Date) => {
        const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
        return pht.toISOString().slice(0, 10);
    };

    const otsByEmpAndDate = new Map<string, typeof approvedOts>();
    for (const ot of approvedOts) {
        const key = `${ot.employeeId}_${getPhtDateStr(ot.date)}`;
        const list = otsByEmpAndDate.get(key) || [];
        list.push(ot);
        otsByEmpAndDate.set(key, list);
    }

    // --- OT De-duplication ---
    // When an employee has multiple shifts on the same day (e.g. Half Morning + Half Afternoon),
    // each shift produces a separate attendance record with the same PHT date. Without de-duplication,
    // every record fetches the same approved OT list and computes overtime independently, causing
    // the OT minutes to be multiplied by the number of shifts. To fix this, we identify the
    // chronologically latest record per employee per day and only assign approved OTs to that record.
    const latestRecordIdMap = new Map<string, number>();
    const latestRecordTimeMap = new Map<string, number>();

    records.forEach(r => {
        if (!r.checkInTime) return;
        const key = `${r.employeeId}_${getPhtDateStr(r.date)}`;
        const timeMs = new Date(r.checkInTime).getTime();
        const existing = latestRecordTimeMap.get(key);
        if (existing === undefined || timeMs > existing) {
            latestRecordTimeMap.set(key, timeMs);
            latestRecordIdMap.set(key, r.id);
        }
    });

    // Enrich each record with shift-based calculations
    const data = records.map((record) => {
        const shift = record.shift ?? record.employee?.Shift ?? null;
        const finalStatus = record.status;

        const dateKey = `${record.employeeId}_${getPhtDateStr(record.date)}`;
        // Only the latest record for this employee+date gets approved OTs for calculation to prevent duplication
        const isLatestForDay = latestRecordIdMap.get(dateKey) === record.id;
        const recordOtsForCalc = isLatestForDay ? (otsByEmpAndDate.get(dateKey) || []) : [];

        const metrics = calculateAttendanceMetrics({ ...record, status: finalStatus }, shift, recordOtsForCalc);
        return {
            ...record,
            checkInDeviceName: record.checkInDevice?.name || null,
            checkOutDeviceName: record.checkOutDevice?.name || null,
            checkInTimePH: formatToPhilippineTime(record.checkInTime),
            checkOutTimePH: record.checkOutTime ? formatToPhilippineTime(record.checkOutTime) : null,
            isEarlyPunch: (record.notes ?? '').includes('Early punch'),
            isMissingCheckout: (record.notes ?? '').includes('No checkout recorded'),
            isEdited: !!(record.checkin_updated || record.checkout_updated),
            isPending: record.AttendanceAdjustment && record.AttendanceAdjustment.length > 0,
            ...metrics,
            approvedOts: otsByEmpAndDate.get(dateKey) || [],
        };
    });

    return { data, total };
};

/**
 * Get today's attendance
 */
export const getTodayAttendance = async () => {
    const todayStart = getTodayPHT();
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const result = await getAttendanceRecords({
        startDate: todayStart,
        endDate: todayEnd
    });
    return result.data;
};

/**
 * Get attendance history for a specific employee
 */
export const getEmployeeAttendanceHistory = async (
    employeeId: number,
    startDate?: Date,
    endDate?: Date
) => {
    const result = await getAttendanceRecords({
        employeeId,
        startDate,
        endDate
    });
    return result.data;
};

/**
 * Get today's raw attendance logs (individual scan events)
 * Returns each scan as a separate entry for a real-time activity feed
 */
export const getTodayLogs = async () => {
    const todayStart = getTodayPHT();
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const logs = await prisma.attendanceLog.findMany({
        where: {
            timestamp: {
                gte: todayStart,
                lt: todayEnd
            }
        },
        include: {
            employee: {
                include: {
                    Department: { select: { name: true } }
                }
            }
        },
        orderBy: { timestamp: 'desc' }
    });

    return logs.map((log) => ({
        id: log.id,
        employeeId: log.employeeId,
        timestamp: log.timestamp,
        timestampPH: formatToPhilippineTime(log.timestamp),
        employee: log.employee
    }));
};
