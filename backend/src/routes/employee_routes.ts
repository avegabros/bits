import { Router } from 'express';
import {
    getAllEmployees,
    syncEmployeesToDeviceController,
    deleteEmployee,
    reactivateEmployee,
    createEmployee,
    enrollEmployeeFingerprintController
} from '../controllers/employee.controller';
import { authenticate } from '../middleware/auth.middleware';
import { adminOrHR } from '../middleware/role.middleware';
import { validate } from '../middleware/validation.middleware';
import { createEmployeeValidator, employeeQueryValidator, enrollFingerprintValidator } from '../validators/employee.validator';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Apply role-based authorization to all routes (ADMIN or HR only)
router.use(adminOrHR);

/**
 * @swagger
 * tags:
 *   name: Employees
 *   description: Employee management endpoints
 */

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Get all employees
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: List of employees
 */
router.get('/', validate(employeeQueryValidator), getAllEmployees);

/**
 * @swagger
 * /api/employees:
 *   post:
 *     summary: Create a new employee
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               employeeNumber:
 *                 type: string
 *               department:
 *                 type: string
 *               position:
 *                 type: string
 *               branch:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN, HR]
 *     responses:
 *       201:
 *         description: Employee created successfully
 */
router.post('/', validate(createEmployeeValidator), createEmployee);

/**
 * @swagger
 * /api/employees/sync-to-device:
 *   post:
 *     summary: Sync all employees to ZKTeco device
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync successful
 */
router.post('/sync-to-device', syncEmployeesToDeviceController);


/**
 * @swagger
 * /api/employees/{id}/enroll-fingerprint:
 *   post:
 *     summary: Trigger fingerprint enrollment on device
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Employee ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fingerIndex:
 *                 type: integer
 *                 description: Finger index (0-9). Default 0 (Right Thumb).
 *                 example: 0
 *     responses:
 *       200:
 *         description: Enrollment started
 *       404:
 *         description: Employee not found
 */
router.post('/:id/enroll-fingerprint', validate(enrollFingerprintValidator), enrollEmployeeFingerprintController);

// DELETE /api/employees/:id - Soft delete (mark as inactive)
router.delete('/:id', deleteEmployee);

// PATCH /api/employees/:id/reactivate - Reactivate inactive employee
router.patch('/:id/reactivate', reactivateEmployee);

export default router;