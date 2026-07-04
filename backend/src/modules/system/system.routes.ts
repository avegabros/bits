import { Router } from 'express';
import {
    getSyncStatus,
    getSyncConfig,
    updateSyncConfig,
    toggleGlobalSync,
    triggerManualSync,
    triggerManualTimeSync,
    triggerManualLogBufferClear,
    getSystemLogs,
    getValidationLimits,
    getBackupsList,
    downloadBackup,
    triggerManualBackup
} from './system.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminManagerOrHR } from '../../shared/middleware/role.middleware';

const router = Router();

// Protect all system routes
router.use(authenticate);
router.use(adminManagerOrHR);

/**
 * @swagger
 * tags:
 *   name: System
 *   description: Sync scheduler configuration, manual triggers, and system health
 */

/**
 * @swagger
 * /api/system/validation-limits:
 *   get:
 *     summary: Get validation limits for sync and user settings
 *     description: Returns the min/max boundaries used by the frontend to validate sync config and user settings forms.
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Validation limits object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 limits:
 *                   type: object
 */
router.get('/validation-limits', getValidationLimits);

/**
 * @swagger
 * /api/system/sync-status:
 *   get:
 *     summary: Get current sync scheduler status
 *     description: Returns the global sync enabled flag, scheduler running state, next tick time, and health check status.
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current sync and health-check scheduler status
 *       404:
 *         description: Sync config not found
 */
router.get('/sync-status', getSyncStatus);

/**
 * @swagger
 * /api/system/sync-config:
 *   get:
 *     summary: Get the current sync configuration
 *     description: Returns all tunable sync parameters (intervals, shift-aware toggle, health check, time sync, log buffer maintenance, etc.).
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync configuration object
 *       404:
 *         description: Sync config not found
 */
router.get('/sync-config', getSyncConfig);

/**
 * @swagger
 * /api/system/sync-config:
 *   put:
 *     summary: Update sync configuration
 *     description: Partially update any combination of sync parameters. Restarts the scheduler immediately with the new settings.
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               defaultIntervalSec:
 *                 type: integer
 *                 description: Default sync interval in seconds
 *               highFreqIntervalSec:
 *                 type: integer
 *                 description: Peak-hours sync interval in seconds
 *               lowFreqIntervalSec:
 *                 type: integer
 *                 description: Off-peak sync interval in seconds
 *               shiftAwareSyncEnabled:
 *                 type: boolean
 *               shiftBufferMinutes:
 *                 type: integer
 *               autoTimeSyncEnabled:
 *                 type: boolean
 *               timeSyncIntervalSec:
 *                 type: integer
 *               healthCheckEnabled:
 *                 type: boolean
 *               healthCheckIntervalSec:
 *                 type: integer
 *               globalMinCheckoutMinutes:
 *                 type: integer
 *               logBufferMaintenanceEnabled:
 *                 type: boolean
 *               logBufferMaintenanceSchedule:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               logBufferMaintenanceHour:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Configuration updated (may include a warning for aggressive intervals)
 *       400:
 *         description: Validation error
 *       404:
 *         description: Sync config not found
 */
router.put('/sync-config', updateSyncConfig);

/**
 * @swagger
 * /api/system/sync-toggle:
 *   post:
 *     summary: Toggle global sync on or off
 *     description: Enables or disables the background attendance sync scheduler globally.
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Global sync toggled
 *       400:
 *         description: Missing or invalid "enabled" field
 */
router.post('/sync-toggle', toggleGlobalSync);

/**
 * @swagger
 * /api/system/sync-now:
 *   post:
 *     summary: Trigger an immediate manual attendance sync
 *     description: Runs a full attendance sync across all active devices right now, bypassing the scheduler timer. Uses the internal device lock to avoid conflicts.
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Manual sync completed (check success field for partial failures)
 *       500:
 *         description: Sync failed
 */
router.post('/sync-now', triggerManualSync);

/**
 * @swagger
 * /api/system/time-sync-now:
 *   post:
 *     summary: Trigger an immediate device clock sync
 *     description: Syncs the server's current time to all active ZKTeco devices to prevent clock drift.
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Time sync completed
 *       500:
 *         description: Time sync failed
 */
router.post('/time-sync-now', triggerManualTimeSync);

/**
 * @swagger
 * /api/system/logs:
 *   get:
 *     summary: Get system-level audit logs
 *     description: Returns the 50 most recent audit log entries where entityType is 'System'.
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of system audit logs
 */
router.get('/logs', getSystemLogs);

/**
 * @swagger
 * /api/system/clear-device-logs:
 *   post:
 *     summary: Manually clear device log buffers
 *     description: Triggers an immediate log buffer clear on all active devices. Useful when a device is approaching capacity before the scheduled maintenance window.
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Log buffer clear completed
 *       500:
 *         description: Log buffer clear failed
 */
router.post('/clear-device-logs', triggerManualLogBufferClear);

// ─── Backup Management Routes ────────────────────────────────────────────────
router.get('/backups', getBackupsList);
router.get('/backups/download/:filename', downloadBackup);
router.post('/backups/trigger', triggerManualBackup);

export default router;
