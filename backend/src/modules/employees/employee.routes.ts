import { Router } from 'express';
import {
    getEmployeeById,
    getAllEmployees,
    syncEmployeesToDeviceController,
    deleteEmployee,
    reactivateEmployee,
    createEmployee,
    bulkCreateEmployees,
    bulkValidateEmployees,
    enrollEmployeeFingerprintController,
    enrollEmployeeCardController,
    deleteEmployeeCardController,
    updateEmployee,
    permanentDeleteEmployee,
    resetEmployeePassword,
    checkDuplicate,
    getEmployeeFingerprintStatus,
    getEmployeeCardStatus,
    deleteEmployeeFingerprint,
    syncEmployeeFingerprintsController,
    exportEmployees,
    exportTemplate,
    addExclusionController,
    removeExclusionController,
    deleteDeviceFingerprintController
} from './index';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminManagerOrHR, adminOrHR } from '../../shared/middleware/role.middleware';
import { departmentScope } from '../../shared/middleware/departmentScope.middleware';
import { validate } from '../../shared/middleware/validation.middleware';
import { createEmployeeValidator, employeeQueryValidator, enrollFingerprintValidator, enrollCardValidator } from './employee.validator';
import { uploadAvatar, handleMulterError } from '../profile-picture/profilePicture.validator';
import { uploadEmployeeProfilePicture, deleteEmployeeProfilePicture } from '../profile-picture/profilePicture.controller';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Apply department scoping for MANAGER roles
router.use(departmentScope);

// Apply role-based authorization to all routes (ADMIN, MANAGER, or HR)
router.use(adminManagerOrHR);

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
router.post('/', adminOrHR, validate(createEmployeeValidator), createEmployee);

/**
 * @swagger
 * /api/employees/check-duplicate:
 *   get:
 *     summary: Check if a specific field (email, employeeNumber, contactNumber) is already in use
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: field
 *         required: true
 *         schema:
 *           type: string
 *         description: Field to check
 *       - in: query
 *         name: value
 *         required: true
 *         schema:
 *           type: string
 *         description: Value of the field to check
 *       - in: query
 *         name: excludeId
 *         schema:
 *           type: integer
 *         description: Employee ID to exclude (for edit mode)
 *     responses:
 *       200:
 *         description: Returns availability status
 */
router.get('/check-duplicate', checkDuplicate);

/**
 * @swagger
 * /api/employees/export:
 *   get:
 *     summary: Export employees to .xlsx
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department name
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *         description: Filter by branch name
 *     responses:
 *       200:
 *         description: Excel file download
 */
router.get('/export', exportEmployees);

/**
 * @swagger
 * /api/employees/export-template:
 *   get:
 *     summary: Download blank import template (.xlsx)
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Excel template file download
 */
router.get('/export-template', exportTemplate);

/**
 * @swagger
 * /api/employees/{id}:
 *   get:
 *     summary: Get a single employee by ID (profile view)
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
 *     responses:
 *       200:
 *         description: Employee details
 *       404:
 *         description: Employee not found
 */
router.get('/:id', getEmployeeById);

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
router.post('/sync-to-device', adminOrHR, syncEmployeesToDeviceController);

/**
 * @swagger
 * /api/employees/bulk-validate:
 *   post:
 *     summary: Validate bulk employees before import
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
 *               - employees
 *             properties:
 *               employees:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Validation results
 */
router.post('/bulk-validate', bulkValidateEmployees);

/**
 * @swagger
 * /api/employees/bulk:
 *   post:
 *     summary: Bulk create employees from import
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
 *               - employees
 *             properties:
 *               employees:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Bulk import results
 */
router.post('/bulk', adminOrHR, bulkCreateEmployees);


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
router.post('/:id/enroll-fingerprint', adminOrHR, validate(enrollFingerprintValidator), enrollEmployeeFingerprintController);

/**
 * @swagger
 * /api/employees/{id}/fingerprint-status:
 *   get:
 *     summary: Get fingerprint enrollment status for employee
 *     tags: [Employees]
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
 *         description: Fingerprint status
 */
router.get('/:id/fingerprint-status', getEmployeeFingerprintStatus);

/**
 * @swagger
 * /api/employees/{id}/fingerprint/{fingerIndex}:
 *   delete:
 *     summary: Delete a specific fingerprint globally
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: fingerIndex
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Fingerprint deleted globally
 */
router.delete('/:id/fingerprint/:fingerIndex', adminOrHR, deleteEmployeeFingerprint);

/**
 * @swagger
 * /api/employees/{id}/fingerprint/{fingerIndex}/device/{deviceId}:
 *   delete:
 *     summary: Delete a specific fingerprint from a specific device
 *     tags: [Employees]
 */
router.delete('/:id/fingerprint/:fingerIndex/device/:deviceId', adminOrHR, deleteDeviceFingerprintController);

/**
 * @swagger
 * /api/employees/{id}/sync-fingerprints:
 *   post:
 *     summary: Sync employee fingerprints across all active devices
 *     tags: [Employees]
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
 *         description: Fingerprints synced
 *       400:
 *         description: No fingerprints to sync
 */
router.post('/:id/sync-fingerprints', adminOrHR, syncEmployeeFingerprintsController);

/**
 * @swagger
 * /api/employees/{id}/enroll-card:
 *   post:
 *     summary: Enroll RFID badge card for employee
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cardNumber
 *             properties:
 *               cardNumber:
 *                 type: integer
 *                 description: RFID card number (uint32)
 *                 example: 12345678
 *     responses:
 *       200:
 *         description: Card enrolled successfully
 *       409:
 *         description: Card number already assigned to another employee
 */
router.post('/:id/enroll-card', adminOrHR, validate(enrollCardValidator), enrollEmployeeCardController);

/**
 * @swagger
 * /api/employees/{id}/card-status:
 *   get:
 *     summary: Get RFID card status for an employee across all devices
 *     tags: [Employees]
 */
router.get('/:id/card-status', getEmployeeCardStatus);

/**
 * @swagger
 * /api/employees/{id}/card:
 *   delete:
 *     summary: Delete an employee's RFID card globally
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
 *     responses:
 *       200:
 *         description: Card deleted successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.delete('/:id/card', adminOrHR, deleteEmployeeCardController);
router.delete('/:id/card/device/:deviceId', adminOrHR, deleteEmployeeCardController);

/**
 * @swagger
 * /api/employees/{id}/device-exclusions/{deviceId}:
 *   post:
 *     summary: Exclude an employee from syncing biometrics to a device
 *     tags: [Employees]
 */
router.post('/:id/device-exclusions/:deviceId', adminOrHR, addExclusionController);

/**
 * @swagger
 * /api/employees/{id}/device-exclusions/{deviceId}:
 *   delete:
 *     summary: Remove a biometric sync exclusion
 *     tags: [Employees]
 */
router.delete('/:id/device-exclusions/:deviceId', adminOrHR, removeExclusionController);

/**
 * @swagger
 * /api/employees/{id}/permanent:
 *   delete:
 *     summary: Permanently delete an inactive employee
 *     tags: [Employees]
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
 *         description: Employee permanently deleted
 *       400:
 *         description: Employee must be inactive first
 *       404:
 *         description: Employee not found
 */
router.delete('/:id/permanent', adminOrHR, permanentDeleteEmployee);

/**
 * @swagger
 * /api/employees/{id}:
 *   delete:
 *     summary: Soft-delete an employee (mark as inactive)
 *     tags: [Employees]
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
 *         description: Employee deactivated
 *       404:
 *         description: Employee not found
 */
router.delete('/:id', adminOrHR, deleteEmployee);

/**
 * @swagger
 * /api/employees/{id}/reactivate:
 *   patch:
 *     summary: Reactivate an inactive employee
 *     tags: [Employees]
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
 *         description: Employee reactivated
 *       404:
 *         description: Employee not found
 */
router.patch('/:id/reactivate', adminOrHR, reactivateEmployee);

/**
 * @swagger
 * /api/employees/{id}:
 *   put:
 *     summary: Update an employee's details
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               department:
 *                 type: string
 *               position:
 *                 type: string
 *               branch:
 *                 type: string
 *               shiftId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Employee updated
 *       404:
 *         description: Employee not found
 */
router.put('/:id', adminOrHR, updateEmployee);

/**
 * @swagger
 * /api/employees/{id}/reset-password:
 *   post:
 *     summary: Reset an employee's password
 *     tags: [Employees]
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
 *         description: Password reset successful (returns new temporary password)
 *       404:
 *         description: Employee not found
 */
router.post('/:id/reset-password', adminOrHR, resetEmployeePassword);

/**
 * @swagger
 * /api/employees/{id}/profile-picture:
 *   post:
 *     summary: Upload or replace an employee's profile picture
 *     tags: [Employees]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture updated
 *       400:
 *         description: Invalid file
 *       404:
 *         description: Employee not found
 */
router.post('/:id/profile-picture', adminOrHR, uploadAvatar.single('file'), handleMulterError, uploadEmployeeProfilePicture);

/**
 * @swagger
 * /api/employees/{id}/profile-picture:
 *   delete:
 *     summary: Remove an employee's profile picture
 *     tags: [Employees]
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
 *         description: Profile picture removed
 *       404:
 *         description: Employee not found
 */
router.delete('/:id/profile-picture', adminOrHR, deleteEmployeeProfilePicture);

export default router;
