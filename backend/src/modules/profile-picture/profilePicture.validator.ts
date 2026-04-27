import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Multer instance configured for profile picture uploads.
 * Uses memory storage (buffer) so we can pipe directly into sharp.
 */
export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
    }
  },
});

/**
 * Multer error handler middleware.
 * Converts multer-specific errors into clean JSON responses.
 */
export const handleMulterError = (err: Error, _req: Request, res: Response, next: NextFunction): void => {
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
