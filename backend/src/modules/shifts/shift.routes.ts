import express from 'express';
import {
    getAllShifts,
    getShiftById,
    createShift,
    updateShift,
    deleteShift,
    toggleShift,
    getNextEmployeeNumber,
} from './shift.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminOrHR } from '../../shared/middleware/role.middleware';

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
router.post('/', adminOrHR, createShift);

/**
 * @swagger
 * /api/shifts/{id}:
 *   put:
 *     summary: Update a shift
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', adminOrHR, updateShift);

/**
 * @swagger
 * /api/shifts/{id}/toggle:
 *   patch:
 *     summary: Toggle shift active status
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/toggle', adminOrHR, toggleShift);

/**
 * @swagger
 * /api/shifts/{id}:
 *   delete:
 *     summary: Delete a shift (only if no employees assigned)
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', adminOrHR, deleteShift);

export default router;
