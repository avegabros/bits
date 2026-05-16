import express from 'express';
import {
    getAllShifts,
    getShiftById,
    createShift,
    updateShift,
    deleteShift,
    getNextEmployeeNumber,
    validateShiftEdit,
} from './shift.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminManagerOrHR } from '../../shared/middleware/role.middleware';

const router = express.Router();

// All shift routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/shifts:
 *   get:
 *     summary: Get all shifts
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', getAllShifts);

/**
 * @swagger
 * /api/shifts/next-employee-number:
 *   get:
 *     summary: Get next auto-generated employee number for today (AVG-EMP-YYMMDDNN)
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.get('/next-employee-number', getNextEmployeeNumber);

/**
 * @swagger
 * /api/shifts/{id}:
 *   get:
 *     summary: Get a shift by ID
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', getShiftById);

/**
 * @swagger
 * /api/shifts:
 *   post:
 *     summary: Create a new shift
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', adminManagerOrHR, createShift);

/**
 * @swagger
 * /api/shifts/{id}:
 *   put:
 *     summary: Update a shift
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', adminManagerOrHR, updateShift);

/**
 * @swagger
 * /api/shifts/{id}/validate-edit:
 *   post:
 *     summary: Validate if a shift edit causes conflicts
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/validate-edit', adminManagerOrHR, validateShiftEdit);



/**
 * @swagger
 * /api/shifts/{id}:
 *   delete:
 *     summary: Delete a shift (only if no employees assigned)
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', adminManagerOrHR, deleteShift);

export default router;
