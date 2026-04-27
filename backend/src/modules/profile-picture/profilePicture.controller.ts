import { Request, Response } from 'express';
import sharp from 'sharp';
import { prisma } from '../../shared/lib/prisma';
import { processAndSaveAvatar, deleteAvatarFiles } from './profilePicture.service';

/**
 * POST /api/me/profile-picture
 * Upload or replace the logged-in employee's profile picture.
 */
export const uploadMyProfilePicture = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.employeeId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No image file provided' });
      return;
    }

    // Validate that sharp can parse the buffer (catches corrupt files)
    try {
      const metadata = await sharp(file.buffer).metadata();
      if (!metadata.width || !metadata.height) {
        res.status(400).json({ success: false, message: 'Invalid image file' });
        return;
      }
    } catch {
      res.status(400).json({ success: false, message: 'Unable to process image. The file may be corrupt.' });
      return;
    }

    const result = await processAndSaveAvatar(req.user.employeeId, file.buffer);

    // Append cache-busting timestamp
    const urlWithCacheBust = `${result.url}?v=${Date.now()}`;

    await prisma.employee.update({
      where: { id: req.user.employeeId },
      data: { profilePicture: urlWithCacheBust },
    });

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: urlWithCacheBust,
    });
  } catch (error: unknown) {
    console.error('uploadMyProfilePicture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
    });
  }
};

/**
 * DELETE /api/me/profile-picture
 * Remove the logged-in employee's profile picture.
 */
export const deleteMyProfilePicture = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.employeeId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    await deleteAvatarFiles(req.user.employeeId);

    await prisma.employee.update({
      where: { id: req.user.employeeId },
      data: { profilePicture: null },
    });

    res.status(200).json({
      success: true,
      message: 'Profile picture removed',
    });
  } catch (error: unknown) {
    console.error('deleteMyProfilePicture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove profile picture',
    });
  }
};

/**
 * POST /api/employees/:id/profile-picture
 * Upload or replace a specific employee's profile picture (Admin/HR only).
 */
export const uploadEmployeeProfilePicture = async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = parseInt(req.params.id, 10);
    if (isNaN(employeeId)) {
      res.status(400).json({ success: false, message: 'Invalid employee ID' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No image file provided' });
      return;
    }

    // Validate that sharp can parse the buffer (catches corrupt files)
    try {
      const metadata = await sharp(file.buffer).metadata();
      if (!metadata.width || !metadata.height) {
        res.status(400).json({ success: false, message: 'Invalid image file' });
        return;
      }
    } catch {
      res.status(400).json({ success: false, message: 'Unable to process image. The file may be corrupt.' });
      return;
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    const result = await processAndSaveAvatar(employeeId, file.buffer);

    // Append cache-busting timestamp
    const urlWithCacheBust = `${result.url}?v=${Date.now()}`;

    await prisma.employee.update({
      where: { id: employeeId },
      data: { profilePicture: urlWithCacheBust },
    });

    res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: urlWithCacheBust,
    });
  } catch (error: unknown) {
    console.error('uploadEmployeeProfilePicture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
    });
  }
};

/**
 * DELETE /api/employees/:id/profile-picture
 * Remove a specific employee's profile picture (Admin/HR only).
 */
export const deleteEmployeeProfilePicture = async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = parseInt(req.params.id, 10);
    if (isNaN(employeeId)) {
      res.status(400).json({ success: false, message: 'Invalid employee ID' });
      return;
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    await deleteAvatarFiles(employeeId);

    await prisma.employee.update({
      where: { id: employeeId },
      data: { profilePicture: null },
    });

    res.status(200).json({
      success: true,
      message: 'Profile picture removed',
    });
  } catch (error: unknown) {
    console.error('deleteEmployeeProfilePicture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove profile picture',
    });
  }
};
