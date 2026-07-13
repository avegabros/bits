import { Router } from 'express';
import {
    syncAttendance,
    addUser,
    getAttendance,
    getToday,
    getEmployeeHistory,
    updateAttendance,
    createManualAttendance,
    streamAttendance,
    getAttendanceAuditLogs,
    getAdjustments,
    reviewAdjustment,
    deleteAttendance,
    cancelAdjustment,
    reopenAdjustment,
} from './attendance.controller';
import { getRawAttendanceLogs } from './attendance-raw-logs.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminManagerOrHR, managerOrAdmin, adminOrHR } from '../../shared/middleware/role.middleware';
import { departmentScope } from '../../shared/middleware/departmentScope.middleware';
import overtimeRoutes from './overtime.routes';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Apply department scoping for MANAGER roles
router.use(departmentScope);

// Overtime routes (Available to all authenticated users, handled internally)
router.use('/overtime', overtimeRoutes);

// Apply role-based authorization to all subsequent routes (ADMIN, MANAGER, or HR)
router.use(adminManagerOrHR);

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
router.post('/sync', adminOrHR, syncAttendance);

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
router.post('/user', adminOrHR, addUser);

/**
 * @swagger
 * /api/attendance/manual:
 *   post:
 *     summary: Manually create a new attendance record
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Record created or submitted for approval
 */
router.post('/manual', adminOrHR, createManualAttendance);

/**
 * @swagger
 * /api/attendance/stream:
 *   get:
 *     summary: Server-Sent Events stream for real-time attendance updates
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE stream — connection stays open and pushes events
 */
router.get('/stream', streamAttendance);

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
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: branchName
 *         schema:
 *           type: string
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: departmentName
 *         schema:
 *           type: string
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: shiftType
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortDesc
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of attendance records
 */
router.get('/raw-logs', getRawAttendanceLogs);
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

/**
 * @swagger
 * /api/attendance/audit-logs:
 *   get:
 *     summary: Get attendance audit logs (manual corrections history)
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
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of audit log entries
 */
router.get('/audit-logs', getAttendanceAuditLogs);

/**
 * @swagger
 * /api/attendance/adjustments:
 *   get:
 *     summary: Get attendance adjustment requests
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of adjustment requests
 */
router.get('/adjustments', getAdjustments);

/**
 * @swagger
 * /api/attendance/adjustments/{id}/review:
 *   put:
 *     summary: Approve or reject an attendance adjustment (Admin only)
 *     tags: [Attendance]
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
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Adjustment reviewed
 */
router.put('/adjustments/:id/review', managerOrAdmin, reviewAdjustment);

/**
 * @swagger
 * /api/attendance/{id}:
 *   put:
 *     summary: Manually update an attendance record (HR correction)
 *     tags: [Attendance]
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
 *               checkInTime:
 *                 type: string
 *                 format: date-time
 *               checkOutTime:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Record updated
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
router.put('/:id', adminOrHR, updateAttendance);

/**
 * @swagger
 * /api/attendance/{id}:
 *   delete:
 *     summary: Delete an attendance record
 *     tags: [Attendance]
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
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Record deleted or deletion request submitted
 */
router.delete('/:id', adminOrHR, deleteAttendance);

/**
 * @swagger
 * /api/attendance/adjustments/{id}/cancel:
 *   put:
 *     summary: Cancel a pending attendance adjustment
 *     tags: [Attendance]
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
 *         description: Adjustment cancelled successfully
 *       400:
 *         description: Invalid request or adjustment not pending
 *       403:
 *         description: You can only cancel your own pending requests
 *       404:
 *         description: Adjustment not found
 */
router.put('/adjustments/:id/cancel', cancelAdjustment);

/**
 * @swagger
 * /api/attendance/adjustments/{id}/reopen:
 *   put:
 *     summary: Reopen a finalized attendance adjustment (Admin only)
 *     tags: [Attendance]
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
 *         description: Adjustment reopened
 *       400:
 *         description: Adjustment is already pending
 *       403:
 *         description: Admin only
 *       404:
 *         description: Adjustment not found
 */
router.put('/adjustments/:id/reopen', adminOrHR, reopenAdjustment);

export default router;
