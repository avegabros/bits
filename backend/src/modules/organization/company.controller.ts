import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { auditCreate, auditUpdate, auditDelete } from '../../shared/lib/auditHelpers';

// GET /api/companies - Get all companies with branch count
export const getCompanies = async (req: Request, res: Response) => {
    try {
        const companies = await prisma.company.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { branches: true } },
            },
        });

        res.json({ success: true, companies });
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch companies' });
    }
};

// GET /api/companies/:id - Get single company with its branches
export const getCompanyById = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid company ID' });
        }

        const company = await prisma.company.findUnique({
            where: { id },
            include: {
                branches: {
                    include: { branch: true },
                    orderBy: { branch: { name: 'asc' } },
                },
                _count: { select: { branches: true } },
            },
        });

        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        res.json({ success: true, company });
    } catch (error) {
        console.error('Error fetching company:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch company' });
    }
};

// POST /api/companies - Create a new company
export const createCompany = async (req: Request, res: Response) => {
    try {
        const { name, logo, address } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Company name is required' });
        }

        const trimmedName = name.trim();
        const existing = await prisma.company.findUnique({ where: { name: trimmedName } });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Company already exists' });
        }

        const company = await prisma.company.create({
            data: {
                name: trimmedName,
                logo: logo?.trim() || null,
                address: address?.trim() || null,
            },
            include: {
                _count: { select: { branches: true } },
            },
        });

        void auditCreate({
            entityType: 'Company',
            entityId: company.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Created new company "${company.name}"`,
            correlationId: req.correlationId,
        }, {
            'Name': company.name,
            ...(company.address ? { 'Address': company.address } : {}),
        });

        res.status(201).json({ success: true, company });
    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({ success: false, message: 'Failed to create company' });
    }
};

// PUT /api/companies/:id - Update a company
export const updateCompany = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid company ID' });
        }

        const { name, logo, address } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Company name is required' });
        }

        const trimmedName = name.trim();
        const target = await prisma.company.findUnique({ where: { id } });
        if (!target) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        // Check name uniqueness (skip self)
        const existing = await prisma.company.findUnique({ where: { name: trimmedName } });
        if (existing && existing.id !== id) {
            return res.status(409).json({ success: false, message: 'Company name already exists' });
        }

        const company = await prisma.company.update({
            where: { id },
            data: {
                name: trimmedName,
                logo: logo?.trim() || null,
                address: address?.trim() || null,
            },
            include: {
                _count: { select: { branches: true } },
            },
        });

        const changes = [];
        if (target.name !== trimmedName) {
            changes.push({ field: 'Name', oldValue: target.name, newValue: trimmedName });
        }
        const newAddress = address?.trim() || null;
        if (target.address !== newAddress) {
            changes.push({ field: 'Address', oldValue: target.address || '—', newValue: newAddress || '—' });
        }
        const newLogo = logo?.trim() || null;
        if (target.logo !== newLogo) {
            changes.push({ field: 'Logo', oldValue: target.logo ? 'set' : '—', newValue: newLogo ? 'set' : '—' });
        }

        void auditUpdate({
            entityType: 'Company',
            entityId: company.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Updated company "${company.name}"`,
            correlationId: req.correlationId,
        }, changes);

        res.json({ success: true, company });
    } catch (error) {
        console.error('Error updating company:', error);
        res.status(500).json({ success: false, message: 'Failed to update company' });
    }
};

// DELETE /api/companies/:id - Delete a company
export const deleteCompany = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid company ID' });
        }

        const existing = await prisma.company.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        // Check for linked branches via join table
        const branchCount = await prisma.companyBranch.count({ where: { companyId: id } });
        if (branchCount > 0) {
            return res.status(400).json({
                success: false,
                message: `⚠️ Cannot delete this Company. There are currently ${branchCount} branch(es) assigned to it. Please unassign all branches before deleting.`,
            });
        }

        await prisma.company.delete({ where: { id } });

        void auditDelete({
            entityType: 'Company',
            entityId: id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            level: 'WARN',
            details: `Deleted company "${existing.name}"`,
            correlationId: req.correlationId,
        }, {
            'Name': existing.name,
        });

        res.json({ success: true, message: `Company "${existing.name}" deleted` });
    } catch (error) {
        console.error('Error deleting company:', error);
        res.status(500).json({ success: false, message: 'Failed to delete company' });
    }
};
