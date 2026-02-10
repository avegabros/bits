import { body, query } from 'express-validator';

export const createEmployeeValidator = [
    body('firstName').notEmpty().withMessage('First Name is required').trim(),
    body('lastName').notEmpty().withMessage('Last Name is required').trim(),
    body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('role').optional().isIn(['USER', 'ADMIN', 'HR']).withMessage('Invalid role'),
    body('zkId').optional().isInt().withMessage('ZK ID must be an integer'),
];

export const employeeQueryValidator = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().trim(),
];

export const enrollFingerprintValidator = [
    body('fingerIndex').optional().isInt({ min: 0, max: 9 }).withMessage('Finger index must be between 0 and 9'),
];
