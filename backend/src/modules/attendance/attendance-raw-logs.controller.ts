import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { Prisma } from '@prisma/client';

export const getRawAttendanceLogs = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, employeeId } = req.query;

        const where: Prisma.AttendanceLogWhereInput = {};

        // Parse dates using PHT timezone (UTC+8) to match database storage behavior
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) {
                where.timestamp.gte = new Date(`${String(startDate)}T00:00:00+08:00`);
            }
            if (endDate) {
                where.timestamp.lte = new Date(`${String(endDate)}T23:59:59+08:00`);
            }
        }

        if (employeeId) {
            where.employeeId = parseInt(String(employeeId));
        }

        // Apply manager department scope filtering if present
        if (req.managerDepartmentIds && req.query.scope !== 'company') {
            where.employee = {
                departmentId: { in: req.managerDepartmentIds }
            };
        }

        const logs = await prisma.attendanceLog.findMany({
            where,
            orderBy: { timestamp: 'asc' }
        });

        res.json({
            success: true,
            data: logs
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Attendance] Get Raw Logs Failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve raw attendance logs.',
            error: errMsg
        });
    }
};
