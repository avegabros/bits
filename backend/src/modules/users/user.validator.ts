import { z } from 'zod';
import { USER_LIMITS } from '../system/system.constants';

export const createUserSchema = z.object({
    firstName: z.string().min(1, 'First name is required').max(USER_LIMITS.NAME_MAX).trim(),
    lastName: z.string().min(1, 'Last name is required').max(USER_LIMITS.NAME_MAX).trim(),
    email: z.string().email('Valid email is required'),
    password: z.string().min(USER_LIMITS.PASSWORD_MIN, `Password must be at least ${USER_LIMITS.PASSWORD_MIN} characters`).max(USER_LIMITS.PASSWORD_MAX),
    role: z.enum(['ADMIN', 'MANAGER', 'HR'], { message: 'Role must be ADMIN, MANAGER, or HR' }),
});

export const updateUserSchema = z.object({
    firstName: z.string().min(1).max(USER_LIMITS.NAME_MAX).trim().optional(),
    lastName: z.string().min(1).max(USER_LIMITS.NAME_MAX).trim().optional(),
    email: z.string().email().optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'HR']).optional(),
    password: z.string().min(USER_LIMITS.PASSWORD_MIN).max(USER_LIMITS.PASSWORD_MAX).optional(),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(USER_LIMITS.PASSWORD_MIN, `New password must be at least ${USER_LIMITS.PASSWORD_MIN} characters`).max(USER_LIMITS.PASSWORD_MAX),
});

export const updateProfileSchema = z.object({
    firstName: z.string().min(1).max(USER_LIMITS.NAME_MAX).trim().optional(),
    lastName: z.string().min(1).max(USER_LIMITS.NAME_MAX).trim().optional(),
    contactNumber: z.string().max(USER_LIMITS.CONTACT_MAX).trim().optional(),
});
