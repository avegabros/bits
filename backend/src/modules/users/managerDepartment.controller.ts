import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { audit } from '../../shared/lib/auditLogger';

export const getManagerDepartments = async (req: Request, res: Response): Promise<void> => {
    try {
        const managerId = parseInt(String(req.params.id));
        if (isNaN(managerId)) {
            res.status(400).json({ success: false, message: 'Invalid manager ID' });
            return;
        }

        const manager = await prisma.employee.findUnique({
            where: { id: managerId }
        });

        if (!manager) {
            res.status(404).json({ success: false, message: 'Manager not found' });
            return;
        }

        if (manager.role !== 'MANAGER') {
            res.status(400).json({ success: false, message: 'User is not a Manager' });
            return;
        }

        const assignments = await prisma.managerDepartment.findMany({
            where: { managerId },
            include: {
                department: {
                    select: { id: true, name: true }
                }
            }
        });

        res.status(200).json({
            success: true,
            departments: assignments.map(a => a.department)
        });

    } catch (error: unknown) {
        console.error('Failed to get manager departments:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const setManagerDepartments = async (req: Request, res: Response): Promise<void> => {
    try {
        const managerId = parseInt(String(req.params.id));
        const { departmentIds } = req.body;
        const adminId = req.user?.employeeId;

        if (isNaN(managerId)) {
            res.status(400).json({ success: false, message: 'Invalid manager ID' });
            return;
        }

        if (!Array.isArray(departmentIds)) {
            res.status(400).json({ success: false, message: 'departmentIds must be an array' });
            return;
        }

        const manager = await prisma.employee.findUnique({
            where: { id: managerId }
        });

        if (!manager) {
            res.status(404).json({ success: false, message: 'Manager not found' });
            return;
        }

        if (manager.role !== 'MANAGER') {
            res.status(400).json({ success: false, message: 'User is not a Manager' });
            return;
        }

        // Validate department IDs
        if (departmentIds.length > 0) {
            const departments = await prisma.department.findMany({
                where: { id: { in: departmentIds } }
            });
            if (departments.length !== departmentIds.length) {
                res.status(400).json({ success: false, message: 'One or more invalid department IDs' });
                return;
            }
        }

        // Execute as a transaction
        await prisma.$transaction(async (tx) => {
            // Remove existing assignments
            await tx.managerDepartment.deleteMany({
                where: { managerId }
            });

            // Add new assignments
            if (departmentIds.length > 0) {
                await tx.managerDepartment.createMany({
                    data: departmentIds.map(deptId => ({
                        managerId,
                        departmentId: deptId,
                        assignedById: adminId
                    }))
                });
            }
        });

        // Fetch names for audit logging
        const newDepts = await prisma.department.findMany({
            where: { id: { in: departmentIds } },
            select: { name: true }
        });

        void audit({
            action: 'MANAGER_DEPARTMENT_UPDATE',
            entityType: 'Account',
            entityId: managerId,
            performedBy: adminId,
            details: `Updated department assignments for Manager ${manager.firstName} ${manager.lastName}`,
            metadata: {
                managerId,
                assignedDepartments: newDepts.map(d => d.name)
            },
            correlationId: req.correlationId
        });

        res.status(200).json({
            success: true,
            message: 'Manager departments updated successfully'
        });

    } catch (error: unknown) {
        console.error('Failed to set manager departments:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
