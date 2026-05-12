import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { auditCreate, auditUpdate, auditDelete } from '../../shared/lib/auditHelpers';

// Shared include for branch data on holiday queries
const branchInclude = {
    branches: {
        include: {
            branch: { select: { id: true, name: true } },
        },
    },
};

// GET /api/holidays — Fetch all holidays (with optional ?month=, ?year=, ?branchId= filters)
export const getHolidays = async (req: Request, res: Response) => {
    try {
        const { month, year, branchId } = req.query;

        const where: Record<string, unknown> = {};

        if (year) {
            const y = parseInt(String(year));
            if (isNaN(y)) {
                return res.status(400).json({ success: false, message: 'Invalid year parameter' });
            }

            let startDate: Date;
            let endDate: Date;

            if (month) {
                const m = parseInt(String(month));
                if (isNaN(m) || m < 1 || m > 12) {
                    return res.status(400).json({ success: false, message: 'Invalid month parameter (1-12)' });
                }
                // Month is 1-indexed, Date constructor expects 0-indexed
                startDate = new Date(Date.UTC(y, m - 1, 1));
                endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            } else {
                startDate = new Date(Date.UTC(y, 0, 1));
                endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
            }

            where.date = { gte: startDate, lte: endDate };
        }

        // When branchId is provided, return holidays that are either:
        // 1. National (no branch assignments) OR
        // 2. Assigned to the specified branch
        if (branchId) {
            const bid = parseInt(String(branchId));
            if (isNaN(bid)) {
                return res.status(400).json({ success: false, message: 'Invalid branchId parameter' });
            }
            where.OR = [
                { branches: { none: {} } },           // National holidays
                { branches: { some: { branchId: bid } } }, // Branch-specific
            ];
        }

        const holidays = await prisma.holiday.findMany({
            where,
            orderBy: { date: 'asc' },
            include: branchInclude,
        });

        res.json({ success: true, holidays });
    } catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch holidays' });
    }
};

// GET /api/holidays/:id — Fetch a single holiday
export const getHolidayById = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid holiday ID' });
        }

        const holiday = await prisma.holiday.findUnique({
            where: { id },
            include: branchInclude,
        });
        if (!holiday) {
            return res.status(404).json({ success: false, message: 'Holiday not found' });
        }

        res.json({ success: true, holiday });
    } catch (error) {
        console.error('Error fetching holiday:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch holiday' });
    }
};

// POST /api/holidays — Create a new holiday (ADMIN only)
export const createHoliday = async (req: Request, res: Response) => {
    try {
        const { name, date, description, type, branchIds } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Holiday name is required' });
        }
        if (!date) {
            return res.status(400).json({ success: false, message: 'Holiday date is required' });
        }
        if (type && !['REGULAR', 'SPECIAL'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Holiday type must be REGULAR or SPECIAL' });
        }

        // Normalize date to midnight UTC for date-only comparison
        const holidayDate = new Date(date);
        holidayDate.setUTCHours(0, 0, 0, 0);

        // FIX: Use findFirst instead of findUnique — date field may not have @unique constraint
        const existing = await prisma.holiday.findFirst({ where: { date: holidayDate } });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `A holiday already exists on this date: "${existing.name}"`
            });
        }

        // Validate branchIds if provided
        const validBranchIds: number[] = Array.isArray(branchIds)
            ? branchIds.map((id: unknown) => parseInt(String(id))).filter((id: number) => !isNaN(id))
            : [];

        const holiday = await prisma.$transaction(async (tx) => {
            const created = await tx.holiday.create({
                data: {
                    name: name.trim(),
                    date: holidayDate,
                    description: description?.trim() || null,
                    type: type || 'REGULAR',
                },
            });

            if (validBranchIds.length > 0) {
                await tx.holidayBranch.createMany({
                    data: validBranchIds.map((bid: number) => ({
                        holidayId: created.id,
                        branchId: bid,
                    })),
                });
            }

            return tx.holiday.findUnique({
                where: { id: created.id },
                include: branchInclude,
            });
        });

        void auditCreate({
            entityType: 'Holiday',
            entityId: holiday!.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Created holiday "${holiday!.name}" on ${holidayDate.toISOString().split('T')[0]}`,
            correlationId: req.correlationId
        }, {
            name: holiday!.name,
            date: holidayDate.toISOString().split('T')[0],
            type: holiday!.type,
            branchIds: validBranchIds,
        });

        res.status(201).json({ success: true, holiday });
    } catch (error) {
        console.error('Error creating holiday:', error);
        res.status(500).json({ success: false, message: 'Failed to create holiday' });
    }
};

// PUT /api/holidays/:id — Update a holiday (ADMIN only)
export const updateHoliday = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid holiday ID' });
        }

        const existing = await prisma.holiday.findUnique({
            where: { id },
            include: branchInclude,
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Holiday not found' });
        }

        const { name, date, description, type, branchIds } = req.body;

        if (type && !['REGULAR', 'SPECIAL'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Holiday type must be REGULAR or SPECIAL' });
        }

        const updateData: Record<string, unknown> = {};
        const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];

        if (name !== undefined) {
            const trimmedName = name.trim();
            if (!trimmedName) {
                return res.status(400).json({ success: false, message: 'Holiday name cannot be empty' });
            }
            if (trimmedName !== existing.name) {
                changes.push({ field: 'name', oldValue: existing.name, newValue: trimmedName });
            }
            updateData.name = trimmedName;
        }

        if (date !== undefined) {
            const newDate = new Date(date);
            newDate.setUTCHours(0, 0, 0, 0);

            // Check for duplicate date (excluding current record)
            const duplicate = await prisma.holiday.findFirst({ where: { date: newDate } });
            if (duplicate && duplicate.id !== id) {
                return res.status(409).json({
                    success: false,
                    message: `A holiday already exists on this date: "${duplicate.name}"`
                });
            }

            if (newDate.getTime() !== existing.date.getTime()) {
                changes.push({
                    field: 'date',
                    oldValue: existing.date.toISOString().split('T')[0],
                    newValue: newDate.toISOString().split('T')[0],
                });
            }
            updateData.date = newDate;
        }

        if (description !== undefined) {
            updateData.description = description?.trim() || null;
        }

        if (type !== undefined && type !== existing.type) {
            changes.push({ field: 'type', oldValue: existing.type, newValue: type });
            updateData.type = type;
        }

        // Handle branch assignment changes
        const validBranchIds: number[] | undefined = branchIds !== undefined
            ? (Array.isArray(branchIds)
                ? branchIds.map((bid: unknown) => parseInt(String(bid))).filter((bid: number) => !isNaN(bid))
                : [])
            : undefined;

        const oldBranchIds = existing.branches.map(b => b.branchId).sort();

        if (validBranchIds !== undefined) {
            const sortedNew = [...validBranchIds].sort();
            if (JSON.stringify(oldBranchIds) !== JSON.stringify(sortedNew)) {
                changes.push({
                    field: 'branchIds',
                    oldValue: JSON.stringify(oldBranchIds),
                    newValue: JSON.stringify(sortedNew),
                });
            }
        }

        const holiday = await prisma.$transaction(async (tx) => {
            await tx.holiday.update({
                where: { id },
                data: updateData,
            });

            // Replace branch assignments if branchIds was provided
            if (validBranchIds !== undefined) {
                await tx.holidayBranch.deleteMany({ where: { holidayId: id } });
                if (validBranchIds.length > 0) {
                    await tx.holidayBranch.createMany({
                        data: validBranchIds.map((bid: number) => ({
                            holidayId: id,
                            branchId: bid,
                        })),
                    });
                }
            }

            return tx.holiday.findUnique({
                where: { id },
                include: branchInclude,
            });
        });

        if (changes.length > 0) {
            void auditUpdate({
                entityType: 'Holiday',
                entityId: id,
                performedBy: req.user?.employeeId,
                source: 'admin-panel',
                details: `Updated holiday "${holiday!.name}"`,
                correlationId: req.correlationId
            }, changes);
        }

        res.json({ success: true, holiday });
    } catch (error) {
        console.error('Error updating holiday:', error);
        res.status(500).json({ success: false, message: 'Failed to update holiday' });
    }
};

// DELETE /api/holidays/:id — Delete a holiday (ADMIN only)
export const deleteHoliday = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) {
            return res.status(400).json({ success: false, message: 'Invalid holiday ID' });
        }

        const existing = await prisma.holiday.findUnique({
            where: { id },
            include: branchInclude,
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Holiday not found' });
        }

        // onDelete: Cascade on HolidayBranch handles cleanup
        await prisma.holiday.delete({ where: { id } });

        void auditDelete({
            entityType: 'Holiday',
            entityId: id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            level: 'WARN',
            details: `Deleted holiday "${existing.name}" (${existing.date.toISOString().split('T')[0]})`,
            correlationId: req.correlationId
        }, {
            name: existing.name,
            date: existing.date.toISOString().split('T')[0],
            type: existing.type,
            branchIds: existing.branches.map(b => b.branchId),
        });

        res.json({ success: true, message: `Holiday "${existing.name}" deleted` });
    } catch (error) {
        console.error('Error deleting holiday:', error);
        res.status(500).json({ success: false, message: 'Failed to delete holiday' });
    }
};