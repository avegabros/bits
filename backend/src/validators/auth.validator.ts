import { body } from 'express-validator';

export const registerValidator = [
    body('name').notEmpty().withMessage('Name is required').trim(),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['USER', 'ADMIN', 'HR']).withMessage('Invalid role'),
];

export const loginValidator = [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
];

export const refreshValidator = [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];
