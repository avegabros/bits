import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

/**
 * Get all ADMIN and HR users (for User Accounts page)
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await prisma.employee.findMany({
            where: {
                role: { in: ['ADMIN', 'HR'] }
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
    } catch (error: any) {
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

        if (!firstName || !lastName || !email || !password) {
            res.status(400).json({ success: false, message: 'First name, last name, email, and password are required' });
            return;
        }

        if (!['ADMIN', 'HR'].includes(role)) {
            res.status(400).json({ success: false, message: 'Role must be ADMIN or HR' });
            return;
        }

        // Check for existing user with same email
        const existing = await prisma.employee.findFirst({ where: { email } });
        if (existing) {
            res.status(400).json({ success: false, message: 'A user with this email already exists' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

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

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                ...newUser,
                status: newUser.employmentStatus === 'ACTIVE' ? 'active' : 'inactive',
            },
        });
    } catch (error: any) {
        console.error('Create user failed:', error);
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
        if (!user || !['ADMIN', 'HR'].includes(user.role)) {
            res.status(404).json({ success: false, message: 'User not found' });
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

        const updateData: any = {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(email && { email }),
            ...(role && ['ADMIN', 'HR'].includes(role) && { role }),
        };

        // If password is provided, hash it
        if (password && password.length >= 8) {
            updateData.password = await bcrypt.hash(password, 10);
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

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                ...updated,
                status: updated.employmentStatus === 'ACTIVE' ? 'active' : 'inactive',
            },
        });
    } catch (error: any) {
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
        if (!user || !['ADMIN', 'HR'].includes(user.role)) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        await prisma.employee.update({
            where: { id },
            data: { employmentStatus: 'INACTIVE' },
        });

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error: any) {
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
        if (!user || !['ADMIN', 'HR'].includes(user.role)) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }

        const newStatus = user.employmentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

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

        res.json({
            success: true,
            message: `User status changed to ${newStatus}`,
            user: {
                ...updated,
                status: updated.employmentStatus === 'ACTIVE' ? 'active' : 'inactive',
            },
        });
    } catch (error: any) {
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

        res.json({
            success: true,
            message: 'Profile updated successfully',
            employee: updated,
        });
    } catch (error: any) {
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

        if (!currentPassword || !newPassword) {
            res.status(400).json({ success: false, message: 'Current password and new password are required' });
            return;
        }

        if (newPassword.length < 8) {
            res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
            return;
        }

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
            data: { password: hashedPassword },
        });

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
        console.error('Change password failed:', error);
        res.status(500).json({ success: false, message: 'Failed to change password' });
    }
};
