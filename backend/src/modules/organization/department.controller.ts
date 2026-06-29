import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { auditCreate, auditUpdate, auditDelete } from '../../shared/lib/auditHelpers';

// GET /api/departments
export const getAllDepartments = async (req: Request, res: Response) => {
    try {
        const departments = await prisma.department.findMany({
            orderBy: {
                name: 'asc'
            },
            include: {
                sections: {
                    include: {
                        section: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        });

        // Map Sections to match the original shape (Section[]) for backwards compatibility
        const mappedDepartments = departments.map(d => ({
            id: d.id,
            name: d.name,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
            Section: d.sections.map(s => s.section)
        }));

        res.json({
            success: true,
            departments: mappedDepartments
        });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch departments'
        });
    }
};

// POST /api/departments
export const createDepartment = async (req: Request, res: Response) => {
    try {
        const { name, sectionIds } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Department name is required' });
        }
        const trimmedName = name.trim().toUpperCase();
        const existing = await prisma.department.findFirst({ where: { name: trimmedName } });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Department already exists' });
        }

        const department = await prisma.department.create({
            data: {
                name: trimmedName,
                updatedAt: new Date(),
                sections: {
                    create: Array.isArray(sectionIds) ? sectionIds.map((sid: number) => ({
                        sectionId: sid
                    })) : []
                }
            },
            include: {
                sections: {
                    include: {
                        section: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        });

        const mappedDepartment = {
            id: department.id,
            name: department.name,
            createdAt: department.createdAt,
            updatedAt: department.updatedAt,
            Section: department.sections.map(s => s.section)
        };

        void auditCreate({
            entityType: 'Department',
            entityId: department.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Created new department "${department.name}"`,
            correlationId: req.correlationId
        }, {
            'Name': department.name
        });

        res.status(201).json({ success: true, department: mappedDepartment });
    } catch (error) {
        console.error('Error creating department:', error);
        res.status(500).json({ success: false, message: 'Failed to create department' });
    }
};

// PUT /api/departments/:id
export const renameDepartment = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }
        const { name, sectionIds } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Department name is required' });
        }
        const trimmedName = name.trim().toUpperCase();
        const existing = await prisma.department.findFirst({ where: { name: trimmedName } });
        if (existing && existing.id !== id) {
            return res.status(409).json({ success: false, message: 'Department name already exists' });
        }
        const target = await prisma.department.findUnique({
            where: { id },
            include: { sections: { select: { sectionId: true } } }
        });
        if (!target) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        // Handle section assignments if provided
        if (Array.isArray(sectionIds)) {
            const currentSectionIds = target.sections.map(s => s.sectionId);
            const toAdd = sectionIds.filter((sid: number) => !currentSectionIds.includes(sid));
            const toRemove = currentSectionIds.filter(sid => !sectionIds.includes(sid));

            // Check for active employees in sections being removed from this specific department
            if (toRemove.length > 0) {
                const activeInRemoved = await prisma.employee.count({
                    where: {
                        sectionId: { in: toRemove },
                        departmentId: id,
                        employmentStatus: 'ACTIVE'
                    }
                });
                if (activeInRemoved > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `⚠️ Cannot remove section(s) with ${activeInRemoved} active employee(s) in this department. Please reassign employees first.`
                    });
                }
                
                // Delete relationships from the join table
                await prisma.sectionDepartment.deleteMany({
                    where: {
                        departmentId: id,
                        sectionId: { in: toRemove }
                    }
                });
            }

            // Create relationships in the join table
            if (toAdd.length > 0) {
                await prisma.sectionDepartment.createMany({
                    data: toAdd.map((sid: number) => ({
                        departmentId: id,
                        sectionId: sid
                    }))
                });
            }
        }

        const department = await prisma.department.update({
            where: { id },
            data: { name: trimmedName, updatedAt: new Date() },
            include: {
                sections: {
                    include: {
                        section: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        });

        const mappedDepartment = {
            id: department.id,
            name: department.name,
            createdAt: department.createdAt,
            updatedAt: department.updatedAt,
            Section: department.sections.map(s => s.section)
        };

        const changes = [];
        if (target.name !== trimmedName) {
            changes.push({ field: 'Name', oldValue: target.name, newValue: trimmedName });
        }

        void auditUpdate({
            entityType: 'Department',
            entityId: department.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Renamed department to "${department.name}"`,
            correlationId: req.correlationId
        }, changes);

        res.json({ success: true, department: mappedDepartment });
    } catch (error) {
        console.error('Error renaming department:', error);
        res.status(500).json({ success: false, message: 'Failed to rename department' });
    }
};

// DELETE /api/departments/:id
export const deleteDepartment = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }
        const existing = await prisma.department.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        // Check for active employees in this department (FK-based check only)
        const activeEmployeeCount = await prisma.employee.count({
            where: {
                departmentId: id,
                employmentStatus: 'ACTIVE'
            }
        });
        if (activeEmployeeCount > 0) {
            return res.status(400).json({
                success: false,
                message: `⚠️ Cannot delete this Department. There are currently ${activeEmployeeCount} employee(s) assigned to it. Please reassign or remove all employees before deleting.`
            });
        }

        await prisma.department.delete({ where: { id } });

        void auditDelete({
            entityType: 'Department',
            entityId: id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            level: 'WARN',
            details: `Deleted department "${existing.name}"`,
            correlationId: req.correlationId
        }, {
            'Name': existing.name
        });

        res.json({ success: true, message: `Department "${existing.name}" deleted` });
    } catch (error) {
        console.error('Error deleting department:', error);
        res.status(500).json({ success: false, message: 'Failed to delete department' });
    }
};
