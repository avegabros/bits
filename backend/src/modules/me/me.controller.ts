import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import bcrypt from 'bcryptjs';
import attendanceEmitter from '../../shared/events/attendanceEmitter';
import { calculateAttendanceMetrics, formatToPhilippineTime } from '../attendance/attendance.service';

// Get logged-in manager's assigned departments
export const getMyDepartments = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user?.employeeId) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }

        const employeeId = req.user.employeeId;

        // Verify the user is a MANAGER
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { role: true }
        });

        if (!employee || employee.role !== 'MANAGER') {
            res.status(403).json({ success: false, message: 'Only managers have assigned departments' });
            return;
        }

        const assignments = await prisma.managerDepartment.findMany({
            where: { managerId: employeeId },
            include: { department: { select: { id: true, name: true } } }
        });

        res.status(200).json({
            success: true,
            departments: assignments.map(a => a.department)
        });
    } catch (error: unknown) {
        console.error('getMyDepartments error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch departments', error: error instanceof Error ? error.message : String(error) });
    }
};

// Get logged-in employee's own attendance records
export const getMyAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user?.employeeId) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }

        const employeeId = req.user.employeeId;
        const { startDate, endDate } = req.query;

        let dateFilter: { gte?: Date; lte?: Date } = {};

        if (startDate && endDate) {
            // Use PHT (UTC+8) boundaries: subtract 8 hours from PHT midnight to get the correct UTC time
            dateFilter = {
                gte: new Date(`${startDate}T00:00:00.000+08:00`),
                lte: new Date(`${endDate}T23:59:59.999+08:00`),
            };
        }

        const records = await prisma.attendance.findMany({
            where: {
                employeeId,
                ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
            },
            include: {
                checkInDevice: { select: { name: true } },
                checkOutDevice: { select: { name: true } },
                shift: { select: { name: true, shiftCode: true, startTime: true, endTime: true } },
                employee: {
                    include: {
                        Shift: true,
                        EmployeeShift: {
                            include: { shift: true },
                            orderBy: { sortOrder: 'asc' }
                        }
                    }
                }
            },
            orderBy: { date: 'desc' },
        });

        const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
        const minCheckoutMins = syncConfig?.globalMinCheckoutMinutes ?? 120;
        const minCheckoutHours = minCheckoutMins / 60;

        const dateValues = new Set(records.map(r => r.date.getTime()));
        const queryDates = Array.from(dateValues).map(ms => new Date(ms));

        let otDateQuery: any = { in: queryDates };
        if (startDate && endDate) {
            otDateQuery = {
                gte: new Date(`${startDate}T00:00:00.000+08:00`),
                lte: new Date(`${endDate}T23:59:59.999+08:00`),
            };
        }

        const approvedOts = await prisma.overtimeRequest.findMany({
            where: {
                employeeId,
                date: otDateQuery,
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

        // --- OT De-duplication for employee portal ---
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
        const enrichedData = records.map((record) => {
            const shift = record.employee?.Shift ?? null;
            const dateKey = `${record.employeeId}_${getPhtDateStr(record.date)}`;

            // Only the latest record for this employee+date gets approved OTs for calculations to prevent duplication
            const isLatestForDay = latestRecordIdMap.get(dateKey) === record.id;
            const recordOtsForCalc = isLatestForDay ? (otsByEmpAndDate.get(dateKey) || []) : [];

            const metrics = calculateAttendanceMetrics(record, shift, recordOtsForCalc);

            let minCheckoutTime: Date | null = null;
            if (record.checkInTime) {
                const checkInTime = new Date(record.checkInTime);
                const shiftDurationHours = record.shift 
                    ? (() => {
                        const [sH, sM] = record.shift.startTime.split(':').map(Number);
                        const [eH, eM] = record.shift.endTime.split(':').map(Number);
                        let duration = (eH + eM/60) - (sH + sM/60);
                        if (duration < 0) duration += 24;
                        return duration;
                    })()
                    : null;
                const effectiveMinCheckout = shiftDurationHours 
                    ? Math.min(shiftDurationHours / 2, minCheckoutHours) 
                    : minCheckoutHours;
                minCheckoutTime = new Date(checkInTime.getTime() + effectiveMinCheckout * 60 * 60 * 1000);
            }

            return {
                ...record,
                checkInDeviceName: record.checkInDevice?.name || null,
                checkOutDeviceName: record.checkOutDevice?.name || null,
                checkInAuthMethod: record.checkInAuthMethod || null,
                checkOutAuthMethod: record.checkOutAuthMethod || null,
                shiftName: record.shift?.name || null,
                checkInTimePH: formatToPhilippineTime(record.checkInTime),
                checkOutTimePH: record.checkOutTime ? formatToPhilippineTime(record.checkOutTime) : null,
                ...metrics,
                approvedOts: otsByEmpAndDate.get(dateKey) || [],
                minCheckoutTime
            };
        });

        res.status(200).json({ success: true, count: enrichedData.length, data: enrichedData, approvedOts });
    } catch (error: unknown) {
        console.error('getMyAttendance error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance records', error: error instanceof Error ? error.message : String(error) });
    }
};

// Get logged-in employee's assigned shift
export const getMyShift = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user?.employeeId) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }

        const employee = await prisma.employee.findUnique({
            where: { id: req.user.employeeId },
            include: { 
                Shift: true,
                EmployeeShift: {
                    include: { shift: true },
                    orderBy: { sortOrder: 'asc' }
                }
            },
        });

        if (!employee) {
            res.status(404).json({ success: false, message: 'Employee not found' });
            return;
        }

        const shifts = employee.EmployeeShift.length > 0 ? employee.EmployeeShift.map(es => es.shift) : employee.Shift ? [employee.Shift] : [];

        res.status(200).json({ success: true, shift: shifts[0] || null, shifts });
    } catch (error: unknown) {
        console.error('getMyShift error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch shift details', error: error instanceof Error ? error.message : String(error) });
    }
};

// Get logged-in employee's profile
export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user?.employeeId) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }

        const employee = await prisma.employee.findUnique({
            where: { id: req.user.employeeId },
            select: {
                id: true,
                zkId: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                departmentId: true,
                Department: { select: { name: true } },
                position: true,
                branchId: true,
                Branch: { select: { name: true } },
                contactNumber: true,
                employeeNumber: true,
                hireDate: true,
                employmentStatus: true,
                needsPasswordChange: true,
                profilePicture: true,
                createdAt: true,
            },
        });

        if (!employee) {
            res.status(404).json({ success: false, message: 'Employee not found' });
            return;
        }

        res.status(200).json({ success: true, profile: employee });
    } catch (error: unknown) {
        console.error('getMyProfile error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error instanceof Error ? error.message : String(error) });
    }
};

// Change logged-in employee's password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user?.employeeId) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            res.status(400).json({ success: false, message: 'Current and new passwords are required' });
            return;
        }

        const employee = await prisma.employee.findUnique({
            where: { id: req.user.employeeId },
        });

        if (!employee || !employee.password) {
            res.status(400).json({ success: false, message: 'Account does not have a password set' });
            return;
        }

        const isMatch = await bcrypt.compare(currentPassword, employee.password);
        if (!isMatch) {
            res.status(400).json({ success: false, message: 'Incorrect current password' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
            return;
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await prisma.employee.update({
            where: { id: employee.id },
            data: { password: hashedNewPassword, needsPasswordChange: false },
        });

        res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error: unknown) {
        console.error('changePassword error:', error);
        res.status(500).json({ success: false, message: 'Failed to change password', error: error instanceof Error ? error.message : String(error) });
    }
};

/**
 * GET /api/me/attendance/stream
 * Server-Sent Events endpoint for the logged-in employee's own real-time attendance updates.
 */
export const streamMyAttendance = async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.employeeId) {
        res.status(401).end();
        return;
    }

    const currentEmployeeId = req.user.employeeId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.flushHeaders();

    res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

    const heartbeatInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 25_000);

    const onNewRecord = (payload: { type: string; record: { employeeId?: number } }) => {
        // Only forward events belonging to the logged-in employee
        if (payload.record?.employeeId === currentEmployeeId) {
            res.write(`event: attendance\ndata: ${JSON.stringify(payload)}\n\n`);
        }
    };

    attendanceEmitter.on('new-record', onNewRecord);

    req.on('close', () => {
        clearInterval(heartbeatInterval);
        attendanceEmitter.off('new-record', onNewRecord);
    });
};
