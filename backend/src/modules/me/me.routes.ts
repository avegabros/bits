import { Router } from 'express';
import {
    getMyAttendance,
    getMyShift,
    getMyProfile,
    changePassword,
    streamMyAttendance,
    getMyDepartments,
} from './me.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

const router = Router();

// All employee self-service routes are protected by the generic authentication middleware
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Me (Employee Self-Service)
 *   description: Endpoints for logged-in users to access their own data
 */

/**
 * @swagger
 * /api/me/attendance/stream:
 *   get:
 *     summary: Server-Sent Events stream for my own real-time attendance updates
 *     description: Opens a persistent SSE connection that pushes attendance events belonging to the currently authenticated employee only.
 *     tags: [Me (Employee Self-Service)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE stream — connection stays open and pushes events
 *       401:
 *         description: Not authenticated
 */
router.get('/attendance/stream', streamMyAttendance);

/**
 * @swagger
 * /api/me/attendance:
 *   get:
 *     summary: Get my own attendance records
 *     description: Returns the authenticated employee's attendance history with optional date range filtering. Records are enriched with shift-based metrics (late, undertime, overtime, etc.).
 *     tags: [Me (Employee Self-Service)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter (YYYY-MM-DD, PHT timezone)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter (YYYY-MM-DD, PHT timezone)
 *     responses:
 *       200:
 *         description: List of attendance records with computed metrics
 *       401:
 *         description: Not authenticated
 */
router.get('/attendance', getMyAttendance);

/**
 * @swagger
 * /api/me/shift:
 *   get:
 *     summary: Get my assigned shift
 *     description: Returns the shift schedule assigned to the authenticated employee.
 *     tags: [Me (Employee Self-Service)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Shift details (or null if no shift assigned)
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Employee not found
 */
router.get('/shift', getMyShift);

/**
 * @swagger
 * /api/me/profile:
 *   get:
 *     summary: Get my profile information
 *     description: Returns the full profile of the authenticated employee including department, branch, hire date, employment status, and profile picture URL.
 *     tags: [Me (Employee Self-Service)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee profile data
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Employee not found
 */
router.get('/profile', getMyProfile);

/**
 * @swagger
 * /api/me/password:
 *   put:
 *     summary: Change my password
 *     description: Allows the authenticated employee to change their password. Requires the current password for verification. Also clears the needsPasswordChange flag.
 *     tags: [Me (Employee Self-Service)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Missing fields, incorrect current password, or new password too short
 *       401:
 *         description: Not authenticated
 */
router.put('/password', changePassword);

/**
 * @swagger
 * /api/me/departments:
 *   get:
 *     summary: Get my assigned departments (Managers only)
 *     description: Returns the list of departments assigned to the authenticated manager. Returns 403 for non-manager roles.
 *     tags: [Me (Employee Self-Service)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned departments
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Only managers have assigned departments
 */
router.get('/departments', getMyDepartments);

export default router;
