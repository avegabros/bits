import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { audit } from '../../shared/lib/auditLogger';
import { sendOvertimeStatusEmail, sendOvertimeAssignedEmail } from '../../shared/services/email.service';

// GET /api/attendance/overtime
export const getOvertimeRequests = async (req: Request, res: Response) => {
    try {
        const { employeeId, status, date } = req.query;

        const where: any = {};
        if (employeeId) where.employeeId = parseInt(employeeId as string, 10);
        if (status) where.status = status;
        if (date) where.date = new Date(date as string);

        // If USER, they can only see their own requests
        if (req.user?.role === 'USER') {
            where.employeeId = req.user.employeeId;
        }

        const requests = await prisma.overtimeRequest.findMany({
            where,
            include: {
                employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, Department: { select: { name: true } } } },
                reviewedBy: { select: { id: true, firstName: true, lastName: true } }
            },
            orderBy: { submittedAt: 'desc' }
        });

        res.json({ success: true, requests });
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

        const createdRequests = [];

        for (const emp of employees) {
            const request = await prisma.overtimeRequest.create({
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
                }
            });
            createdRequests.push(request);

            void audit({
                action: 'CREATE',
                entityType: 'OvertimeRequest',
                entityId: request.id,
                performedBy: req.user?.employeeId,
                details: `Assigned overtime for ${emp.firstName} ${emp.lastName} on ${date}`
            });

            if (emp.email) {
                void sendOvertimeAssignedEmail(
                    emp.email,
                    `${emp.firstName} ${emp.lastName}`,
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
        const { status, startTime, endTime, rejectionReason, reason } = req.body;

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

        const dataToUpdate: any = {};
        if (startTime) dataToUpdate.startTime = startTime;
        if (endTime) dataToUpdate.endTime = endTime;
        if (reason) dataToUpdate.reason = reason;

        if (status && status !== existing.status && req.user?.role !== 'USER') {
            if (req.user?.role !== 'MANAGER' && req.user?.role !== 'ADMIN') {
                return res.status(403).json({ success: false, message: 'Only Managers and Admins can approve or reject overtime requests' });
            }
            dataToUpdate.status = status;
            dataToUpdate.reviewedById = req.user?.employeeId;
            dataToUpdate.reviewedAt = new Date();
            if (status === 'REJECTED' && rejectionReason) {
                dataToUpdate.rejectionReason = rejectionReason;
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
            details: `Updated overtime request for ${updated.employee.firstName} ${updated.employee.lastName} (Status: ${updated.status})`
        });

        // Trigger email notification if the status was changed to APPROVED or REJECTED
        if (status && (status === 'APPROVED' || status === 'REJECTED') && existing.employee.email) {
            void sendOvertimeStatusEmail(
                existing.employee.email,
                existing.employee.firstName,
                existing.date,
                status as 'APPROVED' | 'REJECTED',
                rejectionReason
            );
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
