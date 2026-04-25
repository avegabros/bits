import { Router, Request, Response, NextFunction } from 'express';
import { uploadMyProfilePicture, deleteMyProfilePicture } from './profilePicture.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { uploadAvatar } from './profilePicture.validator';
import multer from 'multer';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Multer error handler middleware.
 * Converts multer-specific errors into clean JSON responses.
 */
const handleMulterError = (err: Error, _req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, message: 'File too large. Maximum size is 5 MB.' });
      return;
    }
    res.status(400).json({ success: false, message: err.message });
    return;
  }
  if (err) {
    // fileFilter error (invalid MIME type)
    res.status(400).json({ success: false, message: err.message });
    return;
  }
  next();
};

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
