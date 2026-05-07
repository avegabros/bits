import { body, query } from 'express-validator';

export const createEmployeeValidator = [
    body('firstName').notEmpty().withMessage('First Name is required').trim(),
    body('lastName').notEmpty().withMessage('Last Name is required').trim(),
    body('employeeNumber')
        .notEmpty().withMessage('Employee ID is required.')
        .trim()
        .isLength({ min: 2 }).withMessage('Employee ID must be at least 2 characters long.'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('role').optional().isIn(['USER']).withMessage('Employee registration only supports USER role. Admin/HR accounts must be created via User Accounts.'),
    body('zkId').optional().isInt().withMessage('ZK ID must be an integer'),
];

export const employeeQueryValidator = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('Limit must be between 1 and 10000'),
    query('search').optional().isString().trim(),
];

export const enrollFingerprintValidator = [
    body('fingerIndex')
        .optional()
        .isInt({ min: 0, max: 9 })
        .withMessage('Finger index must be between 0 and 9'),
    body('deviceId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Device ID must be a positive integer'),
];

export const enrollCardValidator = [
    body('cardNumber')
        .notEmpty().withMessage('Card number is required')
        .isInt({ min: 1, max: 4294967295 })
        .withMessage('Card number must be a valid uint32 (1–4294967295)'),
];

