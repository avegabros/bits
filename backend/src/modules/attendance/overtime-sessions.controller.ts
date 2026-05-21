import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { Prisma, AttendanceLog, Attendance } from '@prisma/client';
import { getPhtDateStr } from '../../shared/utils/date.utils';

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
            if (startDate) where.date.gte = new Date(startDate as string);
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
                where.date = { ...(typeof where.date === 'object' ? where.date : {}), gte: new Date(nowDateStr) };
            } else if (sessionState === 'ACTIVE') {
                where.actualStartTime = { not: null };
                where.actualEndTime = null;
                // typically date is today or recent, but strictly speaking:
                // we might not filter by date for ACTIVE if they forgot to clock out, but walkthru says:
                // ACTIVE: actualStartTime !== null AND actualEndTime === null, date can be anything but PARTIAL is past.
                where.date = { ...(typeof where.date === 'object' ? where.date : {}), gte: new Date(nowDateStr) };
            } else if (sessionState === 'COMPLETED') {
                where.actualStartTime = { not: null };
                where.actualEndTime = { not: null };
            } else if (sessionState === 'MISSED') {
                where.actualStartTime = null;
                where.date = { ...(typeof where.date === 'object' ? where.date : {}), lt: new Date(nowDateStr) };
            } else if (sessionState === 'PARTIAL') {
                where.actualStartTime = { not: null };
                where.actualEndTime = null;
                where.date = { ...(typeof where.date === 'object' ? where.date : {}), lt: new Date(nowDateStr) };
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
        let attendanceRecords: Pick<Attendance, 'id' | 'employeeId' | 'date'>[] = [];

        if (requests.length > 0) {
            const employeeIds = [...new Set(requests.map(r => r.employeeId))];
            const dates = [...new Set(requests.map(r => r.date))];

            const [logs, records] = await Promise.all([
                prisma.attendanceLog.findMany({
                    where: {
                        employeeId: { in: employeeIds },
                        timestamp: {
                            gte: new Date(Math.min(...dates.map(d => d.getTime()))),
                            lte: new Date(Math.max(...dates.map(d => d.getTime())) + 24 * 60 * 60 * 1000)
                        }
                    },
                    include: { Device: { select: { name: true } } }
                }),
                prisma.attendance.findMany({
                    where: {
                        employeeId: { in: employeeIds },
                        date: { in: dates }
                    },
                    select: { id: true, employeeId: true, date: true }
                })
            ]);
            attendanceLogs = logs;
            attendanceRecords = records;
        }

        const sessions = requests.map(req => {
            const reqDateStr = getPhtDateStr(req.date);
            const reqLogs = attendanceLogs.filter(log => 
                log.employeeId === req.employeeId && getPhtDateStr(log.timestamp) === reqDateStr
            );
            const checkInLog = reqLogs.find(l => l.status === 0 || l.status === 4);
            const checkOutLog = reqLogs.find(l => l.status === 1 || l.status === 5);
            const linkedAtt = attendanceRecords.find(a => a.employeeId === req.employeeId && getPhtDateStr(a.date) === reqDateStr);

            const approvedStartMin = timeStringToMinutes(req.startTime);
            const approvedEndMin = timeStringToMinutes(req.endTime);
            let approvedDurationMinutes = approvedEndMin - approvedStartMin;
            if (approvedDurationMinutes < 0) approvedDurationMinutes += 24 * 60;

            const actualStartMin = dateToMinutes(req.actualStartTime);
            const actualEndMin = dateToMinutes(req.actualEndTime);
            let actualDurationMinutes = 0;
            if (req.actualStartTime && req.actualEndTime) {
                actualDurationMinutes = actualEndMin - actualStartMin;
                if (actualDurationMinutes < 0) actualDurationMinutes += 24 * 60;
            }

            const now = new Date();

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
                actual: { startTime: req.actualStartTime, endTime: req.actualEndTime },
                actualDurationMinutes,
                approvedDurationMinutes,
                sessionState: computeSessionState(req, now),
                device: {
                    checkIn: checkInLog?.Device?.name || null,
                    checkOut: checkOutLog?.Device?.name || null
                },
                linkedAttendanceId: linkedAtt?.id || null,
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
