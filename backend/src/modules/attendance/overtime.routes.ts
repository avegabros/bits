import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware';
import {
    getOvertimeRequests,
    createOvertimeRequest,
    updateOvertimeRequest,
    deleteOvertimeRequest
} from './overtime.controller';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Overtime requests routes
router.get('/', getOvertimeRequests);
router.post('/', createOvertimeRequest);
router.patch('/:id', updateOvertimeRequest);
router.delete('/:id', deleteOvertimeRequest);

export default router;
