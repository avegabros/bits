import crypto from 'crypto';

/**
 * Generates a random alphanumeric password of a given length.
 * Ensures an easier-to-read mix of characters (no ambiguous characters like l, 1, O, 0 if preferred, 
 * but standard crypto.randomBytes base64 is often simplest. We'll use a custom character set here).
 */
export const generateRandomPassword = (length: number = 10): string => {
    const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        password += charset[randomBytes[i] % charset.length];
    }
    return password;
};
