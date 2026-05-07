import fs from 'fs/promises';
import path from 'path';

/**
 * Storage provider interface — swap implementations for local vs S3.
 * Phase 1: LocalStorageProvider (filesystem)
 * Phase 2: S3StorageProvider (drop-in replacement)
 */
export interface StorageProvider {
  save(key: string, buffer: Buffer): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * Local filesystem storage provider.
 * Saves files to backend/uploads/ directory.
 */
export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(subdir: string = 'avatars') {
    this.basePath = path.join(process.cwd(), 'uploads', subdir);
  }

  async save(filename: string, buffer: Buffer): Promise<string> {
    await fs.mkdir(this.basePath, { recursive: true });
    const filePath = path.join(this.basePath, filename);
    await fs.writeFile(filePath, buffer);
    return filename;
  }

  async delete(filename: string): Promise<void> {
    const filePath = path.join(this.basePath, filename);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      // Ignore if file doesn't exist (already deleted)
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async exists(filename: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.basePath, filename));
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance — used by all profile picture operations
export const avatarStorage = new LocalStorageProvider('avatars');
