/**
 * decrypt-backup.ts
 * 
 * Standalone recovery utility to decrypt encrypted database backups.
 * 
 * Usage:
 *   npx ts-node src/scripts/maintenance/decrypt-backup.ts <path-to-encrypted-file.enc>
 * 
 * Output:
 *   Generates a decrypted file in the same directory (e.g. backup_file.sql.gz).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables (to read BACKUP_ENCRYPTION_KEY)
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Usage: npx ts-node src/scripts/maintenance/decrypt-backup.ts <path-to-encrypted-file>');
        process.exit(1);
    }

    const encryptedPath = path.resolve(args[0]);
    if (!fs.existsSync(encryptedPath)) {
        console.error(`Error: File not found at "${encryptedPath}"`);
        process.exit(1);
    }

    const fileExt = path.extname(encryptedPath);
    if (fileExt !== '.enc') {
        console.warn('Warning: File does not have a ".enc" extension. Continuing anyway...');
    }

    // Determine output file path (strip .enc extension)
    const dir = path.dirname(encryptedPath);
    const baseName = path.basename(encryptedPath, '.enc');
    const outputPath = path.join(dir, baseName);

    console.log('='.repeat(60));
    console.log('  DATABASE BACKUP DECRYPTION UTILITY');
    console.log('='.repeat(60));
    console.log(`Input file:  ${encryptedPath}`);
    console.log(`Output file: ${outputPath}`);

    // Derive Key
    const rawKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (!rawKey) {
        console.error('Error: BACKUP_ENCRYPTION_KEY environment variable is not defined.');
        console.error('Please define it in your .env file.');
        process.exit(1);
    }
    const key = crypto.createHash('sha256').update(rawKey).digest();

    console.log('Reading Initialization Vector (IV) and decrypting...');

    try {
        const readStream = fs.createReadStream(encryptedPath);
        const writeStream = fs.createWriteStream(outputPath);

        let iv: Buffer | null = null;
        let decipher: any = null;

        await new Promise<void>((resolve, reject) => {
            readStream.on('readable', () => {
                // Read the first 16 bytes as the IV if we haven't yet
                if (!iv) {
                    const chunk = readStream.read(16);
                    if (chunk) {
                        iv = chunk as Buffer;
                        if (iv.length !== 16) {
                            reject(new Error(`Failed to read 16-byte IV. Extracted length: ${iv.length}`));
                            return;
                        }
                        
                        decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                        decipher.pipe(writeStream);
                        
                        decipher.on('error', (err: any) => {
                            reject(new Error(`Decryption failed: ${err.message}. The key might be incorrect.`));
                        });
                    }
                }

                // Feed remaining data into the decipher
                let dataChunk;
                while (null !== (dataChunk = readStream.read())) {
                    if (decipher) {
                        decipher.write(dataChunk);
                    }
                }
            });

            readStream.on('end', () => {
                if (decipher) {
                    decipher.end();
                }
            });

            writeStream.on('finish', () => {
                resolve();
            });

            readStream.on('error', (err) => {
                reject(err);
            });

            writeStream.on('error', (err) => {
                reject(err);
            });
        });

        console.log('\n✅ Decryption completed successfully!');
        console.log(`Decrypted backup file created at: "${outputPath}"`);
        console.log('You can now extract and restore this file to your database.');
        console.log('='.repeat(60));
    } catch (err: any) {
        console.error('\n❌ Decryption failed:', err.message || err);
        // Clean up partial output file if it exists
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        process.exit(1);
    }
}

main();
