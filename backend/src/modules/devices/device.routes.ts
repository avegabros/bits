import { Router } from 'express';
import {
    getAllDevices,
    createDevice,
    updateDevice,
    deleteDevice,
    testDeviceConnection,
    reconcileDevice,
    toggleDevice,
    streamDeviceStatus,
    getDeviceQueueHealth,
    drainDeviceQueues,
    retryDeviceDeadLetters,
    getDeviceAdministrators,
    setDeviceAdministrators,
    removeDeviceAdministrator,
} from './device.controller';
import {
    getAllAgents,
    createAgent,
    toggleAgent,
    deleteAgent
} from './agent.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminManagerOrHR } from '../../shared/middleware/role.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Devices
 *   description: ZKTeco biometric device management
 */

router.use(authenticate);
router.use(adminManagerOrHR);

/**
 * @swagger
 * /api/devices/stream:
 *   get:
 *     summary: Server-Sent Events stream for real-time device status updates
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE stream — connection stays open and pushes device status events
 */
router.get('/stream', streamDeviceStatus);

/**
 * @swagger
 * /api/devices:
 *   get:
 *     summary: Get all registered devices
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of devices with connection status
 */
router.get('/', getAllDevices);

/**
 * @swagger
 * /api/devices:
 *   post:
 *     summary: Register a new ZKTeco device
 *     tags: [Devices]
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
 *               - ip
 *               - port
 *             properties:
 *               name:
 *                 type: string
 *                 example: Main Entrance
 *               ip:
 *                 type: string
 *                 example: 192.168.1.201
 *               port:
 *                 type: integer
 *                 example: 4370
 *               location:
 *                 type: string
 *                 example: Lobby
 *     responses:
 *       201:
 *         description: Device registered
 *       400:
 *         description: Validation error
 */
router.post('/', createDevice);

/**
 * @swagger
 * /api/devices/{id}:
 *   put:
 *     summary: Update device details
 *     tags: [Devices]
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
 *               name:
 *                 type: string
 *               ip:
 *                 type: string
 *               port:
 *                 type: integer
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device updated
 *       404:
 *         description: Device not found
 */
router.put('/:id', updateDevice);

/**
 * @swagger
 * /api/devices/{id}:
 *   delete:
 *     summary: Remove a device
 *     tags: [Devices]
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
 *         description: Device deleted
 *       404:
 *         description: Device not found
 */
router.delete('/:id', deleteDevice);

/**
 * @swagger
 * /api/devices/{id}/test:
 *   post:
 *     summary: Test connection to a device
 *     tags: [Devices]
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
 *         description: Connection test result (success/fail)
 *       404:
 *         description: Device not found
 */
router.post('/:id/test', testDeviceConnection);

/**
 * @swagger
 * /api/devices/{id}/reconcile:
 *   post:
 *     summary: Reconcile attendance data from a specific device
 *     tags: [Devices]
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
 *         description: Reconciliation result with new records count
 *       404:
 *         description: Device not found
 */
router.post('/:id/reconcile', reconcileDevice);

/**
 * @swagger
 * /api/devices/{id}/toggle:
 *   patch:
 *     summary: Toggle device enabled/disabled status
 *     tags: [Devices]
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
 *         description: Device status toggled
 *       404:
 *         description: Device not found
 */
router.patch('/:id/toggle', toggleDevice);

/**
 * @swagger
 * /api/devices/unlock:
 *   post:
 *     summary: Emergency force-release the device communication lock
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device lock released
 */
router.post('/unlock', (req, res) => {
    const { forceReleaseLock } = require('./zk');
    forceReleaseLock();
    res.json({ success: true, message: 'Device lock force-released.' });
});

/**
 * @swagger
 * /api/devices/sync-biometrics:
 *   post:
 *     summary: Trigger a system-wide background sync of all active employee fingerprints across all devices
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Background sync initiated
 */
import { syncBiometrics } from './device.controller';
router.post('/sync-biometrics', syncBiometrics);

/**
 * @swagger
 * /api/devices/queue/health:
 *   get:
 *     summary: Get overall health of the device synchronization queue
 *     tags: [Devices]
 */
router.get('/queue/health', getDeviceQueueHealth);

/**
 * @swagger
 * /api/devices/queue/drain:
 *   post:
 *     summary: Manually trigger a drain of all pending queue tasks
 *     tags: [Devices]
 */
router.post('/queue/drain', drainDeviceQueues);

/**
 * @swagger
 * /api/devices/queue/retry:
 *   post:
 *     summary: Reset all dead-letter tasks to pending status
 *     tags: [Devices]
 */
router.post('/queue/retry', retryDeviceDeadLetters);

/**
 * @swagger
 * /api/devices/queue/retry/{id}:
 *   post:
 *     summary: Reset dead-letter tasks for a specific device
 *     tags: [Devices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/queue/retry/:id', retryDeviceDeadLetters);

router.get('/administrators', getDeviceAdministrators);
router.post('/administrators', setDeviceAdministrators);
router.delete('/administrators/:employeeId', removeDeviceAdministrator);

// ─── Agent Routes ────────────────────────────────────────────────────────────
router.get('/agents', getAllAgents);
router.post('/agents', createAgent);
router.post('/agents/:id/toggle', toggleAgent);
router.delete('/agents/:id', deleteAgent);

export default router;
