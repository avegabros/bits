import { Router, Request, Response, NextFunction } from 'express';
import { uploadMyProfilePicture, deleteMyProfilePicture } from './profilePicture.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { uploadAvatar, handleMulterError } from './profilePicture.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/me/profile-picture:
 *   post:
 *     summary: Upload or replace my profile picture
 *     tags: [Me (Employee Self-Service)]
 *     security:
 *       - bearerAuth: []
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
 */
router.post(
  '/',
  uploadAvatar.single('file'),
  handleMulterError,
  uploadMyProfilePicture
);

/**
 * @swagger
 * /api/me/profile-picture:
 *   delete:
 *     summary: Remove my profile picture
 *     tags: [Me (Employee Self-Service)]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile picture removed
 */
router.delete('/', deleteMyProfilePicture);

export default router;
