import { body } from 'express-validator';

export const registerValidator = [
    body('name').notEmpty().withMessage('Name is required').trim(),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['USER', 'ADMIN', 'HR']).withMessage('Invalid role'),
];

export const loginValidator = [
    body('identifier')
        .optional({ checkFalsy: true })
        .isString()
        .trim()
        .custom((val) => {
            if (val.includes('@')) {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                    throw new Error('Please enter a valid email');
                }
            } else {
                if (val.length < 3 || val.length > 20) {
                    throw new Error('Employee ID must be between 3 and 20 characters');
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(val)) {
                    throw new Error('Employee ID can only contain letters, numbers, hyphens, and underscores');
                }
            }
            return true;
        }),
    body('email')
        .optional({ checkFalsy: true })
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    body('employeeId')
        .optional({ checkFalsy: true })
        .isString()
        .trim()
        .isLength({ min: 3, max: 20 })
        .withMessage('Employee ID must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Employee ID can only contain letters, numbers, hyphens, and underscores'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    body().custom((value, { req }) => {
        if (!req.body.email && !req.body.employeeId && !req.body.identifier) {
            throw new Error('Email or Employee ID is required');
        }
        return true;
    }),
];

export const refreshValidator = [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];
