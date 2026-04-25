import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AttendanceFilters } from './attendance.types';
import { isPrismaUniqueViolation, handleDuplicateError } from '../../shared/utils/prisma-error.utils';
import { syncZkData, addUserToDevice } from '../devices/zk';
import {
    getAttendanceRecords,
    getTodayAttendance,
    getEmployeeAttendanceHistory
} from './attendance.service';
import { prisma } from '../../shared/lib/prisma';
import attendanceEmitter from '../../shared/events/attendanceEmitter';
import { audit } from '../../shared/lib/auditLogger';


export const syncAttendance = async (req: Request, res: Response) => {
    try {
        console.log('Starting manual sync...');
        const result = await syncZkData();
        res.status(200).json(result);
    } catch (error: unknown) {
        if (isPrismaUniqueViolation(error)) {
            handleDuplicateError(res, 'attendance');
            return;
        }
        console.error('Sync failed:', error);
        res.status(500).json({
            success: false,
            message: 'An unexpected error occurred. Please try again.'
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

    } catch (error: unknown) {
        if (isPrismaUniqueViolation(error)) {
            handleDuplicateError(res, 'attendance');
            return;
        }
        console.error('Add Employee failed:', error);
        res.status(500).json({
            success: false,
            message: 'An unexpected error occurred. Please try again.'
        });
    }
};

/**
 * Get attendance records with optional filters
 * Query params: startDate, endDate, employeeId, status
 */
export const getAttendance = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, employeeId, status, page = 1, limit = 10, branchName, departmentId, departmentName } = req.query;

        const filters: AttendanceFilters = {};

        // Parse dates using PHT timezone (UTC+8) to match how records are stored.
        // Records are stored with date = midnight PHT (setHours(0,0,0,0) on the server).
        // Using +08:00 offset ensures the filter covers the correct PHT calendar day.
        if (startDate) {
            filters.startDate = new Date(`${String(startDate)}T00:00:00+08:00`);
        }

        if (endDate) {
            filters.endDate = new Date(`${String(endDate)}T23:59:59+08:00`);
        }
        if (employeeId) filters.employeeId = parseInt(String(employeeId));
        if (status) filters.status = String(status);
        if (branchName) {
            const branchRecord = await prisma.branch.findFirst({ where: { name: String(branchName) }, select: { id: true } });
            if (branchRecord) filters.branchId = branchRecord.id;
        }
        if (departmentId) filters.departmentId = parseInt(String(departmentId));
        if (departmentName) filters.departmentName = String(departmentName);

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
    } catch (error: unknown) {
        if (isPrismaUniqueViolation(error)) {
            handleDuplicateError(res, 'attendance');
            return;
        }
        console.error('Get Attendance Failed:', error);
        res.status(500).json({
            success: false,
            message: 'An unexpected error occurred. Please try again.'
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
    } catch (error: unknown) {
        if (isPrismaUniqueViolation(error)) {
            handleDuplicateError(res, 'attendance');
            return;
        }
        console.error('Get Today Failed:', error);
        res.status(500).json({
            success: false,
            message: 'An unexpected error occurred. Please try again.'
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
    } catch (error: unknown) {
        if (isPrismaUniqueViolation(error)) {
            handleDuplicateError(res, 'attendance');
            return;
        }
        console.error('Get Employee History Failed:', error);
        res.status(500).json({
            success: false,
            message: 'An unexpected error occurred. Please try again.'
        });
    }
};

/**
 * POST /api/attendance/manual
 * Creates a brand new attendance record for an absent day.
 * If Admin: creates immediately.
 * If HR: creates a 'pending' record and submits an adjustment request.
 */
export const createManualAttendance = async (req: Request, res: Response) => {
    try {
        const { employeeId, date, checkInTime, checkOutTime, reason } = req.body;
        const adjustedById = req.user?.employeeId;
        const userRole = req.user?.role;

        if (!adjustedById || !employeeId || !date || !checkInTime) {
            return res.status(400).json({ success: false, message: 'Missing required fields: employeeId, date, checkInTime' });
        }

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Reason is required.' });
        }

        // Time Validation
        const effectiveCheckIn = new Date(checkInTime);
        const effectiveCheckOut = checkOutTime ? new Date(checkOutTime) : null;
        const now = new Date();

        if (effectiveCheckIn > now) {
            return res.status(400).json({ success: false, message: 'Check-in time cannot be in the future.' });
        }

        if (effectiveCheckOut) {
            if (effectiveCheckOut <= effectiveCheckIn) {
                return res.status(400).json({ success: false, message: 'Check-out time must be later than check-in time.' });
            }
            const diffHours = (effectiveCheckOut.getTime() - effectiveCheckIn.getTime()) / (1000 * 60 * 60);
            if (diffHours > 16) {
                return res.status(400).json({ success: false, message: `Total work hours cannot exceed 16 hours. Currently: ${diffHours.toFixed(1)} hours.` });
            }
        }

        // Check if an attendance record already exists for this date to prevent duplicates
        const recordDate = new Date(date);
        const existingRecord = await prisma.attendance.findFirst({
            where: { employeeId: Number(employeeId), date: recordDate }
        });

        if (existingRecord) {
             return res.status(400).json({ success: false, message: `An attendance record already exists for this date. (ID: ${existingRecord.id})` });
        }

        const employee = await prisma.employee.findUnique({
             where: { id: Number(employeeId) },
             include: { Shift: true }
        });

        if (!employee) {
             return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // If HR User: Create a 'pending' dummy record + Adjustment Request
        if (userRole === 'HR') {
             const newRecord = await prisma.attendance.create({
                 data: {
                     employeeId: Number(employeeId),
                     date: recordDate,
                     checkInTime: effectiveCheckIn,
                     checkOutTime: effectiveCheckOut,
                     status: 'pending',
                     notes: `[Pending] Manual creation requested by HR. | Manual Edit: ${String(reason).trim()}`,
                     checkoutSource: effectiveCheckOut ? 'manual' : null
                 }
             });

             const adjustment = await prisma.attendanceAdjustment.create({
                 data: {
                     attendanceId: newRecord.id,
                     submittedById: adjustedById,
                     originalCheckIn: null,
                     originalCheckOut: null,
                     requestedCheckIn: effectiveCheckIn,
                     requestedCheckOut: effectiveCheckOut,
                     reason: String(reason).trim(),
                     status: 'pending',
                 }
             });

             res.json({
                 success: true,
                 message: 'Adjustment submitted for admin approval.',
                 data: adjustment,
                 pending: true,
             });

             void audit({
                 action: 'ADJUSTMENT_SUBMIT',
                 entityType: 'Attendance',
                 entityId: newRecord.id,
                 performedBy: adjustedById,
                 source: 'admin-panel',
                 details: `HR submitted manual attendance request for ${employee.firstName} ${employee.lastName}`,
                 metadata: { adjustmentId: adjustment.id, reason: String(reason).trim() },
                 correlationId: req.correlationId
             });
             return;
        }

        // If Admin: Calculate actual status and create the finalized record
        let calculatedStatus = 'present';
        const shift = employee.Shift;
        if (shift) {
            const [startH, startM] = shift.startTime.split(':').map(Number);
            const grace = shift.graceMinutes || 0;
            const checkInPHT = new Date(effectiveCheckIn.getTime() + 8 * 60 * 60 * 1000);
            const checkInMinutes = checkInPHT.getUTCHours() * 60 + checkInPHT.getUTCMinutes();
            const shiftStartMinutes = startH * 60 + startM + grace;
            
            calculatedStatus = checkInMinutes <= shiftStartMinutes ? 'present' : 'late';
            if (!effectiveCheckOut) calculatedStatus = 'incomplete';
        } else if (!effectiveCheckOut) {
            calculatedStatus = 'incomplete';
        }

        const adminRecord = await prisma.attendance.create({
            data: {
                employeeId: Number(employeeId),
                date: recordDate,
                checkInTime: effectiveCheckIn,
                checkOutTime: effectiveCheckOut,
                checkin_updated: new Date(),
                checkout_updated: effectiveCheckOut ? new Date() : null,
                status: calculatedStatus,
                notes: `Manual Edit: ${String(reason).trim()}`,
                checkoutSource: effectiveCheckOut ? 'manual' : null
            }
        });

        attendanceEmitter.emit('new-record', { type: 'update', record: adminRecord });

        void audit({
            action: 'ATTENDANCE_OVERRIDE',
            entityType: 'Attendance',
            entityId: adminRecord.id,
            performedBy: adjustedById,
            source: 'admin-panel',
            level: 'WARN',
            details: `Admin manually created missing attendance record for ${employee.firstName} ${employee.lastName}`,
            metadata: { reason },
            correlationId: req.correlationId
        });

        res.json({
            success: true,
            message: 'Manual attendance record created successfully.',
            data: adminRecord,
        });
    } catch (error: unknown) {
        console.error('Create Manual Attendance Failed:', error);
        res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
};

/**
 * Manually update an attendance record (HR correction)
 * Body: { checkInTime?, checkOutTime?, status?, reason? }
 * Creates AuditLog entries for each changed field.
 */
export const updateAttendance = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const recordId = parseInt(String(id));

        if (isNaN(recordId)) {
            res.status(400).json({ success: false, message: 'Invalid attendance record ID' });
            return;
        }

        const { checkInTime, checkOutTime, reason } = req.body;
        const adjustedById = req.user?.employeeId;
        const userRole = req.user?.role;

        if (!adjustedById) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }

        // Reason is always required
        if (!reason || !String(reason).trim()) {
            res.status(400).json({ success: false, message: 'Reason is required. Please provide a reason for this adjustment.' });
            return;
        }

        const existing = await prisma.attendance.findUnique({
            where: { id: recordId },
            include: { employee: { include: { Shift: true } } }
        });
        if (!existing) {
            res.status(404).json({ success: false, message: 'Attendance record not found' });
            return;
        }

        // ── Time Validation ──────────────────────────────────────────────────
        const effectiveCheckIn = checkInTime ? new Date(checkInTime) : existing.checkInTime;
        const effectiveCheckOut = checkOutTime !== undefined ? (checkOutTime ? new Date(checkOutTime) : null) : existing.checkOutTime;

        if (!effectiveCheckIn) {
            res.status(400).json({ success: false, message: 'Check-in time is required.' });
            return;
        }

        const now = new Date();
        if (effectiveCheckIn > now) {
            res.status(400).json({ success: false, message: 'Check-in time cannot be in the future.' });
            return;
        }

        if (effectiveCheckOut) {
            if (effectiveCheckOut <= effectiveCheckIn) {
                res.status(400).json({ success: false, message: 'Check-out time must be later than check-in time.' });
                return;
            }

            const diffHours = (effectiveCheckOut.getTime() - effectiveCheckIn.getTime()) / (1000 * 60 * 60);
            if (diffHours > 16) {
                res.status(400).json({ success: false, message: `Total work hours cannot exceed 16 hours. Currently: ${diffHours.toFixed(1)} hours.` });
                return;
            }
        }

        // ── HR users: create a pending adjustment (do NOT apply immediately) ──
        if (userRole === 'HR') {
            const adjustment = await prisma.attendanceAdjustment.create({
                data: {
                    attendanceId: recordId,
                    submittedById: adjustedById,
                    originalCheckIn: existing.checkInTime,
                    originalCheckOut: existing.checkOutTime,
                    requestedCheckIn: checkInTime ? new Date(checkInTime) : null,
                    requestedCheckOut: checkOutTime ? new Date(checkOutTime) : null,
                    reason: String(reason).trim(),
                    status: 'pending',
                }
            });

            res.json({
                success: true,
                message: 'Adjustment submitted for admin approval.',
                data: adjustment,
                pending: true,
            });

            // Log adjustment submission
            void audit({
                action: 'ADJUSTMENT_SUBMIT',
                entityType: 'Attendance',
                entityId: recordId,
                performedBy: adjustedById,
                source: 'admin-panel',
                details: `Attendance adjustment submitted for ${existing.employee.firstName} ${existing.employee.lastName}`,
                correlationId: req.correlationId
            });
            return;
        }

        // ── ADMIN users: apply changes immediately (existing behavior) ──
        const updateData: Prisma.AttendanceUpdateInput = {};
        const auditEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];

        if (checkInTime) {
            const oldVal = existing.checkInTime ? existing.checkInTime.toISOString() : null;
            const newDate = new Date(checkInTime);
            updateData.checkInTime = newDate;
            updateData.checkin_updated = new Date();
            auditEntries.push({ field: 'checkInTime', oldValue: oldVal, newValue: newDate.toISOString() });

            const shift = existing.employee?.Shift;
            if (shift) {
                const [startH, startM] = shift.startTime.split(':').map(Number);
                const grace = shift.graceMinutes || 0;
                const checkInPHT = new Date(newDate.getTime() + 8 * 60 * 60 * 1000);
                const checkInMinutes = checkInPHT.getUTCHours() * 60 + checkInPHT.getUTCMinutes();
                const shiftStartMinutes = startH * 60 + startM + grace;

                if (checkInMinutes <= shiftStartMinutes) {
                    updateData.status = 'present';
                } else {
                    updateData.status = 'late';
                }

                if (updateData.status !== existing.status) {
                    auditEntries.push({ field: 'status', oldValue: existing.status, newValue: String(updateData.status) });
                }
            }
        }

        if (checkOutTime !== undefined) {
            const oldVal = existing.checkOutTime ? existing.checkOutTime.toISOString() : null;
            const newVal = checkOutTime ? new Date(checkOutTime) : null;
            updateData.checkOutTime = newVal;
            updateData.checkout_updated = new Date();
            updateData.checkoutSource = 'manual';
            auditEntries.push({ field: 'checkOutTime', oldValue: oldVal, newValue: newVal ? newVal.toISOString() : null });
        }

        if (updateData.checkOutTime && existing.status === 'incomplete') {
            const shift = existing.employee?.Shift;
            if (shift) {
                const [startH, startM] = shift.startTime.split(':').map(Number);
                const grace = shift.graceMinutes || 0;
                const checkInPHT = new Date(existing.checkInTime.getTime() + 8 * 60 * 60 * 1000);
                const checkInMinutes = checkInPHT.getUTCHours() * 60 + checkInPHT.getUTCMinutes();
                const shiftStartMinutes = startH * 60 + startM + grace;
                updateData.status = checkInMinutes <= shiftStartMinutes ? 'present' : 'late';
            } else {
                updateData.status = 'present';
            }
            auditEntries.push({ field: 'status', oldValue: 'incomplete', newValue: String(updateData.status) });
        }



        // Clear missing-checkout flag if a checkout time is being set
        let currentNotes = existing.notes || '';
        if (updateData.checkOutTime && currentNotes.includes('No checkout recorded')) {
            currentNotes = currentNotes.replace(/\s*\|?\s*No checkout recorded.*$/i, '');
        }
        
        currentNotes = currentNotes.replace(/\s*\|?\s*Manual Edit:.*$/i, ''); // Clean old manual edit notes
        updateData.notes = currentNotes ? `${currentNotes.trim()} | Manual Edit: ${reason}` : `Manual Edit: ${reason}`;

        const updated = await prisma.attendance.update({
            where: { id: recordId },
            data: updateData
        });

        if (auditEntries.length > 0) {
            void audit({
                action: 'ATTENDANCE_OVERRIDE',
                entityType: 'Attendance',
                entityId: recordId,
                performedBy: adjustedById,
                source: 'admin-panel',
                level: 'WARN',
                details: `Admin performed an immediate override on attendance for ${existing.employee.firstName} ${existing.employee.lastName}`,
                correlationId: req.correlationId
            });
        }

        attendanceEmitter.emit('new-record', { type: 'update', record: updated });

        res.json({
            success: true,
            message: 'Attendance record updated successfully',
            data: updated,
            auditEntries: auditEntries.length,
        });
    } catch (error: unknown) {
        console.error('Update Attendance Failed:', error);
        res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again.' });
    }
};

/**
 * GET /api/attendance/audit-logs
 * Returns audit log entries with optional filters: date, search, branch
 */
export const getAttendanceAuditLogs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const search = (req.query.search as string) || '';
    const branch = (req.query.branch as string) || '';
    const dateStr = (req.query.date as string) || '';
    const entityId = parseInt(req.query.entityId as string) || null;

    const skip = (page - 1) * limit;

    // Use the central AuditLog instead of the legacy AttendanceAuditLog table
    const where: Prisma.AuditLogWhereInput = {
        entityType: 'Attendance',
        action: { in: ['ATTENDANCE_OVERRIDE', 'ADJUSTMENT_APPROVE'] }
    };

    if (entityId) {
        where.entityId = entityId;
    }

    if (dateStr) {
      const start = new Date(dateStr);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(dateStr);
      end.setUTCHours(23, 59, 59, 999);
      where.timestamp = { gte: start, lte: end };
    }

    if (search || branch) {
       // Since AuditLog handles entityId as an unconstrained Int, 
       // we must fetch valid attendance IDs that match the employee criteria.
       const attWhere: Prisma.AttendanceWhereInput = {};
       const employeeWhere: Prisma.EmployeeWhereInput = {};
       if (branch) {
           const branchRecord = await prisma.branch.findFirst({ where: { name: branch }, select: { id: true } });
           if (branchRecord) employeeWhere.branchId = branchRecord.id;
       }
       if (search) {
           employeeWhere.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } }
           ];
       }
       if (branch || search) attWhere.employee = employeeWhere;
       
       const matchedAtts = await prisma.attendance.findMany({ 
           where: attWhere, 
           select: { id: true } 
       });
       const validAttIds = matchedAtts.map(a => a.id);

       if (search) {
          // If searching, it could match the attendance employee OR the adjuster
          where.OR = [
             { entityId: { in: validAttIds } },
             { performer: { OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
             ] } }
          ];
       } else {
          // If just branch, it only filters the attendance employee
          where.entityId = { in: validAttIds };
       }
    }

    const [total, rawLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
            performer: {
                select: {
                    firstName: true,
                    lastName: true,
                    role: true
                }
            }
        }
      })
    ]);

    // Manually fetch Attendance details to attach to each log
    const attIdsToFetch = Array.from(new Set(rawLogs.map(l => l.entityId).filter(Boolean))) as number[];
    const attRecords = await prisma.attendance.findMany({
        where: { id: { in: attIdsToFetch } },
        include: {
            employee: {
                select: {
                    firstName: true,
                    lastName: true,
                    Branch: { select: { name: true } },
                    role: true
                }
            }
        }
    });

    const attMap = new Map(attRecords.map(a => [a.id, a]));

    // Flatten the `changes` array from metadata into individual rows (field updates)
    // to preserve backward compatibility with the frontend's expected format.
    const mappedLogs: Record<string, unknown>[] = [];
    for (const log of rawLogs) {
        const attendance = log.entityId ? attMap.get(log.entityId) : null;
        if (!attendance) continue;

        const meta = log.metadata as { changes?: { field: string; oldValue: string | null; newValue: string | null }[]; reason?: string } | null;
        const changes = meta?.changes ?? [];
        const reason = meta?.reason ?? null;

        for (const change of changes) {
            mappedLogs.push({
                id: `${log.id}-${change.field}`, // synthetic ID
                field: change.field,
                oldValue: change.oldValue,
                newValue: change.newValue,
                reason: reason,
                createdAt: log.timestamp,
                attendance: {
                    employee: attendance.employee
                },
                adjustedBy: log.performer || { firstName: 'System', lastName: '', role: 'SYSTEM' }
            });
        }
    }

    return res.json({
      success: true,
      data: mappedLogs,
      meta: {
        total, // Total operations
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: unknown) {
    console.error('Error fetching attendance audit logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
    });
  }
};

/**
 * GET /api/attendance/adjustments
 * Returns adjustment requests with filters: status, search, date
 */
export const getAdjustments = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const statusFilter = (req.query.status as string) || '';
    const search = (req.query.search as string) || '';
    const dateStr = (req.query.date as string) || '';
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceAdjustmentWhereInput = {};
    if (statusFilter) where.status = statusFilter;

    if (dateStr) {
      const start = new Date(dateStr);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(dateStr);
      end.setUTCHours(23, 59, 59, 999);
      where.attendance = { ...((where.attendance as object) || {}), date: { gte: start, lte: end } };
    }

    if (search) {
      where.OR = [
        { attendance: { employee: { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ] } } },
        { submittedBy: { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ] } },
      ];
    }

    const [total, adjustments] = await Promise.all([
      prisma.attendanceAdjustment.count({ where }),
      prisma.attendanceAdjustment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          attendance: {
            include: {
              employee: {
                select: { firstName: true, lastName: true, middleName: true, suffix: true, Branch: { select: { name: true } }, Department: { select: { name: true } } }
              }
            }
          },
          submittedBy: { select: { firstName: true, lastName: true } },
          reviewedBy: { select: { firstName: true, lastName: true } },
        }
      })
    ]);

    return res.json({
      success: true,
      data: adjustments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error: unknown) {
    console.error('Error fetching adjustments:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch adjustments' });
  }
};

/**
 * PUT /api/attendance/adjustments/:id/review
 * Admin-only: approve or reject a pending adjustment
 * Body: { action: "approve" | "reject", rejectionReason?: string }
 */
export const reviewAdjustment = async (req: Request, res: Response) => {
  try {
    const adjustmentId = parseInt(String(req.params.id));
    if (isNaN(adjustmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid adjustment ID' });
    }

    const { action, rejectionReason } = req.body;
    const reviewerId = req.user?.employeeId;

    if (!reviewerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be "approve" or "reject"' });
    }

    const adjustment = await prisma.attendanceAdjustment.findUnique({
      where: { id: adjustmentId },
      include: { attendance: { include: { employee: { include: { Shift: true } } } } }
    });

    if (!adjustment) {
      return res.status(404).json({ success: false, message: 'Adjustment not found' });
    }
    if (adjustment.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Adjustment has already been ${adjustment.status}` });
    }

    if (action === 'reject') {
      if (!rejectionReason || !String(rejectionReason).trim()) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }

      await prisma.attendanceAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'rejected',
          reviewedById: reviewerId,
          rejectionReason: String(rejectionReason).trim(),
          reviewedAt: new Date(),
        }
      });

      // Log rejection
      void audit({
          action: 'ADJUSTMENT_REJECT',
          entityType: 'Attendance',
          entityId: adjustment.attendanceId,
          performedBy: reviewerId,
          source: 'admin-panel',
          details: `Adjustment for ${adjustment.attendance.employee.firstName} ${adjustment.attendance.employee.lastName} was rejected`,
          correlationId: req.correlationId
      });

      return res.json({ success: true, message: 'Adjustment rejected' });
    }

    // ── APPROVE: apply the changes to the attendance record ──
    const updateData: Record<string, unknown> = {};
    const auditEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    const existing = adjustment.attendance;

    if (adjustment.requestedCheckIn) {
      const oldVal = existing.checkInTime ? existing.checkInTime.toISOString() : null;
      updateData.checkInTime = adjustment.requestedCheckIn;
      updateData.checkin_updated = new Date();
      auditEntries.push({ field: 'checkInTime', oldValue: oldVal, newValue: adjustment.requestedCheckIn.toISOString() });

      // Recalculate status
      const shift = existing.employee?.Shift;
      if (shift) {
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const grace = shift.graceMinutes || 0;
        const checkInPHT = new Date(adjustment.requestedCheckIn.getTime() + 8 * 60 * 60 * 1000);
        const checkInMinutes = checkInPHT.getUTCHours() * 60 + checkInPHT.getUTCMinutes();
        const shiftStartMinutes = startH * 60 + startM + grace;
        updateData.status = checkInMinutes <= shiftStartMinutes ? 'present' : 'late';
        if (updateData.status !== existing.status) {
          auditEntries.push({ field: 'status', oldValue: existing.status, newValue: String(updateData.status) });
        }
      }
    }

    if (adjustment.requestedCheckOut) {
      const oldVal = existing.checkOutTime ? existing.checkOutTime.toISOString() : null;
      updateData.checkOutTime = adjustment.requestedCheckOut;
      updateData.checkout_updated = new Date();
      updateData.checkoutSource = 'manual';
      auditEntries.push({ field: 'checkOutTime', oldValue: oldVal, newValue: adjustment.requestedCheckOut.toISOString() });
    }

    if (updateData.checkOutTime && existing.status === 'incomplete') {
      const shift = existing.employee?.Shift;
      if (shift) {
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const grace = shift.graceMinutes || 0;
        const checkInPHT = new Date(existing.checkInTime.getTime() + 8 * 60 * 60 * 1000);
        const checkInMinutes = checkInPHT.getUTCHours() * 60 + checkInPHT.getUTCMinutes();
        const shiftStartMinutes = startH * 60 + startM + grace;
        updateData.status = checkInMinutes <= shiftStartMinutes ? 'present' : 'late';
      } else {
        updateData.status = 'present';
      }
      auditEntries.push({ field: 'status', oldValue: 'incomplete', newValue: String(updateData.status) });
    }

    // Clear missing-checkout flag if a checkout is being set
    let currentNotes = existing.notes || '';
    if (updateData.checkOutTime && currentNotes.includes('No checkout recorded')) {
      currentNotes = currentNotes.replace(/\s*\|?\s*No checkout recorded.*$/i, '');
    }

    currentNotes = currentNotes.replace(/\s*\|?\s*\[Pending\] Manual creation requested by HR.*$/i, ''); // Clean pending note
    currentNotes = currentNotes.replace(/\s*\|?\s*Manual Edit:.*$/i, ''); // Clean old manual edit notes
    updateData.notes = currentNotes ? `${currentNotes.trim()} | Manual Edit: ${adjustment.reason}` : `Manual Edit: ${adjustment.reason}`;

    // Apply to attendance record
    const updated = await prisma.attendance.update({
      where: { id: adjustment.attendanceId },
      data: updateData
    });

    // Removed the legacy AttendanceAuditLog.createMany write
    // Update adjustment status
    await prisma.attendanceAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: 'approved',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      }
    });

    // Emit SSE for real-time dashboard updates
    attendanceEmitter.emit('new-record', { type: 'update', record: updated });

    // Log approval
    void audit({
        action: 'ADJUSTMENT_APPROVE',
        entityType: 'Attendance',
        entityId: adjustment.attendanceId,
        performedBy: reviewerId,
        source: 'admin-panel',
        details: `Adjustment for ${adjustment.attendance.employee.firstName} ${adjustment.attendance.employee.lastName} was approved and applied`,
        correlationId: req.correlationId
    });

    return res.json({ success: true, message: 'Adjustment approved and applied' });
  } catch (error: unknown) {
    console.error('Error reviewing adjustment:', error);
    return res.status(500).json({ success: false, message: 'Failed to review adjustment' });
  }
};

/**
 * GET /api/attendance/stream
 *
 * Server-Sent Events endpoint. Keeps the HTTP connection open and pushes
 * new attendance records to the client as they are processed by syncZkData().
 *
 * WHY SSE instead of WebSockets: SSE is unidirectional (server → client),
 * which is exactly what attendance monitoring needs. It works over plain HTTP,
 * requires no additional library on either end.
 *
 * Authentication: The authenticate middleware is applied at the router level
 * for all /api/attendance routes, so this endpoint requires a valid JWT
 * cookie just like every other attendance route.
 */
export const streamAttendance = async (req: Request, res: Response): Promise<void> => {
    // ── Set SSE headers ───────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Disable Nginx buffering if a reverse proxy is ever added in front
    res.setHeader('X-Accel-Buffering', 'no');

    // Flush headers immediately so the browser knows the stream has started.
    res.flushHeaders();

    // ── Send an initial "connected" event ─────────────────────────────────
    res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

    // ── Heartbeat ─────────────────────────────────────────────────────────
    // SSE comments (lines starting with ':') keep the TCP connection alive
    // through proxies that close idle connections after ~60s.
    const heartbeatInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 25_000);

    // ── Event listener ────────────────────────────────────────────────────
    // Listen for 'new-record' events from processAttendanceLogs() and push
    // them to this client.
    // The `any` on payload is unavoidable — the emitter carries untyped data
    // across module boundaries and typing it would require a shared interface
    // that adds coupling without safety (runtime JSON.parse is untyped anyway).
    const onNewRecord = (payload: { type: string; record: unknown }) => {
        res.write(`event: attendance\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    attendanceEmitter.on('new-record', onNewRecord);

    // ── Cleanup on client disconnect ──────────────────────────────────────
    req.on('close', () => {
        clearInterval(heartbeatInterval);
        attendanceEmitter.off('new-record', onNewRecord);
        console.log(`[SSE] Client disconnected from attendance stream`);
    });

    console.log(`[SSE] Client connected to attendance stream`);
};


