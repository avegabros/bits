/**
 * biometric-crypto.ts
 * 
 * Utility for application-layer encryption of biometric fingerprint templates
 * using AES-256-GCM.
 */

import * as crypto from 'crypto';

// 4-byte magic signature to identify encrypted templates in the database
const MAGIC_PREFIX = Buffer.from('BTEC'); // "Biometric Template Encrypted Cache"
const IV_LENGTH = 12; // Standard for GCM
const TAG_LENGTH = 16; // Standard for GCM

// Get derived encryption key
let cachedKey: Buffer | null = null;
function getEncryptionKey(): Buffer {
    if (cachedKey) return cachedKey;

    const rawKey = process.env.BIOMETRIC_ENCRYPTION_KEY;
    if (!rawKey) {
        console.error('\n🚨 FATAL ERROR: BIOMETRIC_ENCRYPTION_KEY environment variable is not defined!');
        console.error('Please define it in your server .env file to secure biometric data.');
        process.exit(1);
    }

    // Derive a strong 32-byte key using SHA-256
    cachedKey = crypto.createHash('sha256').update(rawKey).digest();
    return cachedKey;
}

/**
 * Checks if a template buffer is encrypted.
 * If the buffer starts with the MAGIC_PREFIX "BTEC", it is encrypted.
 */
export function isEncrypted(data: Buffer): boolean {
    if (!data || data.length < MAGIC_PREFIX.length + IV_LENGTH + TAG_LENGTH) {
        return false;
    }
    return data.subarray(0, MAGIC_PREFIX.length).equals(MAGIC_PREFIX);
}

/**
 * Encrypts a raw fingerprint template buffer using AES-256-GCM.
 * Output layout: [MAGIC_PREFIX (4B)] + [IV (12B)] + [TAG (16B)] + [CIPHERTEXT]
 */
export function encryptTemplate(plaintext: Buffer): Buffer {
    if (!plaintext || plaintext.length === 0) {
        throw new Error('Cannot encrypt empty biometric template data.');
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const ciphertext = Buffer.concat([
        cipher.update(plaintext),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    // Concatenate prefix + IV + tag + encrypted content
    return Buffer.concat([MAGIC_PREFIX, iv, tag, ciphertext]);
}

/**
 * Decrypts an encrypted biometric template buffer.
 * If the data is already plaintext (does not start with magic prefix), returns it as-is.
 */
export function decryptTemplate(encrypted: Buffer): Buffer {
    if (!encrypted || encrypted.length === 0) {
        return encrypted;
    }

    // If it's not encrypted, return as-is (fallback/migration safety)
    if (!isEncrypted(encrypted)) {
        return encrypted;
    }

    try {
        const key = getEncryptionKey();

        // Parse prefix, iv, tag, and ciphertext
        let offset = MAGIC_PREFIX.length;
        const iv = encrypted.subarray(offset, offset + IV_LENGTH);
        offset += IV_LENGTH;
        const tag = encrypted.subarray(offset, offset + TAG_LENGTH);
        offset += TAG_LENGTH;
        const ciphertext = encrypted.subarray(offset);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);

        return Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]);
    } catch (err: any) {
        throw new Error(`Failed to decrypt biometric template data: ${err.message}`);
    }
}
