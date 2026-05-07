import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { audit } from '../../shared/lib/auditLogger';
import { auditUpdate, auditCreate, auditDelete, buildChanges } from '../../shared/lib/auditHelpers';

const FIELD_NAMES: Record<string, string> = {
    shiftCode: 'Shift Code',
    name: 'Name',
    startTime: 'Start Time',
    endTime: 'End Time',
    graceMinutes: 'Grace Period (mins)',
    breakMinutes: 'Break Duration (mins)',
    isNightShift: 'Night Shift',
    isActive: 'Status',
    description: 'Description',
    workDays: 'Work Days',
    halfDays: 'Half Days',
    halfDayHours: 'Half Day Hours',
    breaks: 'Breaks'
};

const formatShiftValue = (key: string, val: unknown): string => {
    if (val === null || val === undefined) return 'None';
    if (key === 'isNightShift') return val ? 'Yes' : 'No';
    if (key === 'isActive') return val ? 'Active' : 'Inactive';
    if (key === 'workDays' || key === 'halfDays' || key === 'breaks') {
        try {
            const parsed = typeof val === 'string' ? JSON.parse(val) : val;
            if (Array.isArray(parsed)) {
                if (parsed.length === 0) return 'None';
                if (key === 'breaks') return parsed.map((b: { start?: string; from?: string; end?: string; to?: string }) => `${b.start || b.from || ''} to ${b.end || b.to || ''}`).join(', ');
                return parsed.join(', ');
            }
        } catch { }
    }
    return String(val);
};

// GET /api/shifts - Get all shifts
export const getAllShifts = async (req: Request, res: Response) => {
    try {
        const shifts = await prisma.shift.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { Employee: true } } }
        });

        res.json({ success: true, shifts });
    } catch (error) {
        console.error('Error fetching shifts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch shifts' });
    }
};

// GET /api/shifts/:id - Get single shift
export const getShiftById = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid shift ID' });

        const shift = await prisma.shift.findUnique({
            where: { id },
            include: { _count: { select: { Employee: true } } }
        });

        if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

        res.json({ success: true, shift });
    } catch (error) {
        console.error('Error fetching shift:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch shift' });
    }
};

// POST /api/shifts - Create a shift
export const createShift = async (req: Request, res: Response) => {
    try {
        const { shiftCode, name, startTime, endTime, graceMinutes, breakMinutes, isNightShift, description, workDays, halfDays, halfDayHours, breaks } = req.body;

        if (!shiftCode?.trim() || !name?.trim() || !startTime?.trim() || !endTime?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'shiftCode, name, startTime, and endTime are required'
            });
        }

        // Validate time format H:MM or HH:MM
        const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            return res.status(400).json({ success: false, message: 'Times must be in H:MM or HH:MM format (24-hour)' });
        }

        // Validate break time ranges
        if (Array.isArray(breaks) && breaks.length > 0) {
            for (const brk of breaks) {
                const brkFrom = (brk.from || brk.start || '').trim();
                const brkTo = (brk.to || brk.end || '').trim();

                if (!brkFrom || !brkTo) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each break must have both a "from" and "to" time.'
                    });
                }

                if (!timeRegex.test(brkFrom) || !timeRegex.test(brkTo)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Break times must be in H:MM or HH:MM format (24-hour).'
                    });
                }

                const toMinutes = (t: string) => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m;
                };

                if (toMinutes(brkTo) <= toMinutes(brkFrom)) {
                    return res.status(400).json({
                        success: false,
                        message: `Break "to" time (${brkTo}) must be later than "from" time (${brkFrom}).`
                    });
                }

                const shiftStart = (startTime || '').trim()
                const shiftEnd = (endTime || '').trim()
                if (shiftStart && shiftEnd) {
                    const shiftStartMins = toMinutes(shiftStart)
                    const shiftEndMins = toMinutes(shiftEnd)
                    const breakStartMins = toMinutes(brkFrom)
                    const breakEndMins = toMinutes(brkTo)
                    const isOvernight = shiftEndMins <= shiftStartMins
                    if (isOvernight) {
                        const validStart = breakStartMins >= shiftStartMins || breakStartMins < shiftEndMins
                        const validEnd = breakEndMins > shiftStartMins || breakEndMins <= shiftEndMins
                        if (!validStart || !validEnd) {
                            return res.status(400).json({
                                success: false,
                                message: `Break ${brkFrom}–${brkTo} must fall within the shift hours (${shiftStart}–${shiftEnd}).`
                            })
                        }
                    } else {
                        if (breakStartMins < shiftStartMins || breakEndMins > shiftEndMins) {
                            return res.status(400).json({
                                success: false,
                                message: `Break ${brkFrom}–${brkTo} must fall within the shift hours (${shiftStart}–${shiftEnd}).`
                            })
                        }
                    }
                }
            }
        }

        const existingCode = await prisma.shift.findFirst({ where: { shiftCode: shiftCode.trim().toUpperCase() } });
        if (existingCode) return res.status(409).json({ success: false, message: 'Shift code already exists' });

        const existingName = await prisma.shift.findFirst({ where: { name: name.trim() } });
        if (existingName) return res.status(409).json({ success: false, message: 'Shift name already exists' });

        const shift = await prisma.shift.create({
            data: {
                shiftCode: shiftCode.trim().toUpperCase(),
                name: name.trim(),
                startTime: startTime.trim(),
                endTime: endTime.trim(),
                graceMinutes: graceMinutes != null ? parseInt(graceMinutes) : 0,
                breakMinutes: breakMinutes != null ? parseInt(breakMinutes) : 60,
                isNightShift: isNightShift === true || isNightShift === 'true',
                description: description?.trim() || null,
                workDays: Array.isArray(workDays) ? JSON.stringify(workDays) : '["Mon","Tue","Wed","Thu","Fri"]',
                halfDays: Array.isArray(halfDays) ? JSON.stringify(halfDays) : '[]',
                halfDayHours: halfDayHours != null && parseFloat(halfDayHours) > 0 ? parseFloat(halfDayHours) : null,
                breaks: Array.isArray(breaks) ? JSON.stringify(breaks) : '[]',
            }
        });

        void auditCreate({
            entityType: 'Shift',
            entityId: shift.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Created new shift "${shift.name}" (${shift.shiftCode})`,
            correlationId: req.correlationId
        }, {
            'Shift Code': shift.shiftCode,
            'Name': shift.name,
            'Schedule': `${shift.startTime} - ${shift.endTime}`,
            'Night Shift': shift.isNightShift ? 'Yes' : 'No',
            'Work Days': formatShiftValue('workDays', shift.workDays),
            'Breaks': formatShiftValue('breaks', shift.breaks),
            'Grace Period': `${shift.graceMinutes} mins`
        });

        res.status(201).json({ success: true, shift });
    } catch (error: unknown) {
        console.error('Error creating shift:', error);
        res.status(500).json({ success: false, message: 'Failed to create shift' });
    }
};

// PUT /api/shifts/:id - Update a shift
export const updateShift = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid shift ID' });

        const existing = await prisma.shift.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ success: false, message: 'Shift not found' });

        const { shiftCode, name, startTime, endTime, graceMinutes, breakMinutes, isNightShift, isActive, description, workDays, halfDays, halfDayHours, breaks } = req.body;

        const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
        if (startTime && !timeRegex.test(startTime)) return res.status(400).json({ success: false, message: 'startTime must be H:MM or HH:MM (24-hour)' });
        if (endTime && !timeRegex.test(endTime)) return res.status(400).json({ success: false, message: 'endTime must be H:MM or HH:MM (24-hour)' });

        // Validate break time ranges
        if (Array.isArray(breaks) && breaks.length > 0) {
            for (const brk of breaks) {
                const brkFrom = (brk.from || brk.start || '').trim();
                const brkTo = (brk.to || brk.end || '').trim();

                if (!brkFrom || !brkTo) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each break must have both a "from" and "to" time.'
                    });
                }

                if (!timeRegex.test(brkFrom) || !timeRegex.test(brkTo)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Break times must be in H:MM or HH:MM format (24-hour).'
                    });
                }

                const toMinutes = (t: string) => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m;
                };

                if (toMinutes(brkTo) <= toMinutes(brkFrom)) {
                    return res.status(400).json({
                        success: false,
                        message: `Break "to" time (${brkTo}) must be later than "from" time (${brkFrom}).`
                    });
                }

                const effectiveStart = (startTime || existing.startTime || '').trim()
                const effectiveEnd = (endTime || existing.endTime || '').trim()
                if (effectiveStart && effectiveEnd) {
                    const shiftStartMins = toMinutes(effectiveStart)
                    const shiftEndMins = toMinutes(effectiveEnd)
                    const breakStartMins = toMinutes(brkFrom)
                    const breakEndMins = toMinutes(brkTo)
                    const isOvernight = shiftEndMins <= shiftStartMins
                    if (isOvernight) {
                        const validStart = breakStartMins >= shiftStartMins || breakStartMins < shiftEndMins
                        const validEnd = breakEndMins > shiftStartMins || breakEndMins <= shiftEndMins
                        if (!validStart || !validEnd) {
                            return res.status(400).json({
                                success: false,
                                message: `Break ${brkFrom}–${brkTo} must fall within the shift hours (${effectiveStart}–${effectiveEnd}).`
                            })
                        }
                    } else {
                        if (breakStartMins < shiftStartMins || breakEndMins > shiftEndMins) {
                            return res.status(400).json({
                                success: false,
                                message: `Break ${brkFrom}–${brkTo} must fall within the shift hours (${effectiveStart}–${effectiveEnd}).`
                            })
                        }
                    }
                }
            }
        }

        // Check uniqueness for code/name only if they differ from existing
        if (shiftCode && shiftCode.trim().toUpperCase() !== existing.shiftCode) {
            const dup = await prisma.shift.findFirst({ where: { shiftCode: shiftCode.trim().toUpperCase() } });
            if (dup) return res.status(409).json({ success: false, message: 'Shift code already in use' });
        }
        if (name && name.trim() !== existing.name) {
            const dup = await prisma.shift.findFirst({ where: { name: name.trim() } });
            if (dup) return res.status(409).json({ success: false, message: 'Shift name already in use' });
        }

        const updateData: Record<string, unknown> = {
            ...(shiftCode && { shiftCode: shiftCode.trim().toUpperCase() }),
            ...(name && { name: name.trim() }),
            ...(startTime && { startTime: startTime.trim() }),
            ...(endTime && { endTime: endTime.trim() }),
            ...(graceMinutes != null && { graceMinutes: parseInt(graceMinutes) }),
            ...(breakMinutes != null && { breakMinutes: parseInt(breakMinutes) }),
            ...(isNightShift != null && { isNightShift: isNightShift === true || isNightShift === 'true' }),
            ...(isActive != null && { isActive: isActive === true || isActive === 'true' }),
            ...(description !== undefined && { description: description?.trim() || null }),
            ...(workDays !== undefined && { workDays: Array.isArray(workDays) ? JSON.stringify(workDays) : workDays }),
            ...(halfDays !== undefined && { halfDays: Array.isArray(halfDays) ? JSON.stringify(halfDays) : halfDays }),
            ...(halfDayHours !== undefined && { halfDayHours: halfDayHours != null && parseFloat(halfDayHours) > 0 ? parseFloat(halfDayHours) : null }),
            ...(breaks !== undefined && { breaks: Array.isArray(breaks) ? JSON.stringify(breaks) : breaks }),
        };

        const shift = await prisma.shift.update({
            where: { id },
            data: updateData
        });

        const trackedFields = Object.keys(updateData).filter(k => k !== 'updatedAt');
        const rawChanges = buildChanges(existing as Record<string, unknown>, updateData, trackedFields);

        const readableChanges = rawChanges.map(c => ({
            field: FIELD_NAMES[c.field] || c.field,
            oldValue: formatShiftValue(c.field, c.oldValue),
            newValue: formatShiftValue(c.field, c.newValue)
        }));

        void auditUpdate({
            entityType: 'Shift',
            entityId: shift.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Updated shift "${shift.name}" (${shift.shiftCode})`,
            correlationId: req.correlationId
        }, readableChanges);

        res.json({ success: true, shift });
    } catch (error: unknown) {
        console.error('Error updating shift:', error);
        res.status(500).json({ success: false, message: 'Failed to update shift' });
    }
};

// PATCH /api/shifts/:id/toggle - Toggle isActive status
export const toggleShift = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid shift ID' });

        const existing = await prisma.shift.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ success: false, message: 'Shift not found' });

        const shift = await prisma.shift.update({
            where: { id },
            data: { isActive: !existing.isActive }
        });

        void auditUpdate({
            entityType: 'Shift',
            entityId: shift.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Shift "${shift.name}" was ${shift.isActive ? 'activated' : 'deactivated'}`,
            correlationId: req.correlationId
        }, [
            { field: 'Status', oldValue: existing.isActive ? 'Active' : 'Inactive', newValue: shift.isActive ? 'Active' : 'Inactive' }
        ]);

        res.json({ success: true, shift, message: `Shift ${shift.isActive ? 'activated' : 'deactivated'}` });
    } catch (error) {
        console.error('Error toggling shift:', error);
        res.status(500).json({ success: false, message: 'Failed to toggle shift status' });
    }
};

// DELETE /api/shifts/:id - Delete a shift
export const deleteShift = async (req: Request, res: Response) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid shift ID' });

        const existing = await prisma.shift.findUnique({
            where: { id },
            include: { _count: { select: { Employee: true } } }
        });
        if (!existing) return res.status(404).json({ success: false, message: 'Shift not found' });

        if (existing._count.Employee > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete shift with ${existing._count.Employee} assigned employee(s). Reassign them first.`
            });
        }

        await prisma.shift.delete({ where: { id } });

        void auditDelete({
            entityType: 'Shift',
            entityId: id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            level: 'WARN',
            details: `Deleted shift "${existing.name}"`,
            correlationId: req.correlationId
        }, {
            'Shift Code': existing.shiftCode,
            'Name': existing.name,
            'Schedule': `${existing.startTime} - ${existing.endTime}`
        });

        res.json({ success: true, message: `Shift "${existing.name}" deleted` });
    } catch (error: unknown) {
        console.error('Error deleting shift:', error);
        res.status(500).json({ success: false, message: 'Failed to delete shift' });
    }
};

// GET /api/shifts/next-employee-number - Generate next employee number for today
export const getNextEmployeeNumber = async (req: Request, res: Response) => {
    try {
        // Format: AVG-EMP-YYMMDD## where ## is the count of employees registered today (01-indexed)
        const now = new Date();
        // Use PHT (UTC+8)
        const phtOffset = 8 * 60 * 60 * 1000;
        const phtNow = new Date(now.getTime() + phtOffset);

        const yy = String(phtNow.getUTCFullYear()).slice(-2);
        const mm = String(phtNow.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(phtNow.getUTCDate()).padStart(2, '0');
        const prefix = `AVG-EMP-${yy}${mm}${dd}`;

        // Count employees whose employeeNumber starts with today's prefix
        const todayEmployees = await prisma.employee.findMany({
            where: { employeeNumber: { startsWith: prefix } },
            select: { employeeNumber: true }
        });

        const nextSequence = String(todayEmployees.length + 1).padStart(2, '0');
        const employeeNumber = `${prefix}${nextSequence}`;

        res.json({ success: true, employeeNumber });
    } catch (error: unknown) {
        console.error('Error generating employee number:', error);
        res.status(500).json({ success: false, message: 'Failed to generate employee number' });
    }
};
