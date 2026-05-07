import { Router } from 'express';
import { getServerTime } from './time.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Time
 *   description: Server time synchronization
 */

/**
 * @swagger
 * /api/time/now:
 *   get:
 *     summary: Get the server's current time (Asia/Manila timezone)
 *     description: Used by the frontend to sync its local clock with the server's authoritative clock. No authentication required.
 *     tags: [Time]
 *     security: []
 *     responses:
 *       200:
 *         description: Current server time
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 time:
 *                   type: string
 *                   format: date-time
 */
router.get('/now', getServerTime);

export default router;
