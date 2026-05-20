import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { Prisma } from '@prisma/client';
import { audit } from '../../shared/lib/auditLogger';
import { sendOvertimeStatusEmail, sendOvertimeAssignedEmail } from '../../shared/services/email.service';
import { validateOvertimeRequest, OTValidationError } from './overtime-validation.service';

// GET /api/attendance/overtime
export const getOvertimeRequests = async (req: Request, res: Response) => {
    try {
        const { employeeId, status, date, page: queryPage, limit: queryLimit, search, departmentId, startDate, endDate } = req.query;

        const page = parseInt(queryPage as string, 10) || 1;
        const limit = Math.min(parseInt(queryLimit as string, 10) || 20, 100);
        const skip = (page - 1) * limit;

        const where: Prisma.OvertimeRequestWhereInput = {};
        
        if (employeeId) where.employeeId = parseInt(employeeId as string, 10);
        if (status) where.status = status as string;
        
        // Exact date or date range
        if (date) {
            where.date = new Date(date as string);
        } else if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate as string);
            if (endDate) where.date.lte = new Date(endDate as string);
        }

        // Employee Search
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

        // Department filter
        if (departmentId) {
            where.employee = where.employee || {};
            where.employee.departmentId = parseInt(departmentId as string, 10);
        }

        // Scope to manager's departments if applicable
        if (req.user?.role === 'MANAGER' && req.managerDepartmentIds) {
            where.employee = where.employee || {};
            where.employee.departmentId = { in: req.managerDepartmentIds };
        }

        // If USER, they can only see their own requests
        if (req.user?.role === 'USER') {
            where.employeeId = req.user.employeeId;
            // Clean up employee-specific conditions to avoid conflicts
            delete where.employee;
        }

        const [total, requests] = await Promise.all([
            prisma.overtimeRequest.count({ where }),
            prisma.overtimeRequest.findMany({
                where,
                skip,
                take: limit,
                include: {
                    employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, Department: { select: { name: true } } } },
                    reviewedBy: { select: { id: true, firstName: true, lastName: true } }
                },
                orderBy: { submittedAt: 'desc' }
            })
        ]);

        res.json({ 
            success: true, 
            requests,
            meta: { 
                total, 
                page, 
                limit, 
                totalPages: Math.ceil(total / limit) 
            }
        });
    } catch (error) {
        console.error('Error fetching overtime requests:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch overtime requests' });
    }
};

// POST /api/attendance/overtime
export const createOvertimeRequest = async (req: Request, res: Response) => {
    try {
        const { employeeId, date, startTime, endTime, reason } = req.body;

        // If USER, they can only request for themselves
        const targetEmployeeId = req.user?.role === 'USER' ? req.user.employeeId : parseInt(employeeId, 10);

        if (!targetEmployeeId || !date || !startTime || !endTime || !reason) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const requestDate = new Date(date);

        const match = reason?.match(/^\[EXTENSION:(\d+)\]/);
        const excludeOvertimeIds: number[] = [];
        if (match) {
            excludeOvertimeIds.push(parseInt(match[1], 10));
        }

        // ── OT Validation ──────────────────────────────────────────────────
        const validationResult = await validateOvertimeRequest({
            employeeId: targetEmployeeId,
            date: requestDate,
            startTime,
            endTime,
            excludeOvertimeIds,
        });

        if (!validationResult.valid) {
            return res.status(400).json({
                success: false,
                message: validationResult.errors[0].message,
                validationErrors: validationResult.errors,
            });
        }

        // If manager creates it directly, auto-approve it.
        const status = req.user?.role === 'MANAGER' ? 'APPROVED' : 'PENDING';
        const reviewedById = status === 'APPROVED' ? req.user?.employeeId : null;
        const reviewedAt = status === 'APPROVED' ? new Date() : null;

        const request = await prisma.overtimeRequest.create({
            data: {
                employeeId: targetEmployeeId,
                date: requestDate,
                startTime,
                endTime,
                reason,
                status,
                source: 'REQUESTED',
                reviewedById,
                reviewedAt
            },
            include: {
                employee: { select: { id: true, firstName: true, lastName: true } }
            }
        });

        void audit({
            action: 'CREATE',
            entityType: 'OvertimeRequest',
            entityId: request.id,
            performedBy: req.user?.employeeId,
            details: `Created overtime request for ${request.employee.firstName} ${request.employee.lastName} on ${date}`
        });

        res.status(201).json({ success: true, message: 'Overtime request created successfully', request });
    } catch (error) {
        console.error('Error creating overtime request:', error);
        res.status(500).json({ success: false, message: 'Failed to create overtime request' });
    }
};

// POST /api/attendance/overtime/batch
export const batchCreateOvertimeRequests = async (req: Request, res: Response) => {
    try {
        const { employeeIds, date, startTime, endTime, reason } = req.body;

        if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER') {
            return res.status(403).json({ success: false, message: 'Only Managers and Admins can assign overtime' });
        }

        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0 || !date || !startTime || !endTime || !reason) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const requestDate = new Date(date);

        // Verify employees exist and, if manager, they are in manager's departments
        const employees = await prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, departmentId: true, firstName: true, lastName: true, email: true }
        });

        if (employees.length !== employeeIds.length) {
            return res.status(400).json({ success: false, message: 'One or more employees not found' });
        }

        if (req.user?.role === 'MANAGER' && req.managerDepartmentIds) {
            for (const emp of employees) {
                if (!emp.departmentId || !req.managerDepartmentIds.includes(emp.departmentId)) {
                    return res.status(403).json({ success: false, message: `Forbidden: Employee ${emp.firstName} ${emp.lastName} belongs to a department you do not manage.` });
                }
            }
        }

        // ── Per-Employee OT Validation ───────────────────────────────────────
        const allErrors: { employeeId: number; employeeName: string; errors: OTValidationError[] }[] = [];

        for (const emp of employees) {
            const result = await validateOvertimeRequest({
                employeeId: emp.id,
                date: requestDate,
                startTime,
                endTime,
            });
            if (!result.valid) {
                allErrors.push({
                    employeeId: emp.id,
                    employeeName: `${emp.firstName} ${emp.lastName}`,
                    errors: result.errors,
                });
            }
        }

        if (allErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Validation failed for ${allErrors.length} employee(s).`,
                validationErrors: allErrors,
            });
        }

        const createdRequests = await prisma.$transaction(
            employees.map(emp => prisma.overtimeRequest.create({
                data: {
                    employeeId: emp.id,
                    date: requestDate,
                    startTime,
                    endTime,
                    reason,
                    status: 'APPROVED',
                    source: 'ASSIGNED',
                    reviewedById: req.user?.employeeId,
                    reviewedAt: new Date()
                },
                include: { employee: { select: { firstName: true, lastName: true, email: true } } }
            }))
        );

        // Fire-and-forget: audit + emails
        for (const request of createdRequests) {
            void audit({
                action: 'CREATE',
                entityType: 'OvertimeRequest',
                entityId: request.id,
                performedBy: req.user?.employeeId,
                details: `Assigned overtime for ${request.employee.firstName} ${request.employee.lastName} on ${date}`
            });

            if (request.employee?.email) {
                void sendOvertimeAssignedEmail(
                    request.employee.email,
                    `${request.employee.firstName} ${request.employee.lastName}`,
                    requestDate,
                    startTime,
                    endTime,
                    reason
                );
            }
        }

        res.status(201).json({ success: true, message: 'Overtime assigned successfully', created: createdRequests.length, results: createdRequests });
    } catch (error) {
        console.error('Error assigning overtime in batch:', error);
        res.status(500).json({ success: false, message: 'Failed to assign overtime' });
    }
};

// PATCH /api/attendance/overtime/:id
export const updateOvertimeRequest = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        const { status, startTime, endTime, rejectionReason, reason, actualStartTime, actualEndTime } = req.body;

        const existing = await prisma.overtimeRequest.findUnique({ where: { id }, include: { employee: true } });
        if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });

        // Only managers/admins can approve/reject
        if (req.user?.role === 'USER') {
            // User can only edit their own pending requests (reason, time)
            if (existing.employeeId !== req.user.employeeId || existing.status !== 'PENDING') {
                return res.status(403).json({ success: false, message: 'Cannot edit this request' });
            }
            if (status && status !== existing.status) {
                return res.status(403).json({ success: false, message: 'Users cannot change status' });
            }
        }

        const dataToUpdate: Prisma.OvertimeRequestUncheckedUpdateInput = {};
        if (startTime) dataToUpdate.startTime = startTime;
        if (endTime) dataToUpdate.endTime = endTime;
        if (reason) dataToUpdate.reason = reason;

        /* TESTING ONLY - MANUAL OT EDITING (NOTE: Please delete this block after testing stage) */
        if (actualStartTime !== undefined) {
            dataToUpdate.actualStartTime = actualStartTime ? new Date(actualStartTime) : null;
        }
        if (actualEndTime !== undefined) {
            dataToUpdate.actualEndTime = actualEndTime ? new Date(actualEndTime) : null;
        }
        /* END OF TESTING ONLY BLOCK */

        if (startTime || endTime) {
            const effectiveStartTime = startTime || existing.startTime;
            const effectiveEndTime = endTime || existing.endTime;

            const match = (reason || existing.reason)?.match(/^\[EXTENSION:(\d+)\]/);
            const excludeOvertimeIds = [id];
            if (match) {
                excludeOvertimeIds.push(parseInt(match[1], 10));
            }

            const result = await validateOvertimeRequest({
                employeeId: existing.employeeId,
                date: existing.date,
                startTime: effectiveStartTime,
                endTime: effectiveEndTime,
                excludeOvertimeIds,
            });
            if (!result.valid) {
                return res.status(400).json({
                    success: false,
                    message: result.errors[0].message,
                    validationErrors: result.errors,
                });
            }
        }

        let isMerged = false;
        let mergedRequest: any = null;

        if (status && status !== existing.status && req.user?.role !== 'USER') {
            if (req.user?.role !== 'MANAGER' && req.user?.role !== 'ADMIN') {
                return res.status(403).json({ success: false, message: 'Only Managers and Admins can approve or reject overtime requests' });
            }
            
            if (status === 'APPROVED') {
                const match = existing.reason?.match(/^\[EXTENSION:(\d+)\]\s*(.*)$/);
                if (match) {
                    const originalId = parseInt(match[1], 10);
                    const extensionReason = match[2];

                    const originalRequest = await prisma.overtimeRequest.findUnique({
                        where: { id: originalId }
                    });

                    if (originalRequest && originalRequest.employeeId === existing.employeeId) {
                        // Update original request: extend its endTime and append reason
                        mergedRequest = await prisma.overtimeRequest.update({
                            where: { id: originalId },
                            data: {
                                endTime: endTime || existing.endTime,
                                reason: `${originalRequest.reason}\n[Extension Approved]: ${extensionReason}`,
                                reviewedById: req.user?.employeeId,
                                reviewedAt: new Date()
                            },
                            include: {
                                employee: { select: { id: true, firstName: true, lastName: true } },
                                reviewedBy: { select: { id: true, firstName: true, lastName: true } }
                            }
                        });

                        dataToUpdate.status = 'MERGED';
                        dataToUpdate.reviewedById = req.user?.employeeId;
                        dataToUpdate.reviewedAt = new Date();
                        isMerged = true;

                        void audit({
                            action: 'UPDATE',
                            entityType: 'OvertimeRequest',
                            entityId: originalId,
                            performedBy: req.user?.employeeId,
                            details: `Merged overtime extension request ID ${existing.id} into original OT request ID ${originalId} (New endTime: ${endTime || existing.endTime})`
                        });
                    }
                }
            }

            if (!isMerged) {
                dataToUpdate.status = status;
                dataToUpdate.reviewedById = req.user?.employeeId;
                dataToUpdate.reviewedAt = new Date();
                if (status === 'REJECTED' && rejectionReason) {
                    dataToUpdate.rejectionReason = rejectionReason;
                }
            }
        }

        const updated = await prisma.overtimeRequest.update({
            where: { id },
            data: dataToUpdate,
            include: {
                employee: { select: { id: true, firstName: true, lastName: true } },
                reviewedBy: { select: { id: true, firstName: true, lastName: true } }
            }
        });

        void audit({
            action: 'UPDATE',
            entityType: 'OvertimeRequest',
            entityId: updated.id,
            performedBy: req.user?.employeeId,
            details: isMerged
                ? `Approved and merged overtime extension request ID ${updated.id} (Status: MERGED)`
                : `Updated overtime request for ${updated.employee.firstName} ${updated.employee.lastName} (Status: ${updated.status})`
        });

        // Trigger email notification if the status was changed to APPROVED or REJECTED
        if (status && (status === 'APPROVED' || status === 'REJECTED') && existing.employee.email) {
            if (isMerged && mergedRequest) {
                void sendOvertimeStatusEmail(
                    existing.employee.email,
                    existing.employee.firstName,
                    existing.date,
                    'APPROVED',
                    undefined
                );
            } else {
                void sendOvertimeStatusEmail(
                    existing.employee.email,
                    existing.employee.firstName,
                    existing.date,
                    status as 'APPROVED' | 'REJECTED',
                    rejectionReason || undefined
                );
            }
        }

        res.json({ success: true, message: 'Overtime request updated', request: updated });
    } catch (error) {
        console.error('Error updating overtime request:', error);
        res.status(500).json({ success: false, message: 'Failed to update overtime request' });
    }
};

// DELETE /api/attendance/overtime/:id
export const deleteOvertimeRequest = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        const existing = await prisma.overtimeRequest.findUnique({ where: { id } });
        
        if (!existing) return res.status(404).json({ success: false, message: 'Request not found' });

        if (req.user?.role === 'USER' && (existing.employeeId !== req.user.employeeId || existing.status !== 'PENDING')) {
            return res.status(403).json({ success: false, message: 'Cannot delete this request' });
        }

        await prisma.overtimeRequest.update({ 
            where: { id },
            data: { status: 'DELETED' }
        });

        void audit({
            action: 'DELETE',
            entityType: 'OvertimeRequest',
            entityId: id,
            performedBy: req.user?.employeeId,
            details: `Deleted overtime request ID ${id}`
        });

        res.json({ success: true, message: 'Overtime request deleted successfully' });
    } catch (error) {
        console.error('Error deleting overtime request:', error);
        res.status(500).json({ success: false, message: 'Failed to delete overtime request' });
    }
};
