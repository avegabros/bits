import { body } from 'express-validator';

export const createUserValidator = [
    body('firstName').notEmpty().withMessage('First name is required').trim(),
    body('lastName').notEmpty().withMessage('Last name is required').trim(),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['ADMIN', 'HR']).withMessage('Role must be ADMIN or HR'),
];

export const updateUserValidator = [
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty').trim(),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty').trim(),
    body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('role').optional().isIn(['ADMIN', 'HR']).withMessage('Role must be ADMIN or HR'),
    body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

export const changePasswordValidator = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

export const updateProfileValidator = [
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty').trim(),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty').trim(),
    body('contactNumber').optional().trim(),
];
