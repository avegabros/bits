import { Router } from 'express';
import { getLogs, logExportEvent } from './logs.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminManagerOrHR } from '../../shared/middleware/role.middleware';

const router = Router();

router.use(authenticate);
router.use(adminManagerOrHR);

/**
 * @swagger
 * tags:
 *   name: Logs
 *   description: System audit / activity logs
 */

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Get system activity logs
 *     tags: [Logs]
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
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *     responses:
 *       200:
 *         description: Paginated list of logs
 */
router.get('/', getLogs);

/**
 * @swagger
 * /api/logs/export-event:
 *   post:
 *     summary: Log an export event (called after client-side file export)
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [exportType, entityType]
 *             properties:
 *               exportType:
 *                 type: string
 *               entityType:
 *                 type: string
 *               source:
 *                 type: string
 *               details:
 *                 type: string
 *               filters:
 *                 type: object
 *               recordCount:
 *                 type: integer
 *               fileFormat:
 *                 type: string
 *               fileName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Export event logged successfully
 */
router.post('/export-event', logExportEvent);

export default router;

