import sharp from 'sharp';
import { avatarStorage } from '../../shared/services/storage.service';

interface ProcessedAvatar {
  standardFilename: string;
  thumbFilename: string;
  url: string;
}

/**
 * Process an uploaded image buffer:
 *  1. Convert to WebP
 *  2. Resize to 400×400 (standard) + 150×150 (thumbnail)
 *  3. Save both via storage provider
 *  4. Return the public URL path
 */
export async function processAndSaveAvatar(
  employeeId: number,
  buffer: Buffer
): Promise<ProcessedAvatar> {
  const standardFilename = `${employeeId}.webp`;
  const thumbFilename = `${employeeId}_thumb.webp`;

  // Standard size (400×400) — used on profile page
  const standardBuffer = await sharp(buffer)
    .rotate()                                         // Auto-orient from EXIF
    .resize(400, 400, { fit: 'cover', position: 'centre' })
    .webp({ quality: 80 })
    .toBuffer();

  // Thumbnail (150×150) — used in tables and lists (Phase 2)
  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize(150, 150, { fit: 'cover', position: 'centre' })
    .webp({ quality: 75 })
    .toBuffer();

  await avatarStorage.save(standardFilename, standardBuffer);
  await avatarStorage.save(thumbFilename, thumbBuffer);

  return {
    standardFilename,
    thumbFilename,
    url: `/api/uploads/avatars/${standardFilename}`,
  };
}

/**
 * Delete both standard and thumbnail avatar files from storage.
 */
export async function deleteAvatarFiles(employeeId: number): Promise<void> {
  await avatarStorage.delete(`${employeeId}.webp`);
  await avatarStorage.delete(`${employeeId}_thumb.webp`);
}
