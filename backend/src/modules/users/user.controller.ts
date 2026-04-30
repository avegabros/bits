import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/lib/prisma';
import { audit } from '../../shared/lib/auditLogger';
import { auditCreate, auditUpdate, auditDelete } from '../../shared/lib/auditHelpers';
import { enqueueGlobalDeleteUser, processDeviceSyncQueue } from '../devices/deviceSyncQueue.service';

// ── Guards ────────────────────────────────────────────────────────────────────

/**
 * Ensures at least one active ADMIN remains after excluding the given ID.
 * Prevents system lockout by blocking deactivation/deletion/role-change
 * of the last active admin.
 */
async function ensureMinimumAdmins(excludeId: number): Promise<boolean> {
    const activeAdminCount = await prisma.employee.count({
        where: {
            role: 'ADMIN',
            employmentStatus: 'ACTIVE',
            id: { not: excludeId }
        }
    });
    return activeAdminCount >= 1;
}

/**
 * Get all ADMIN and HR users (for User Accounts page)
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await prisma.employee.findMany({
            where: {
                role: { in: ['ADMIN', 'MANAGER', 'HR'] }
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                employmentStatus: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            users: users.map(u => ({
                ...u,
                status: u.employmentStatus === 'ACTIVE' ? 'active' : 'inactive',
            })),
        });
    } catch (error: unknown) {
        console.error('Get users failed:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
};

/**
 * Create a new ADMIN or HR user
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { firstName, lastName, email, password, role } = req.body;

        // Check for existing user with same email
        const existing = await prisma.employee.findFirst({ where: { email } });
        if (existing) {
            void audit({
                action: 'CREATE',
                level: 'WARN',
                entityType: 'Account',
                performedBy: req.user?.employeeId,
                source: 'admin-panel',
                details: `Failed to create admin/HR account: Email already exists`,
                metadata: { snapshot: { 'Email': email, 'Role': role } },
                correlationId: req.correlationId
            });
            
            res.status(400).json({ success: false, message: 'A user with this email already exists' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Privilege escalation guard: MANAGER cannot create ADMIN accounts
        const requesterRole = req.user?.role;
        if (requesterRole === 'MANAGER' && role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Managers cannot create Admin accounts. Only Admins can assign the Admin role.' });
            return;
        }

        const newUser = await prisma.employee.create({
            data: {
                firstName,
                lastName,
                email,
                password: hashedPassword,
                role,
                updatedAt: new Date(),
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                employmentStatus: true,
                createdAt: true,
            },
        });

        void auditCreate({
            entityType: 'Account',
            entityId: newUser.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Created new ${role} account for ${firstName} ${lastName}`,
            correlationId: req.correlationId
        }, {
            'Name': `${firstName} ${lastName}`,
            'Email': email,
            'Role': role
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                ...newUser,
                status: newUser.employmentStatus === 'ACTIVE' ? 'active' : 'inactive',
            },
        });
    } catch (error: unknown) {
        console.error('Create user failed:', error);
        
        void audit({
            action: 'CREATE',
            level: 'ERROR',
            entityType: 'Account',
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Failed to create admin/HR account due to server error: ${error instanceof Error ? error.message : String(error)}`,
            metadata: { snapshot: { 'Error': error instanceof Error ? error.message : String(error) } },
            correlationId: req.correlationId
        });

        res.status(500).json({ success: false, message: 'Failed to create user' });
    }
};

/**
 * Update user details (name, email, role)
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id as string);
        const { firstName, lastName, email, role, password } = req.body;

        // Verify user exists and is ADMIN/HR
        const user = await prisma.employee.findUnique({ where: { id } });
        if (!user || !['ADMIN', 'MANAGER', 'HR'].includes(user.role)) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        // Privilege escalation guard: MANAGER cannot modify ADMIN accounts
        const requesterRole = req.user?.role;
        if (requesterRole === 'MANAGER' && user.role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Managers cannot modify Admin accounts.' });
            return;
        }
        if (requesterRole === 'MANAGER' && role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Managers cannot promote users to Admin.' });
            return;
        }

        // Check email uniqueness if changed
        if (email && email !== user.email) {
            const emailTaken = await prisma.employee.findFirst({ where: { email, NOT: { id } } });
            if (emailTaken) {
                res.status(400).json({ success: false, message: 'Email already in use' });
                return;
            }
        }

        // Guard: if changing ADMIN → HR, ensure at least one admin remains
        if (role && role !== user.role && user.role === 'ADMIN') {
            const safeToChange = await ensureMinimumAdmins(id);
            if (!safeToChange) {
                res.status(400).json({
                    success: false,
                    message: 'Cannot change role: this is the last active admin. At least one admin must remain.'
                });
                return;
            }
        }

        const updateData: Record<string, unknown> = {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(email && { email }),
            ...(role && ['ADMIN', 'MANAGER', 'HR'].includes(role) && { role }),
        };

        // If password is provided, hash it
        if (password && password.length >= 8) {
            updateData.password = await bcrypt.hash(password, 10);
            updateData.needsPasswordChange = false;
        }

        const updated = await prisma.employee.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                employmentStatus: true,
                createdAt: true,
            },
        });

        const changes: { field: string; oldValue: string; newValue: string }[] = [];
        for (const [key, newValue] of Object.entries(updateData)) {
            if (key === 'password' || key === 'updatedAt' || key === 'needsPasswordChange') continue;
            const oldValue = (user as Record<string, unknown>)[key];
            if (oldValue !== newValue) {
                const oldValStr = oldValue instanceof Date ? oldValue.toISOString().split('T')[0] : String(oldValue || 'empty');
                const newValStr = newValue instanceof Date ? newValue.toISOString().split('T')[0] : String(newValue || 'empty');
                if (oldValStr !== newValStr) {
                    changes.push({
                        field: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim(),
                        oldValue: oldValStr,
                        newValue: newValStr
                    });
                }
            }
        }
        const passwordChanged = password && password.length >= 8;

        if (changes.length > 0) {
            void auditUpdate({
                entityType: 'Account',
                entityId: updated.id,
                performedBy: req.user?.employeeId,
                source: 'admin-panel',
                details: passwordChanged
                    ? `Updated account details and changed password for ${updated.firstName} ${updated.lastName}`
                    : `Updated account details for ${updated.firstName} ${updated.lastName}`,
                correlationId: req.correlationId
            }, changes);
        } else if (passwordChanged) {
            void audit({
                action: 'UPDATE',
                entityType: 'Account',
                entityId: updated.id,
                performedBy: req.user?.employeeId,
                source: 'admin-panel',
                details: `Changed password for ${updated.firstName} ${updated.lastName}`,
                correlationId: req.correlationId
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                ...updated,
                status: updated.employmentStatus === 'ACTIVE' ? 'active' : 'inactive',
            },
        });
    } catch (error: unknown) {
        console.error('Update user failed:', error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
};

/**
 * Soft-delete a user (set employmentStatus to INACTIVE)
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id as string);

        // Prevent self-deletion
        if (req.user?.employeeId === id) {
            res.status(400).json({ success: false, message: 'You cannot delete your own account' });
            return;
        }

        const user = await prisma.employee.findUnique({ where: { id } });
        if (!user || !['ADMIN', 'MANAGER', 'HR'].includes(user.role)) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        // Privilege escalation guard: MANAGER cannot delete ADMIN accounts
        const requesterRole = req.user?.role;
        if (requesterRole === 'MANAGER' && user.role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Managers cannot deactivate Admin accounts.' });
            return;
        }

        // Guard: prevent deactivating the last active admin
        if (user.role === 'ADMIN') {
            const safeToDelete = await ensureMinimumAdmins(id);
            if (!safeToDelete) {
                res.status(400).json({
                    success: false,
                    message: 'Cannot deactivate the last active admin. At least one admin must remain to prevent system lockout.'
                });
                return;
            }
        }

        await prisma.employee.update({
            where: { id },
            data: { employmentStatus: 'INACTIVE' },
        });

        // Invalidate all sessions
        await prisma.refreshToken.deleteMany({ where: { employeeId: id } });

        void auditUpdate({
            entityType: 'Account',
            entityId: id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            level: 'WARN',
            details: `Deactivated (soft-deleted) user account for ${user.firstName} ${user.lastName}`,
            correlationId: req.correlationId
        }, [
            { field: 'Status', oldValue: 'Active', newValue: 'Inactive' }
        ]);

        // Clean up from devices if they have a zkId
        if (user.zkId) {
            setImmediate(async () => {
                try {
                    await enqueueGlobalDeleteUser(user.zkId!);
                    const devices = await prisma.device.findMany({
                        where: { isActive: true, syncEnabled: true },
                        select: { id: true },
                    });
                    for (const d of devices) {
                        try { await processDeviceSyncQueue(d.id); } catch { /* retry later */ }
                    }
                } catch (err: unknown) {
                    console.error(`[API] (background) Failed to queue device deletion for user ${id}:`, err);
                }
            });
        }

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error: unknown) {
        console.error('Delete user failed:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
};

/**
 * Toggle user active/inactive status
 */
export const toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id as string);

        const user = await prisma.employee.findUnique({ where: { id } });
        if (!user || !['ADMIN', 'MANAGER', 'HR'].includes(user.role)) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        // Privilege escalation guard: MANAGER cannot toggle ADMIN accounts
        const requesterRole = req.user?.role;
        if (requesterRole === 'MANAGER' && user.role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Managers cannot change Admin account status.' });
            return;
        }

        const newStatus = user.employmentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

        // Block self-deactivation — server-side enforcement
        if (newStatus === 'INACTIVE' && req.user?.employeeId === id) {
            res.status(400).json({
                success: false,
                message: 'You cannot deactivate your own account'
            });
            return;
        }

        // Guard: prevent deactivating the last active admin
        if (newStatus === 'INACTIVE' && user.role === 'ADMIN') {
            const safeToDeactivate = await ensureMinimumAdmins(id);
            if (!safeToDeactivate) {
                res.status(400).json({
                    success: false,
                    message: 'Cannot deactivate the last active admin. At least one admin must remain to prevent system lockout.'
                });
                return;
            }
        }

        const updated = await prisma.employee.update({
            where: { id },
            data: { employmentStatus: newStatus },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                employmentStatus: true,
                createdAt: true,
            },
        });

        // When deactivating, invalidate all sessions by deleting refresh tokens
        if (newStatus === 'INACTIVE') {
            await prisma.refreshToken.deleteMany({ where: { employeeId: id } });

            // Clean up from devices if they have a zkId
            if (user.zkId) {
                setImmediate(async () => {
                    try {
                        await enqueueGlobalDeleteUser(user.zkId!);
                        const devices = await prisma.device.findMany({
                            where: { isActive: true, syncEnabled: true },
                            select: { id: true },
                        });
                        for (const d of devices) {
                            try { await processDeviceSyncQueue(d.id); } catch { /* retry later */ }
                        }
                    } catch (err: unknown) {
                        console.error(`[API] (background) Failed to queue device deletion for user ${id}:`, err);
                    }
                });
            }
        }

        void auditUpdate({
            entityType: 'Account',
            entityId: updated.id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Changed account status to ${newStatus === 'ACTIVE' ? 'Active' : 'Inactive'} for ${updated.firstName} ${updated.lastName}`,
            correlationId: req.correlationId
        }, [
            { field: 'Status', oldValue: user.employmentStatus === 'ACTIVE' ? 'Active' : 'Inactive', newValue: newStatus === 'ACTIVE' ? 'Active' : 'Inactive' }
        ]);

        res.json({
            success: true,
            message: `User status changed to ${newStatus}`,
            user: {
                ...updated,
                status: updated.employmentStatus === 'ACTIVE' ? 'active' : 'inactive',
            },
        });
    } catch (error: unknown) {
        console.error('Toggle status failed:', error);
        res.status(500).json({ success: false, message: 'Failed to toggle user status' });
    }
};

/**
 * Update own profile (for Account Settings page)
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const employeeId = req.user!.employeeId;
        const { firstName, lastName, contactNumber } = req.body;

        const updated = await prisma.employee.update({
            where: { id: employeeId },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(contactNumber !== undefined && { contactNumber }),
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                contactNumber: true,
            },
        });

        void audit({
            action: 'UPDATE',
            entityType: 'Account',
            entityId: updated.id,
            performedBy: employeeId,
            source: 'admin-panel',
            details: `User updated their own profile`,
            correlationId: req.correlationId
        });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            employee: updated,
        });
    } catch (error: unknown) {
        console.error('Update profile failed:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
};

/**
 * Change own password (for Account Settings page)
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const employeeId = req.user!.employeeId;
        const { currentPassword, newPassword } = req.body;

        const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee || !employee.password) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        const isValid = await bcrypt.compare(currentPassword, employee.password);
        if (!isValid) {
            res.status(401).json({ success: false, message: 'Current password is incorrect' });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.employee.update({
            where: { id: employeeId },
            data: { password: hashedPassword, needsPasswordChange: false },
        });

        void audit({
            action: 'UPDATE',
            entityType: 'Account',
            entityId: employeeId,
            performedBy: employeeId,
            source: 'admin-panel',
            details: `User changed their own password`,
            correlationId: req.correlationId
        });

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error: unknown) {
        console.error('Change password failed:', error);
        res.status(500).json({ success: false, message: 'Failed to change password' });
    }
};

/**
 * Permanently delete an INACTIVE user account.
 * Only allowed for already-deactivated accounts. Protects last admin.
 */
export const permanentDeleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id as string);

        // Prevent self-deletion
        if (req.user?.employeeId === id) {
            res.status(400).json({ success: false, message: 'You cannot permanently delete your own account' });
            return;
        }

        const user = await prisma.employee.findUnique({
            where: { id },
            select: { id: true, firstName: true, lastName: true, email: true, role: true, employmentStatus: true, zkId: true },
        });

        if (!user || !['ADMIN', 'MANAGER', 'HR'].includes(user.role)) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        // Privilege escalation guard: MANAGER cannot delete ADMIN accounts
        const requesterRole = req.user?.role;
        if (requesterRole === 'MANAGER' && user.role === 'ADMIN') {
            res.status(403).json({ success: false, message: 'Managers cannot permanently delete Admin accounts.' });
            return;
        }

        // Only allow permanent deletion of inactive accounts
        if (user.employmentStatus === 'ACTIVE') {
            res.status(400).json({
                success: false,
                message: 'Cannot permanently delete an active user. Please deactivate them first.'
            });
            return;
        }

        // Guard: protect last admin even if inactive (they could be reactivated)
        if (user.role === 'ADMIN') {
            const totalAdmins = await prisma.employee.count({ where: { role: 'ADMIN' } });
            if (totalAdmins <= 1) {
                res.status(400).json({
                    success: false,
                    message: 'Cannot permanently delete the last admin account. The system requires at least one admin.'
                });
                return;
            }
        }

        // Transaction: clean up related data, then delete
        await prisma.$transaction(async (tx) => {
            await tx.refreshToken.deleteMany({ where: { employeeId: id } });
            await tx.employee.delete({ where: { id } });
        });

        void auditDelete({
            entityType: 'Account',
            entityId: id,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            level: 'WARN',
            details: `Permanently deleted user account: ${user.firstName} ${user.lastName} (${user.role})`,
            correlationId: req.correlationId
        }, {
            'Email': user.email,
            'Role': user.role
        });

        res.json({ success: true, message: `User "${user.firstName} ${user.lastName}" permanently deleted` });

        // Fire-and-forget: queue deletion from biometric devices
        if (user.zkId) {
            setImmediate(async () => {
                try {
                    await enqueueGlobalDeleteUser(user.zkId!);
                    const devices = await prisma.device.findMany({
                        where: { isActive: true, syncEnabled: true },
                        select: { id: true },
                    });
                    for (const d of devices) {
                        try { await processDeviceSyncQueue(d.id); } catch { /* retry later */ }
                    }
                } catch (err: unknown) {
                    console.error(`[API] (background) Failed to queue device deletion for permanently deleted user ${id}:`, err);
                }
            });
        }
    } catch (error: unknown) {
        console.error('Permanent delete user failed:', error);
        res.status(500).json({ success: false, message: 'Failed to permanently delete user' });
    }
};
