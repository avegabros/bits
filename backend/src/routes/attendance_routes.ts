import { Router } from 'express';
import {
    syncAttendance,
    addUser,
    getAttendance,
    getToday,
    getEmployeeHistory
} from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { adminOrHR } from '../middleware/role.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Apply role-based authorization to all routes (ADMIN or HR only)
router.use(adminOrHR);

/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Attendance management endpoints
 */

/**
 * @swagger
 * /api/attendance/sync:
 *   post:
 *     summary: Sync attendance logs from ZKTeco device
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync successful
 */
router.post('/sync', syncAttendance);

/**
 * @swagger
 * /api/attendance/user:
 *   post:
 *     summary: Add user attendance record
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employeeId
 *               - timestamp
 *             properties:
 *               employeeId:
 *                 type: integer
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Record added
 */
router.post('/user', addUser);

/**
 * @swagger
 * /api/attendance:
 *   get:
 *     summary: Get attendance records with filters
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of attendance records
 */
router.get('/', getAttendance);

/**
 * @swagger
 * /api/attendance/today:
 *   get:
 *     summary: Get today's attendance
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's attendance records
 */
router.get('/today', getToday);

/**
 * @swagger
 * /api/attendance/employee/{id}:
 *   get:
 *     summary: Get employee attendance history
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Employee attendance history
 */
router.get('/employee/:id', getEmployeeHistory);


export default router;