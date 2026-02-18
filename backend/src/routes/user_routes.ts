import { Router } from 'express';
import {
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    updateProfile,
    changePassword,
} from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { adminOnly, adminOrHR } from '../middleware/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── Self-service routes (any ADMIN or HR) ──────────────────
// These must be defined BEFORE the /:id routes to avoid conflict
router.put('/profile', adminOrHR, updateProfile);
router.put('/change-password', adminOrHR, changePassword);

// ── User management routes (ADMIN only) ────────────────────
router.get('/', adminOnly, getAllUsers);
router.post('/', adminOnly, createUser);
router.put('/:id', adminOnly, updateUser);
router.delete('/:id', adminOnly, deleteUser);
router.patch('/:id/toggle-status', adminOnly, toggleUserStatus);

export default router;
