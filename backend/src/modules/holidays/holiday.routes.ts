import express from 'express';
import {
    getHolidays,
    getHolidayById,
    createHoliday,
    updateHoliday,
    deleteHoliday,
} from './holiday.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminManagerOrHR } from '../../shared/middleware/role.middleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Holidays
 *   description: Holiday management endpoints
 */

/**
 * @swagger
 * /api/holidays:
 *   get:
 *     summary: Get all holidays (optional ?month= and ?year= filters)
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Filter by year (e.g. 2026)
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Filter by month (1-12, requires year)
 *     responses:
 *       200:
 *         description: List of holidays
 */
router.get('/', getHolidays);

/**
 * @swagger
 * /api/holidays/{id}:
 *   get:
 *     summary: Get a single holiday by ID
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Holiday details
 *       404:
 *         description: Holiday not found
 */
router.get('/:id', getHolidayById);

/**
 * @swagger
 * /api/holidays:
 *   post:
 *     summary: Create a new holiday (Admin only)
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - date
 *             properties:
 *               name:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [REGULAR, SPECIAL]
 *     responses:
 *       201:
 *         description: Holiday created
 *       409:
 *         description: Duplicate date
 */
router.post('/', adminManagerOrHR, createHoliday);

/**
 * @swagger
 * /api/holidays/{id}:
 *   put:
 *     summary: Update a holiday (Admin only)
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [REGULAR, SPECIAL]
 *     responses:
 *       200:
 *         description: Holiday updated
 *       404:
 *         description: Holiday not found
 *       409:
 *         description: Duplicate date
 */
router.put('/:id', adminManagerOrHR, updateHoliday);

/**
 * @swagger
 * /api/holidays/{id}:
 *   delete:
 *     summary: Delete a holiday (Admin only)
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Holiday deleted
 *       404:
 *         description: Holiday not found
 */
router.delete('/:id', adminManagerOrHR, deleteHoliday);

export default router;
