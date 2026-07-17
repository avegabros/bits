import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { Prisma, AttendanceLog, Attendance } from '@prisma/client';
import { getPhtDateStr } from '../../shared/utils/date.utils';
import { normalizeTime, toPHTDate } from './attendance-utils';

function computeSessionState(otRequest: { date: Date, actualStartTime: Date | null, actualEndTime: Date | null }, now: Date) {
    const otDateStr = getPhtDateStr(otRequest.date);
    const nowDateStr = getPhtDateStr(now);

    const isPast = otDateStr < nowDateStr;

    if (otRequest.actualStartTime && otRequest.actualEndTime) {
        return 'COMPLETED';
    }
    if (otRequest.actualStartTime && !otRequest.actualEndTime) {
        return isPast ? 'PARTIAL' : 'ACTIVE';
    }
    if (!otRequest.actualStartTime) {
        return isPast ? 'MISSED' : 'SCHEDULED';
    }
    return 'SCHEDULED';
}

function timeStringToMinutes(timeStr: string | null) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function dateToMinutes(d: Date | null) {
    if (!d) return 0;
    const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    return pht.getUTCHours() * 60 + pht.getUTCMinutes();
}

export const getOvertimeSessions = async (req: Request, res: Response) => {
    try {
        const { page: queryPage, limit: queryLimit, search, departmentId, startDate, endDate, sessionState } = req.query;

        const page = parseInt(queryPage as string, 10) || 1;
        const limit = Math.min(parseInt(queryLimit as string, 10) || 20, 100);
        const skip = (page - 1) * limit;

        const where: Prisma.OvertimeRequestWhereInput = {
            status: 'APPROVED'
        };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = toPHTDate(new Date(startDate as string));
            if (endDate) where.date.lte = new Date(endDate as string);
        }

        if (search) {
            const searchTerms = (search as string).trim().split(/\s+/);
            const nameConditions = searchTerms.map(term => ({
                OR: [
                    { firstName: { contains: term, mode: 'insensitive' as const } },
                    { lastName: { contains: term, mode: 'insensitive' as const } },
                ]
            }));
            where.employee = { AND: nameConditions };
        }

        if (departmentId) {
            where.employee = where.employee || {};
            where.employee.departmentId = parseInt(departmentId as string, 10);
        }

        if (req.user?.role === 'MANAGER' && req.managerDepartmentIds) {
            where.employee = where.employee || {};
            where.employee.departmentId = { in: req.managerDepartmentIds };
        }

        // Initially we cannot easily filter by sessionState at DB level because it's computed.
        // If there are many records, we fetch all approved OTs matching date and paginated? 
        // Wait, if we paginate BEFORE computing, filtering by computed state is hard.
        // For this task, we fetch and then compute, but since we are asked to paginate, we will just fetch 
        // using Prisma and then compute. Wait, if sessionState filter is required, we can construct Prisma queries 
        // corresponding to the session states if possible.
        // SCHEDULED: actualStartTime: null, date >= today
        // ACTIVE: actualStartTime: not null, actualEndTime: null
        // COMPLETED: actualStartTime: not null, actualEndTime: not null
        // MISSED: actualStartTime: null, date < today
        // PARTIAL: actualStartTime: not null, actualEndTime: null, date < today
        
        const nowDateStr = getPhtDateStr(new Date());

        if (sessionState) {
            if (sessionState === 'SCHEDULED') {
                where.actualStartTime = null;
                where.date = { ...(typeof where.date === 'object' ? where.date : {}), gte: toPHTDate(new Date(nowDateStr)) };
            } else if (sessionState === 'ACTIVE') {
                where.actualStartTime = { not: null };
                where.actualEndTime = null;
                // typically date is today or recent, but strictly speaking:
                // we might not filter by date for ACTIVE if they forgot to clock out, but walkthru says:
                // ACTIVE: actualStartTime !== null AND actualEndTime === null, date can be anything but PARTIAL is past.
                where.date = { ...(typeof where.date === 'object' ? where.date : {}), gte: toPHTDate(new Date(nowDateStr)) };
            } else if (sessionState === 'COMPLETED') {
                where.actualStartTime = { not: null };
                where.actualEndTime = { not: null };
            } else if (sessionState === 'MISSED') {
                where.actualStartTime = null;
                where.date = { ...(typeof where.date === 'object' ? where.date : {}), lt: toPHTDate(new Date(nowDateStr)) };
            } else if (sessionState === 'PARTIAL') {
                where.actualStartTime = { not: null };
                where.actualEndTime = null;
                where.date = { ...(typeof where.date === 'object' ? where.date : {}), lt: toPHTDate(new Date(nowDateStr)) };
            }
        }

        const [total, requests] = await Promise.all([
            prisma.overtimeRequest.count({ where }),
            prisma.overtimeRequest.findMany({
                where,
                skip,
                take: limit,
                include: {
                    employee: { select: { id: true, firstName: true, lastName: true, departmentId: true, profilePicture: true, Department: { select: { name: true } }, Branch: { select: { name: true } } } }
                },
                orderBy: { date: 'desc' }
            })
        ]);

        let attendanceLogs: (AttendanceLog & { Device: { name: string } | null })[] = [];
        let attendanceRecords: Pick<Attendance, 'id' | 'employeeId' | 'date' | 'checkInTime' | 'checkOutTime'>[] = [];

        if (requests.length > 0) {
            const employeeIds = [...new Set(requests.map((r: any) => r.employeeId))];
            const dates = [...new Set(requests.map((r: any) => r.date))];

            const [logs, records] = await Promise.all([
                prisma.attendanceLog.findMany({
                    where: {
                        employeeId: { in: employeeIds },
                        timestamp: {
                            gte: new Date(Math.min(...dates.map((d: any) => d.getTime()))),
                            lte: new Date(Math.max(...dates.map((d: any) => d.getTime())) + 24 * 60 * 60 * 1000)
                        }
                    },
                    include: { Device: { select: { name: true } } }
                }),
                prisma.attendance.findMany({
                    where: {
                        employeeId: { in: employeeIds },
                        date: { in: dates }
                    },
                    select: { id: true, employeeId: true, date: true, checkInTime: true, checkOutTime: true }
                })
            ]);
            attendanceLogs = logs;
            attendanceRecords = records;
        }

        const sessions = requests.map((req: any) => {
            const reqDateStr = getPhtDateStr(req.date);
            const reqLogs = attendanceLogs.filter((log: any) => 
                log.employeeId === req.employeeId && getPhtDateStr(log.timestamp) === reqDateStr
            );

            // Fetch all attendance records for this employee on this date
            const empAttRecords = attendanceRecords.filter((a: any) => a.employeeId === req.employeeId && getPhtDateStr(a.date) === reqDateStr);

            // Compute approved OT window in UTC ms
            const dateMs = new Date(req.date).getTime();
            const [otStartH, otStartM] = req.startTime.split(':').map(Number);
            const [otEndH, otEndM] = req.endTime.split(':').map(Number);

            const otStartMs = dateMs + (otStartH * 60 + otStartM) * 60 * 1000 - 8 * 60 * 60 * 1000;
            let otEndMs = dateMs + (otEndH * 60 + otEndM) * 60 * 1000 - 8 * 60 * 60 * 1000;
            if (otEndMs <= otStartMs) otEndMs += 24 * 60 * 60 * 1000;

            // Find the attendance record with the best overlap with the OT window
            let bestOverlapAtt: any = null;
            let maxOverlapMs = 0;

            for (const att of empAttRecords) {
                if (!att.checkInTime) continue;
                const checkInMs = normalizeTime(new Date(att.checkInTime)).getTime();
                const checkOutMs = att.checkOutTime ? normalizeTime(new Date(att.checkOutTime)).getTime() : null;

                // If check-out is null (active shift), we temporarily use current time for overlap calculation
                const effectiveCheckOutMs = checkOutMs || Date.now();
                const overlapStart = Math.max(checkInMs, otStartMs);
                const overlapEnd = Math.min(effectiveCheckOutMs, otEndMs);

                const overlapMs = overlapEnd - overlapStart;
                if (overlapMs > maxOverlapMs) {
                    maxOverlapMs = overlapMs;
                    bestOverlapAtt = att;
                } else if (!bestOverlapAtt && checkInMs < otEndMs && (checkOutMs === null || checkOutMs > otStartMs)) {
                    // Fallback to match an active or overlapping record even if the overlap duration calculation is 0
                    bestOverlapAtt = att;
                }
            }

            // Derive actual OT start/end from the best overlapping attendance record
            let actualStartTime: Date | null = null;
            let actualEndTime: Date | null = null;

            if (bestOverlapAtt) {
                const checkInMs = normalizeTime(new Date(bestOverlapAtt.checkInTime)).getTime();
                const checkOutMs = bestOverlapAtt.checkOutTime ? normalizeTime(new Date(bestOverlapAtt.checkOutTime)).getTime() : null;

                // Clamp actual times to the approved OT window
                actualStartTime = new Date(Math.max(checkInMs, otStartMs));
                if (checkOutMs !== null) {
                    actualEndTime = new Date(Math.min(checkOutMs, otEndMs));
                }
            }

            // Match device logs by timestamp proximity (within 1s) for accurate device name resolution,
            // then fall back to status codes as a secondary signal.
            const checkInLog = actualStartTime
                ? (reqLogs.find((l: any) => Math.abs(l.timestamp.getTime() - actualStartTime!.getTime()) < 1000)
                    || reqLogs.find((l: any) => l.status === 0 || l.status === 4))
                : null;
            const checkOutLog = actualEndTime
                ? (reqLogs.find((l: any) => Math.abs(l.timestamp.getTime() - actualEndTime!.getTime()) < 1000)
                    || reqLogs.find((l: any) => l.status === 1 || l.status === 5))
                : null;

            const approvedStartMin = timeStringToMinutes(req.startTime);
            const approvedEndMin = timeStringToMinutes(req.endTime);
            let approvedDurationMinutes = approvedEndMin - approvedStartMin;
            if (approvedDurationMinutes < 0) approvedDurationMinutes += 24 * 60;

            let actualDurationMinutes = 0;
            if (actualStartTime && actualEndTime) {
                actualDurationMinutes = Math.round((actualEndTime.getTime() - actualStartTime.getTime()) / 60000);
            }

            const now = new Date();
            const computedRequest = {
                ...req,
                actualStartTime,
                actualEndTime
            };

            return {
                id: req.id,
                employee: {
                    id: req.employee.id,
                    firstName: req.employee.firstName,
                    lastName: req.employee.lastName,
                    department: req.employee.Department?.name || 'No Dept',
                    branch: req.employee.Branch?.name || 'No Branch',
                    profilePicture: req.employee.profilePicture
                },
                date: reqDateStr,
                approved: { startTime: req.startTime, endTime: req.endTime },
                actual: { startTime: actualStartTime, endTime: actualEndTime },
                actualDurationMinutes,
                approvedDurationMinutes,
                sessionState: computeSessionState(computedRequest, now),
                device: {
                    checkIn: checkInLog?.Device?.name || null,
                    checkOut: checkOutLog?.Device?.name || null
                },
                linkedAttendanceId: bestOverlapAtt?.id || null,
                source: req.source,
                reason: req.reason
            };
        });

        res.json({
            success: true,
            sessions,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching overtime sessions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch overtime sessions' });
    }
};
