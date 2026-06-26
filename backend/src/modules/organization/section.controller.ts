import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { auditCreate, auditUpdate, auditDelete } from '../../shared/lib/auditHelpers';

// GET /api/sections
export const getAllSections = async (req: Request, res: Response) => {
    try {
        const departmentIdQuery = req.query.departmentId;
        const whereClause: any = {};

        if (departmentIdQuery) {
            const deptId = parseInt(String(departmentIdQuery), 10);
            if (!isNaN(deptId)) {
                whereClause.departmentId = deptId;
            }
        }

        const sections = await prisma.section.findMany({
            where: whereClause,
            include: {
                department: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        res.json({
            success: true,
            sections
        });
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sections'
        });
    }
};

// POST /api/sections
export const createSection = async (req: Request, res: Response) => {
    try {
        const { name, departmentId } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Section name is required' });
        }
        if (!departmentId) {
            return res.status(400).json({ success: false, message: 'Department ID is required' });
        }

        const deptId = parseInt(String(departmentId), 10);
        if (isNaN(deptId)) {
            return res.status(400).json({ success: false, message: 'Invalid department ID' });
        }

        const departmentExists = await prisma.department.findUnique({
            where: { id: deptId }
        });
        if (!departmentExists) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        const trimmedName = name.trim().toUpperCase();
        const existing = await prisma.section.findFirst({
            where: {
                name: trimmedName,
                departmentId: deptId
            }
        });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Section already exists in this department' });
        }

        const section = await prisma.section.create({
            data: {
                name: trimmedName,
                departmentId: deptId,
                updatedAt: new Date()
            },
            include: {
                department: {
                    select: {
                        name: true
                    }
                }
            }
        });

        void auditCreate({
            entityType: 'Section',
            entityId: section.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Created new section "${section.name}" in department "${section.department.name}"`,
            correlationId: req.correlationId
        }, {
            'Name': section.name,
            'Department': section.department.name
        });

        res.status(201).json({ success: true, section });
    } catch (error) {
        console.error('Error creating section:', error);
        res.status(500).json({ success: false, message: 'Failed to create section' });
    }
};

// PUT /api/sections/:id
export const renameSection = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid section ID' });
        }
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Section name is required' });
        }

        const target = await prisma.section.findUnique({
            where: { id },
            include: {
                department: {
                    select: {
                        name: true
                    }
                }
            }
        });
        if (!target) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        const trimmedName = name.trim().toUpperCase();
        const existing = await prisma.section.findFirst({
            where: {
                name: trimmedName,
                departmentId: target.departmentId
            }
        });
        if (existing && existing.id !== id) {
            return res.status(409).json({ success: false, message: 'Section name already exists in this department' });
        }

        const section = await prisma.section.update({
            where: { id },
            data: { name: trimmedName, updatedAt: new Date() },
            include: {
                department: {
                    select: {
                        name: true
                    }
                }
            }
        });

        const changes = [];
        if (target.name !== trimmedName) {
            changes.push({ field: 'Name', oldValue: target.name, newValue: trimmedName });
        }

        void auditUpdate({
            entityType: 'Section',
            entityId: section.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Renamed section to "${section.name}" in department "${section.department.name}"`,
            correlationId: req.correlationId
        }, changes);

        res.json({ success: true, section });
    } catch (error) {
        console.error('Error renaming section:', error);
        res.status(500).json({ success: false, message: 'Failed to rename section' });
    }
};

// DELETE /api/sections/:id
export const deleteSection = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id), 10);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid section ID' });
        }
        const existing = await prisma.section.findUnique({
            where: { id },
            include: {
                department: {
                    select: {
                        name: true
                    }
                }
            }
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Section not found' });
        }

        // Check for active employees in this section
        const activeEmployeeCount = await prisma.employee.count({
            where: {
                sectionId: id,
                employmentStatus: 'ACTIVE'
            }
        });
        if (activeEmployeeCount > 0) {
            return res.status(400).json({
                success: false,
                message: `⚠️ Cannot delete this Section. There are currently ${activeEmployeeCount} employee(s) assigned to it. Please reassign or remove all employees before deleting.`
            });
        }

        await prisma.section.delete({ where: { id } });

        void auditDelete({
            entityType: 'Section',
            entityId: id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            level: 'WARN',
            details: `Deleted section "${existing.name}" from department "${existing.department.name}"`,
            correlationId: req.correlationId
        }, {
            'Name': existing.name,
            'Department': existing.department.name
        });

        res.json({ success: true, message: `Section "${existing.name}" deleted` });
    } catch (error) {
        console.error('Error deleting section:', error);
        res.status(500).json({ success: false, message: 'Failed to delete section' });
    }
};
