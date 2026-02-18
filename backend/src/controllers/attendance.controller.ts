import { Request, Response } from 'express';
import { syncZkData, addUserToDevice } from '../services/zkServices';
import {
    getAttendanceRecords,
    getTodayAttendance,
    getEmployeeAttendanceHistory
} from '../services/attendance.service';
import { prisma } from '../lib/prisma';


export const syncAttendance = async (req: Request, res: Response) => {
    try {
        console.log('Starting manual sync...');
        const result = await syncZkData();
        res.status(200).json(result);
    } catch (error: any) {
        console.error('Sync failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync with device',
            error: error.message
        });
    }
};

export const addUser = async (req: Request, res: Response) => {
    try {
        const { userId, name } = req.body;

        if (!userId || !name) {
            res.status(400).json({ success: false, message: 'userId and name are required' });
            return;
        }

        console.log(`Request to add employee: ${userId} - ${name}`);
        const result = await addUserToDevice(parseInt(userId), name);
        res.status(200).json(result);

    } catch (error: any) {
        console.error('Add Employee failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add employee to device',
            error: error.message
        });
    }
};

/**
 * Get attendance records with optional filters
 * Query params: startDate, endDate, employeeId, status
 */
export const getAttendance = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, employeeId, status, page = 1, limit = 10 } = req.query;

        const filters: any = {};

        if (startDate) filters.startDate = new Date(String(startDate));

        if (endDate) {
            const end = new Date(String(endDate));
            end.setHours(23, 59, 59, 999);
            filters.endDate = end;
        }
        if (employeeId) filters.employeeId = parseInt(String(employeeId));
        if (status) filters.status = String(status);

        const pageNum = parseInt(String(page));
        const limitNum = parseInt(String(limit));

        const { data, total } = await getAttendanceRecords(filters, pageNum, limitNum);

        res.json({
            success: true,
            data,
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error: any) {
        console.error('Get Attendance Failed:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch attendance records',
            error: error.message
        });
    }
};

/**
 * Get today's attendance
 */
export const getToday = async (req: Request, res: Response) => {
    try {
        const records = await getTodayAttendance();

        res.json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get attendance history for a specific employee
 */
export const getEmployeeHistory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const employeeId = parseInt(Array.isArray(id) ? id[0] : id);

        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid employee ID'
            });
        }

        const records = await getEmployeeAttendanceHistory(
            employeeId,
            startDate ? new Date(String(startDate)) : undefined,
            endDate ? new Date(String(endDate)) : undefined
        );

        res.json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};