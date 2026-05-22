import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import {
    getOvertimeRequests,
    createOvertimeRequest,
    updateOvertimeRequest,
    deleteOvertimeRequest,
    batchCreateOvertimeRequests
} from './overtime.controller';
import { adminManagerOrHR } from '../../shared/middleware/role.middleware';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

import { getOvertimeSessions } from './overtime-sessions.controller';
router.get('/sessions', adminManagerOrHR, getOvertimeSessions);

// Overtime requests routes
router.get('/', getOvertimeRequests);
router.post('/batch', adminManagerOrHR, batchCreateOvertimeRequests);
router.post('/', createOvertimeRequest);
router.patch('/:id', updateOvertimeRequest);
router.delete('/:id', deleteOvertimeRequest);

export default router;
