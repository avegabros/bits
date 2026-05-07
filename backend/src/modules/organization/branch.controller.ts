import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { auditCreate, auditUpdate, auditDelete } from '../../shared/lib/auditHelpers';

// GET /api/branches - Get all branches
export const getBranches = async (req: Request, res: Response) => {
    try {
        const branches = await prisma.branch.findMany({
            orderBy: {
                name: 'asc'
            },
            include: {
                companies: {
                    include: { company: true },
                },
            },
        });

        res.json({
            success: true,
            branches
        });
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch branches'
        });
    }
};

// POST /api/branches - Create a new branch
export const createBranch = async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Branch name is required' });
        }

        const existing = await prisma.branch.findUnique({ where: { name: name.trim() } });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Branch already exists' });
        }

        const branch = await prisma.branch.create({
            data: { name: name.trim(), updatedAt: new Date() }
        });

        void auditCreate({
            entityType: 'Branch',
            entityId: branch.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Created new branch "${branch.name}"`,
            correlationId: req.correlationId
        }, {
            'Name': branch.name
        });

        res.status(201).json({ success: true, branch });
    } catch (error) {
        console.error('Error creating branch:', error);
        res.status(500).json({ success: false, message: 'Failed to create branch' });
    }
};

// PUT /api/branches/:id - Rename a branch
export const renameBranch = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid branch ID' });
        }
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Branch name is required' });
        }
        const trimmedName = name.trim();
        const existing = await prisma.branch.findUnique({ where: { name: trimmedName } });
        if (existing && existing.id !== id) {
            return res.status(409).json({ success: false, message: 'Branch name already exists' });
        }
        const target = await prisma.branch.findUnique({ where: { id } });
        if (!target) {
            return res.status(404).json({ success: false, message: 'Branch not found' });
        }

        const branch = await prisma.branch.update({
            where: { id },
            data: { name: trimmedName, updatedAt: new Date() }
        });

        const changes = [];
        if (target.name !== trimmedName) {
            changes.push({ field: 'Name', oldValue: target.name, newValue: trimmedName });
        }

        void auditUpdate({
            entityType: 'Branch',
            entityId: branch.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Renamed branch to "${branch.name}"`,
            correlationId: req.correlationId
        }, changes);

        res.json({ success: true, branch });
    } catch (error) {
        console.error('Error renaming branch:', error);
        res.status(500).json({ success: false, message: 'Failed to rename branch' });
    }
};

// DELETE /api/branches/:id - Delete a branch
export const deleteBranch = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid branch ID' });
        }

        const existing = await prisma.branch.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Branch not found' });
        }

        // Check for active employees in this branch (FK-based check only)
        const activeEmployeeCount = await prisma.employee.count({
            where: {
                branchId: id,
                employmentStatus: 'ACTIVE'
            }
        });
        if (activeEmployeeCount > 0) {
            return res.status(400).json({
                success: false,
                message: `⚠️ Cannot delete this Branch. There are currently ${activeEmployeeCount} employee(s) assigned to it. Please reassign or remove all employees before deleting.`
            });
        }

        // Clean up CompanyBranch links before deleting
        await prisma.companyBranch.deleteMany({ where: { branchId: id } });

        await prisma.branch.delete({ where: { id } });

        void auditDelete({
            entityType: 'Branch',
            entityId: id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            level: 'WARN',
            details: `Deleted branch "${existing.name}"`,
            correlationId: req.correlationId
        }, {
            'Name': existing.name
        });

        res.json({ success: true, message: `Branch "${existing.name}" deleted` });
    } catch (error) {
        console.error('Error deleting branch:', error);
        res.status(500).json({ success: false, message: 'Failed to delete branch' });
    }
};

// POST /api/branches/:id/companies - Assign a company to a branch
export const addCompanyToBranch = async (req: Request, res: Response) => {
    try {
        const branchId = parseInt(String(req.params.id));
        if (isNaN(branchId)) {
            return res.status(400).json({ success: false, message: 'Invalid branch ID' });
        }

        const { companyId } = req.body;
        const companyIdNum = parseInt(String(companyId));
        if (isNaN(companyIdNum)) {
            return res.status(400).json({ success: false, message: 'Invalid company ID' });
        }

        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch) {
            return res.status(404).json({ success: false, message: 'Branch not found' });
        }

        const company = await prisma.company.findUnique({ where: { id: companyIdNum } });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        // Check if already assigned
        const existing = await prisma.companyBranch.findUnique({
            where: { companyId_branchId: { companyId: companyIdNum, branchId } },
        });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Branch is already assigned to this company' });
        }

        await prisma.companyBranch.create({
            data: { branchId, companyId: companyIdNum },
        });

        void auditUpdate({
            entityType: 'Branch',
            entityId: branchId,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Assigned branch "${branch.name}" to company "${company.name}"`,
            correlationId: req.correlationId,
        }, [{ field: 'Company Added', oldValue: '—', newValue: company.name }]);

        // Return updated branch with all companies
        const updated = await prisma.branch.findUnique({
            where: { id: branchId },
            include: { companies: { include: { company: true } } },
        });

        res.json({ success: true, branch: updated });
    } catch (error) {
        console.error('Error adding company to branch:', error);
        res.status(500).json({ success: false, message: 'Failed to assign company' });
    }
};

// DELETE /api/branches/:id/companies/:companyId - Unassign a company from a branch
export const removeCompanyFromBranch = async (req: Request, res: Response) => {
    try {
        const branchId = parseInt(String(req.params.id));
        const companyId = parseInt(String(req.params.companyId));
        if (isNaN(branchId) || isNaN(companyId)) {
            return res.status(400).json({ success: false, message: 'Invalid branch or company ID' });
        }

        const link = await prisma.companyBranch.findUnique({
            where: { companyId_branchId: { companyId, branchId } },
        });
        if (!link) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

        const [branch, company] = await Promise.all([
            prisma.branch.findUnique({ where: { id: branchId } }),
            prisma.company.findUnique({ where: { id: companyId } }),
        ]);

        await prisma.companyBranch.delete({
            where: { companyId_branchId: { companyId, branchId } },
        });

        void auditUpdate({
            entityType: 'Branch',
            entityId: branchId,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Unassigned branch "${branch?.name}" from company "${company?.name}"`,
            correlationId: req.correlationId,
        }, [{ field: 'Company Removed', oldValue: company?.name || '—', newValue: '—' }]);

        // Return updated branch with all companies
        const updated = await prisma.branch.findUnique({
            where: { id: branchId },
            include: { companies: { include: { company: true } } },
        });

        res.json({ success: true, branch: updated });
    } catch (error) {
        console.error('Error removing company from branch:', error);
        res.status(500).json({ success: false, message: 'Failed to unassign company' });
    }
};
