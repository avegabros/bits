import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AttendanceFilters } from './attendance.types';
import { isPrismaUniqueViolation, handleDuplicateError } from '../../shared/utils/prisma-error.utils';
import { syncZkData, addUserToDevice } from '../devices/zk';
import {
    getAttendanceRecords,
    getTodayAttendance,
    getEmployeeAttendanceHistory,
    toPHTDate,
    calculateAttendanceStatus
} from './attendance.service';
import { prisma } from '../../shared/lib/prisma';
import attendanceEmitter from '../../shared/events/attendanceEmitter';
import { audit } from '../../shared/lib/auditLogger';

/** Check if a pending adjustment already exists for an attendance record */
async function findPendingAdjustment(attendanceId: number) {
    return prisma.attendanceAdjustment.findFirst({
        where: { attendanceId, status: 'pending' },
        select: { id: true, type: true, submittedAt: true },
    });
}


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
        const { startDate, endDate, employeeId, status, page = 1, limit = 10, branchName, departmentId, departmentName, branchId, shiftType, sortBy, sortDesc, search } = req.query;

        const filters: AttendanceFilters = {
            managerDepartmentIds: req.managerDepartmentIds && req.query.scope !== 'company' ? req.managerDepartmentIds : undefined
        };

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
        if (req.managerDepartmentIds && req.query.scope !== 'company') filters.managerDepartmentIds = req.managerDepartmentIds;

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
        const { employeeId, date, checkInTime, checkOutTime, reason, roleContext } = req.body;
        const adjustedById = req.user?.employeeId;
        const userRole = req.user?.role;
        const isHRWorkflow = userRole === 'HR' || roleContext === 'hr';

        if (!adjustedById || !employeeId || !date || !checkInTime) {
            return res.status(400).json({ success: false, message: 'Missing required fields: employeeId, date, checkInTime' });
        }

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Reason is required.' });
        }

        // Time Validation
        const effectiveCheckIn = new Date(checkInTime);
        const effectiveCheckOut = checkOutTime ? new Date(checkOutTime) : null;

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
        const recordDate = toPHTDate(new Date(`${date}T00:00:00+08:00`));
        const existingRecord = await prisma.attendance.findFirst({
            where: { employeeId: Number(employeeId), date: recordDate }
        });

        if (existingRecord) {
             return res.status(400).json({ success: false, message: `An attendance record already exists for this date. (ID: ${existingRecord.id})` });
        }

        const employee = await prisma.employee.findUnique({
             where: { id: Number(employeeId) },
             include: { Shift: true, Branch: { select: { name: true } } }
        });

        if (!employee) {
             return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Future check-in validation (night-shift aware)
        // Night-shift employees may need same-day future check-ins (e.g. 22:00 at 10 AM),
        // so we only block future DATES for them. Day-shift employees keep strict validation.
        const isNightShift = employee.Shift?.isNightShift ?? false;
        
        console.log(`[DEBUG] createManualAttendance - employee: ${employee.id}, shift: ${employee.Shift?.name}, isNightShift: ${isNightShift}`);
        console.log(`[DEBUG] effectiveCheckIn: ${effectiveCheckIn.toISOString()}, now: ${new Date().toISOString()}`);

        if (isNightShift) {
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
            if (date > todayStr) {
                return res.status(400).json({ success: false, message: 'Cannot set check-in for a future date.' });
            }
        } else {
            if (effectiveCheckIn > new Date()) {
                return res.status(400).json({ success: false, message: 'Check-in time cannot be in the future.' });
            }
        }

        // If HR User (or Admin acting as HR): Create a pending record + Adjustment Request
        if (isHRWorkflow) {
             const newRecord = await prisma.attendance.create({
                 data: {
                     employeeId: Number(employeeId),
                     date: recordDate,
                     checkInTime: effectiveCheckIn,
                     checkOutTime: effectiveCheckOut,
                     status: 'pending',
                     notes: `[Pending] Manual creation requested by HR. | Manual Edit: ${String(reason).trim()}`,
                     checkoutSource: null
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
                     employeeName: `${employee.firstName} ${employee.lastName}`,
                     employeeBranch: employee.Branch?.name || null,
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
        const calculatedStatus = calculateAttendanceStatus(
            effectiveCheckIn,
            effectiveCheckOut,
            recordDate,
            employee.Shift ?? null
        );

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
            metadata: { 
                reason,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                branch: employee.Branch?.name || '—',
                attendanceDate: adminRecord.date.toISOString(),
                changes: [
                    { field: 'record', oldValue: 'missing', newValue: 'created' },
                    { field: 'checkInTime', oldValue: null, newValue: adminRecord.checkInTime?.toISOString() || null },
                    ...(adminRecord.checkOutTime ? [{ field: 'checkOutTime', oldValue: null, newValue: adminRecord.checkOutTime.toISOString() }] : []),
                    { field: 'status', oldValue: 'missing', newValue: adminRecord.status }
                ]
            },
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

        const { checkInTime, checkOutTime, reason, roleContext } = req.body;
        const adjustedById = req.user?.employeeId;
        const userRole = req.user?.role;
        const isHRWorkflow = userRole === 'HR' || roleContext === 'hr';

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
            include: { employee: { include: { Shift: true, Branch: { select: { name: true } } } } }
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

        // Future check-in validation (night-shift aware)
        // Night-shift employees may need same-day future check-ins (e.g. 22:00 at 10 AM),
        // so we only block future DATES for them. Day-shift employees keep strict validation.
        const isNightShift = existing.employee?.Shift?.isNightShift ?? false;
        
        console.log(`[DEBUG] updateAttendance - employee: ${existing.employee?.id}, shift: ${existing.employee?.Shift?.name}, isNightShift: ${isNightShift}`);
        console.log(`[DEBUG] effectiveCheckIn: ${effectiveCheckIn.toISOString()}, now: ${new Date().toISOString()}`);

        if (isNightShift) {
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
            const recordDateStr = existing.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
            if (recordDateStr > todayStr) {
                res.status(400).json({ success: false, message: 'Cannot set check-in for a future date.' });
                return;
            }
        } else {
            const now = new Date();
            if (effectiveCheckIn > now) {
                res.status(400).json({ success: false, message: 'Check-in time cannot be in the future.' });
                return;
            }
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

        // ── HR users (or Admin acting as HR): create a pending adjustment (do NOT apply immediately) ──
        if (isHRWorkflow) {
            // ── Duplicate prevention: only one pending adjustment per record ──
            const existingPending = await findPendingAdjustment(recordId);
            if (existingPending) {
                res.status(409).json({
                    success: false,
                    message: 'A pending adjustment already exists for this record. Cancel it first or wait for review.',
                    existingAdjustmentId: existingPending.id,
                });
                return;
            }

            const adjustment = await prisma.attendanceAdjustment.create({
                data: {
                    attendanceId: recordId,
                    submittedById: adjustedById,
                    originalCheckIn: existing.checkInTime,
                    originalCheckOut: existing.checkOutTime,
                    requestedCheckIn: checkInTime ? new Date(checkInTime) : null,
                    requestedCheckOut: checkOutTime ? new Date(checkOutTime) : null,
                    employeeName: `${existing.employee.firstName} ${existing.employee.lastName}`,
                    employeeBranch: (existing.employee as any).Branch?.name || null,
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
        }

        if (checkOutTime !== undefined) {
            const oldVal = existing.checkOutTime ? existing.checkOutTime.toISOString() : null;
            const newVal = checkOutTime ? new Date(checkOutTime) : null;
            updateData.checkOutTime = newVal;
            updateData.checkout_updated = new Date();
            updateData.checkoutSource = 'manual';
            auditEntries.push({ field: 'checkOutTime', oldValue: oldVal, newValue: newVal ? newVal.toISOString() : null });
        }

        // Centralized status recalculation
        if (updateData.checkInTime || updateData.checkOutTime !== undefined) {
            const finalCheckIn = (updateData.checkInTime as Date) ?? existing.checkInTime;
            const finalCheckOut = updateData.checkOutTime !== undefined ? (updateData.checkOutTime as Date | null) : existing.checkOutTime;
            const shift = existing.employee?.Shift ?? null;

            const newStatus = calculateAttendanceStatus(finalCheckIn, finalCheckOut, existing.date, shift);
            if (newStatus !== existing.status) {
                updateData.status = newStatus;
                auditEntries.push({ field: 'status', oldValue: existing.status, newValue: newStatus });
            }
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
        action: { in: ['ATTENDANCE_OVERRIDE', 'ATTENDANCE_DELETE', 'ADJUSTMENT_APPROVE'] }
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
      const searchTerms = search.trim().split(/\s+/);
      const nameConditions = searchTerms.map(term => {
        const isNumeric = /^\d+$/.test(term);
        return {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' as const } },
            { lastName: { contains: term, mode: 'insensitive' as const } },
            { middleName: { contains: term, mode: 'insensitive' as const } },
            { Branch: { name: { contains: term, mode: 'insensitive' as const } } },
            ...(isNumeric ? [{ id: parseInt(term) }] : []),
          ]
        };
      });

      // Build employee filter
      const employeeWhere: Prisma.EmployeeWhereInput = {};
      if (branch) {
        const branchRecord = await prisma.branch.findFirst({ where: { name: branch }, select: { id: true } });
        if (branchRecord) employeeWhere.branchId = branchRecord.id;
      }
      if (search) {
        employeeWhere.AND = nameConditions;
      }

      // Fetch IDs for active records
      const matchedAtts = await prisma.attendance.findMany({
        where: { employee: employeeWhere },
        select: { id: true }
      });
      const validAttIds = matchedAtts.map(a => a.id);

      const orConditions: Prisma.AuditLogWhereInput[] = [
        { entityId: { in: validAttIds } }
      ];

      // Also search snapshot data in details for deleted records
      if (search) {
        // Match ANY of the terms in the details string or performer name
        orConditions.push({
          OR: [
            { details: { contains: search, mode: 'insensitive' as const } },
            {
              performer: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' as const } },
                  { lastName: { contains: search, mode: 'insensitive' as const } }
                ]
              }
            }
          ]
        });
      }

      if (branch) {
        orConditions.push({ details: { contains: `Branch: ${branch}`, mode: 'insensitive' as const } });
      }

      where.OR = orConditions;
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
        
        const meta = log.metadata as { changes?: { field: string; oldValue: string | null; newValue: string | null }[]; reason?: string; employeeName?: string; branch?: string; submittedBy?: { firstName: string; lastName: string; role: string }, attendanceDate?: string | Date, date?: string | Date } | null;
        const changes = meta?.changes ?? [];
        const reason = meta?.reason ?? null;
        const submittedBy = meta?.submittedBy;
        const attendanceDate = attendance ? attendance.date : (meta?.attendanceDate || meta?.date);

        // Fallback for deleted records
        const employeeFallback = {
            firstName: meta?.employeeName || 'Unknown',
            lastName: '',
            Branch: { name: meta?.branch || '—' },
            role: 'USER'
        };

        const empData = attendance ? attendance.employee : employeeFallback;

        const defaultSystemPerformer = { firstName: 'System', lastName: '', role: 'SYSTEM' };
        // If it's an approved adjustment, the originator is the submittedBy
        const mappedAdjustedBy = submittedBy ? submittedBy : (log.performer || defaultSystemPerformer);
        const mappedApprovedBy = submittedBy ? (log.performer || defaultSystemPerformer) : undefined;

        for (const change of changes) {
            mappedLogs.push({
                id: `${log.id}-${change.field}`, // synthetic ID
                actionType: log.action,
                field: change.field,
                oldValue: change.oldValue,
                newValue: change.newValue,
                reason: reason,
                createdAt: log.timestamp,
                attendance: {
                    date: attendanceDate,
                    employee: empData
                },
                adjustedBy: mappedAdjustedBy,
                approvedBy: mappedApprovedBy
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
    const branch = (req.query.branch as string) || '';
    const dateStr = (req.query.date as string) || '';
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceAdjustmentWhereInput = {};
    if (statusFilter) where.status = statusFilter;

    if (req.managerDepartmentIds) {
      const deptFilter = {
        OR: [
          { attendance: { employee: { departmentId: { in: req.managerDepartmentIds } } } }
        ]
      };
      where.AND = [deptFilter];
    }

    if (dateStr) {
      const start = new Date(dateStr);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(dateStr);
      end.setUTCHours(23, 59, 59, 999);
      where.attendance = { ...((where.attendance as object) || {}), date: { gte: start, lte: end } };
    }

    if (branch) {
      const branchFilter = {
        OR: [
          { attendance: { employee: { Branch: { name: branch } } } },
          { employeeBranch: branch }
        ]
      };
      if (where.AND) {
        (where.AND as any).push(branchFilter);
      } else {
        where.AND = [branchFilter];
      }
    }

    if (search) {
      const searchTerms = search.trim().split(/\s+/);
      const nameConditions = searchTerms.map(term => {
        const isNumeric = /^\d+$/.test(term);
        return {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' as const } },
            { lastName: { contains: term, mode: 'insensitive' as const } },
            { middleName: { contains: term, mode: 'insensitive' as const } },
            { Branch: { name: { contains: term, mode: 'insensitive' as const } } },
            ...(isNumeric ? [{ id: parseInt(term) }] : []),
          ]
        };
      });

      where.OR = [
        { attendance: { employee: { AND: nameConditions } } },
        { submittedBy: { AND: nameConditions } },
        { 
          AND: searchTerms.map(term => ({ 
            OR: [
              { employeeName: { contains: term, mode: 'insensitive' as const } },
              { employeeBranch: { contains: term, mode: 'insensitive' as const } }
            ]
          })) 
        },
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

    // Map adjustments to provide fallback employee info for deleted records
    const mapped = adjustments.map(adj => {
      if (adj.attendance) return adj;
      // Attendance was deleted — use snapshot fields
      const nameParts = (adj.employeeName || 'Unknown').split(' ');
      return {
        ...adj,
        attendance: {
          id: null,
          date: adj.submittedAt,
          employee: {
            firstName: nameParts[0] || 'Unknown',
            lastName: nameParts.slice(1).join(' ') || '',
            middleName: null,
            suffix: null,
            Branch: { name: adj.employeeBranch || '—' },
            Department: { name: '—' },
          }
        }
      };
    });

    return res.json({
      success: true,
      data: mapped,
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
      include: { 
          attendance: { include: { employee: { include: { Shift: true } } } },
          submittedBy: { select: { firstName: true, lastName: true, role: true } }
      }
    });

    if (!adjustment) {
      return res.status(404).json({ success: false, message: 'Adjustment not found' });
    }
    if (adjustment.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Adjustment has already been ${adjustment.status}` });
    }

    if (req.managerDepartmentIds) {
      if (adjustment.attendance) {
        if (!adjustment.attendance.employee.departmentId || !req.managerDepartmentIds.includes(adjustment.attendance.employee.departmentId)) {
          return res.status(403).json({ success: false, message: 'Forbidden: Employee belongs to a department you do not manage.' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot verify department ownership for deleted attendance.' });
      }
    }

    if (action === 'reject') {
      if (!rejectionReason || !String(rejectionReason).trim()) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }

      // Mark the adjustment as rejected
      await prisma.attendanceAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'rejected',
          reviewedById: reviewerId,
          rejectionReason: String(rejectionReason).trim(),
          reviewedAt: new Date(),
        }
      });

      // Clean up the attendance record created for this adjustment.
      // If originalCheckIn is null, it was a brand-new manual creation by HR —
      // the attendance record is just a placeholder and should be deleted entirely.
      // If it was an edit on an existing record, the status may need to be reverted.
      const attendanceRecord = adjustment.attendance;
      if (attendanceRecord && adjustment.originalCheckIn === null && attendanceRecord.status === 'pending') {
        // This was a new manual creation — delete the placeholder record
        await prisma.attendance.delete({
          where: { id: attendanceRecord.id }
        });
      } else if (attendanceRecord && attendanceRecord.status === 'pending') {
        // This was an edit on an existing record — revert status
        await prisma.attendance.update({
          where: { id: attendanceRecord.id },
          data: { status: 'incomplete' }
        });
      }

      // Log rejection
      const rejEmpName = attendanceRecord?.employee
        ? `${attendanceRecord.employee.firstName} ${attendanceRecord.employee.lastName}`
        : (adjustment.employeeName || 'Unknown');
      void audit({
          action: 'ADJUSTMENT_REJECT',
          entityType: 'Attendance',
          entityId: adjustment.attendanceId ?? undefined,
          performedBy: reviewerId,
          source: 'admin-panel',
          details: `Adjustment for ${rejEmpName} was rejected`,
          correlationId: req.correlationId
      });

      return res.json({ success: true, message: 'Adjustment rejected' });
    }

    // ── APPROVE: apply the changes to the attendance record ──
    if (adjustment.type === 'DELETE') {
      const existing = adjustment.attendance;
      const empName = existing?.employee
        ? `${existing.employee.firstName} ${existing.employee.lastName}`
        : (adjustment.employeeName || 'Unknown');
      const empBranch = (existing?.employee as any)?.Branch?.name || adjustment.employeeBranch || '—';

      // Mark the adjustment as approved FIRST
      await prisma.attendanceAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'approved',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        }
      });

      if (existing) {
        await prisma.attendance.delete({
          where: { id: existing.id }
        });

        // Emit SSE for real-time dashboard updates (send a delete event)
        attendanceEmitter.emit('new-record', { type: 'delete', record: existing });
      }

      // Log approval
      void audit({
          action: 'ADJUSTMENT_APPROVE',
          entityType: 'Attendance',
          entityId: adjustment.attendanceId ?? undefined,
          performedBy: reviewerId,
          source: 'admin-panel',
          details: `Delete adjustment for ${empName} (Branch: ${empBranch}) was approved and applied`,
          metadata: {
            reason: adjustment.reason,
            employeeName: `${existing?.employee?.firstName || ''} ${existing?.employee?.lastName || ''}`.trim(),
            branch: (existing?.employee as any)?.Branch?.name,
            attendanceDate: existing?.date,
            changes: [
                { field: 'record', oldValue: 'present', newValue: 'deleted' }
            ],
            submittedBy: adjustment.submittedBy
          },
          correlationId: req.correlationId
      });

      return res.json({ success: true, message: 'Adjustment approved and record deleted' });
    }

    const updateData: Record<string, unknown> = {};
    const auditEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];
    const existing = adjustment.attendance;

    if (!existing) {
      return res.status(400).json({ success: false, message: 'Attendance record no longer exists.' });
    }

    const isManualCreation = adjustment.originalCheckIn === null;

    if (adjustment.requestedCheckIn) {
      const oldVal = isManualCreation ? null : (existing.checkInTime ? existing.checkInTime.toISOString() : null);
      updateData.checkInTime = adjustment.requestedCheckIn;
      updateData.checkin_updated = new Date();
      auditEntries.push({ field: 'checkInTime', oldValue: oldVal, newValue: adjustment.requestedCheckIn.toISOString() });
    }

    if (adjustment.requestedCheckOut !== undefined && adjustment.requestedCheckOut !== null) {
      const oldVal = isManualCreation ? null : (existing.checkOutTime ? existing.checkOutTime.toISOString() : null);
      updateData.checkOutTime = adjustment.requestedCheckOut;
      updateData.checkout_updated = new Date();
      updateData.checkoutSource = 'manual';
      auditEntries.push({ field: 'checkOutTime', oldValue: oldVal, newValue: adjustment.requestedCheckOut.toISOString() });
    } else if (adjustment.requestedCheckOut === null && existing.checkOutTime) {
       // if they explicitly wanted to clear the checkout time? Unlikely but just in case
       // For our adjustment model, null could mean no change or clearing.
       // Usually we only set requestedCheckOut if we change it.
    }

    if (isManualCreation) {
      // This was a manual creation request, so log the record creation
      auditEntries.push({ field: 'record', oldValue: 'missing', newValue: 'created' });
    }

    // Centralized status recalculation
    if (adjustment.requestedCheckIn || adjustment.requestedCheckOut) {
      const finalCheckIn = (updateData.checkInTime as Date) ?? existing.checkInTime;
      const finalCheckOut = updateData.checkOutTime !== undefined ? (updateData.checkOutTime as Date | null) : existing.checkOutTime;
      const shift = existing.employee?.Shift ?? null;

      const newStatus = calculateAttendanceStatus(finalCheckIn, finalCheckOut, existing.date, shift);
      if (newStatus !== existing.status || isManualCreation) {
        updateData.status = newStatus;
        const oldStatusVal = isManualCreation ? 'missing' : existing.status;
        auditEntries.push({ field: 'status', oldValue: oldStatusVal, newValue: newStatus });
      }
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
      where: { id: existing.id },
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
        entityId: adjustment.attendanceId ?? undefined,
        performedBy: reviewerId,
        source: 'admin-panel',
        details: `Adjustment for ${existing.employee?.firstName || 'Unknown'} ${existing.employee?.lastName || ''} was approved and applied`,
        metadata: {
            reason: adjustment.reason,
            changes: auditEntries,
            submittedBy: adjustment.submittedBy
        },
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

/**
 * DELETE /api/attendance/:id
 * Delete an attendance record.
 * Admin: Deletes immediately.
 * HR: Submits a deletion adjustment request.
 */
export const deleteAttendance = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const recordId = parseInt(String(id));
        const { reason, roleContext } = req.body;
        const requestedById = req.user?.employeeId;
        const userRole = req.user?.role;
        const isHRWorkflow = userRole === 'HR' || roleContext === 'hr';

        if (isNaN(recordId)) {
            return res.status(400).json({ success: false, message: 'Invalid attendance record ID' });
        }

        if (!requestedById) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Reason is required for deletion.' });
        }

        const existing = await prisma.attendance.findUnique({
            where: { id: recordId },
            include: { employee: { include: { Branch: { select: { name: true } } } } }
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Attendance record not found' });
        }

        if (isHRWorkflow) {
            // ── Duplicate prevention: only one pending adjustment per record ──
            const existingPending = await findPendingAdjustment(recordId);
            if (existingPending) {
                return res.status(409).json({
                    success: false,
                    message: 'A pending adjustment already exists for this record. Cancel it first or wait for review.',
                    existingAdjustmentId: existingPending.id,
                });
            }

            const adjustment = await prisma.attendanceAdjustment.create({
                data: {
                    attendanceId: recordId,
                    submittedById: requestedById,
                    type: 'DELETE',
                    originalCheckIn: existing.checkInTime,
                    originalCheckOut: existing.checkOutTime,
                    requestedCheckIn: null,
                    requestedCheckOut: null,
                    employeeName: `${existing.employee.firstName} ${existing.employee.lastName}`,
                    employeeBranch: (existing.employee as any).Branch?.name || null,
                    reason: String(reason).trim(),
                    status: 'pending',
                }
            });

            void audit({
                action: 'ADJUSTMENT_SUBMIT',
                entityType: 'Attendance',
                entityId: recordId,
                performedBy: requestedById,
                source: 'admin-panel',
                details: `Attendance deletion request submitted for ${existing.employee.firstName} ${existing.employee.lastName}`,
                correlationId: req.correlationId
            });

            return res.json({
                success: true,
                message: 'Deletion request submitted for admin approval.',
                data: adjustment,
                pending: true,
            });
        }

        // Admin: delete immediately
        await prisma.attendance.delete({
            where: { id: recordId }
        });

        const empName = `${existing.employee.firstName} ${existing.employee.lastName}`;
        const empBranch = (existing.employee as any).Branch?.name || '—';

        void audit({
            action: 'ATTENDANCE_DELETE',
            entityType: 'Attendance',
            entityId: recordId,
            performedBy: requestedById,
            source: 'admin-panel',
            level: 'WARN',
            details: `Admin deleted attendance record for ${empName} (Branch: ${empBranch})`,
            metadata: {
                reason: String(reason).trim(),
                employeeName: empName,
                branch: empBranch,
                originalCheckIn: existing.checkInTime?.toISOString() || null,
                originalCheckOut: existing.checkOutTime?.toISOString() || null,
                date: existing.date.toISOString(),
                changes: [
                    { field: 'record', oldValue: 'active', newValue: 'deleted' }
                ]
            },
            correlationId: req.correlationId
        });

        attendanceEmitter.emit('new-record', { type: 'delete', record: existing });

        return res.json({
            success: true,
            message: 'Attendance record deleted successfully.',
        });
    } catch (error: unknown) {
        console.error('Delete Attendance Failed:', error);
        return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
};

/**
 * PUT /api/attendance/adjustments/:id/cancel
 * Cancel a pending adjustment (owner or admin).
 */
export const cancelAdjustment = async (req: Request, res: Response) => {
    try {
        const adjustmentId = parseInt(String(req.params.id));
        if (isNaN(adjustmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid adjustment ID' });
        }

        const userId = req.user?.employeeId;
        const userRole = req.user?.role;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const adjustment = await prisma.attendanceAdjustment.findUnique({
            where: { id: adjustmentId },
            include: { attendance: true },
        });

        if (!adjustment) {
            return res.status(404).json({ success: false, message: 'Adjustment not found' });
        }

        // Only pending adjustments can be cancelled
        if (adjustment.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel — adjustment has already been ${adjustment.status}.`,
            });
        }

        // Permission: must be the original submitter (Admins should use Reject instead of Cancel)
        if (adjustment.submittedById !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only cancel your own pending requests. If you are an Admin, please use the Reject action instead.',
            });
        }

        // Cancel the adjustment
        await prisma.attendanceAdjustment.update({
            where: { id: adjustmentId },
            data: { status: 'cancelled', reviewedAt: new Date() },
        });

        // Cleanup: if this was a manual creation, delete the placeholder
        if (adjustment.originalCheckIn === null && adjustment.attendance) {
            await prisma.attendance.delete({
                where: { id: adjustment.attendance.id },
            });
            // We should also emit event so the dashboard refreshes
            attendanceEmitter.emit('new-record', { type: 'delete', record: adjustment.attendance });
        }

        void audit({
            action: 'ADJUSTMENT_CANCEL',
            entityType: 'Attendance',
            entityId: adjustment.attendanceId ?? undefined,
            performedBy: userId,
            source: 'admin-panel',
            details: `Pending adjustment #${adjustmentId} cancelled by ${userRole === 'ADMIN' ? 'admin' : 'requester'}`,
            correlationId: req.correlationId,
        });

        return res.json({ success: true, message: 'Adjustment cancelled successfully.' });
    } catch (error: unknown) {
        console.error('Cancel Adjustment Failed:', error);
        return res.status(500).json({ success: false, message: 'Failed to cancel adjustment' });
    }
};

/**
 * PUT /api/attendance/adjustments/:id/reopen
 * Admin-only: reopen a finalized (approved/rejected) adjustment
 */
export const reopenAdjustment = async (req: Request, res: Response) => {
    try {
        const adjustmentId = parseInt(String(req.params.id));
        if (isNaN(adjustmentId)) {
            return res.status(400).json({ success: false, message: 'Invalid adjustment ID' });
        }

        const adminId = req.user?.employeeId;

        const adjustment = await prisma.attendanceAdjustment.findUnique({
            where: { id: adjustmentId },
            include: { attendance: true }
        });

        if (!adjustment) {
            return res.status(404).json({ success: false, message: 'Adjustment not found' });
        }

        if (adjustment.status === 'pending') {
            return res.status(400).json({ success: false, message: 'Adjustment is already pending.' });
        }

        if (adjustment.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Cannot reopen a cancelled adjustment.' });
        }

        // Reset to pending
        await prisma.attendanceAdjustment.update({
            where: { id: adjustmentId },
            data: {
                status: 'pending',
                reviewedById: null,
                reviewedAt: null,
                rejectionReason: null
            }
        });

        void audit({
            action: 'ADJUSTMENT_REOPEN',
            entityType: 'Attendance',
            entityId: adjustment.attendanceId ?? undefined,
            performedBy: adminId,
            source: 'admin-panel',
            details: `Admin reopened adjustment #${adjustmentId} for re-review`,
            metadata: { previousStatus: adjustment.status },
            correlationId: req.correlationId,
        });

        const isDeletedMsg = (adjustment.status === 'approved' && adjustment.type === 'DELETE') 
            ? ' Note: The original attendance record was deleted when this was approved.'
            : '';

        return res.json({ success: true, message: 'Adjustment reopened successfully.' + isDeletedMsg });
    } catch (error: unknown) {
        console.error('Reopen Adjustment Failed:', error);
        return res.status(500).json({ success: false, message: 'Failed to reopen adjustment' });
    }
};

