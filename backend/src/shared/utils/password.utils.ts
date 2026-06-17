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

/**
 * Generates a password in MMDDYY format from a given date input.
 * MM = 2-digit birth month (01-12)
 * DD = 2-digit birth day (01-31)
 * YY = last 2 digits of the birth year
 */
export const getBirthdatePassword = (dateInput: string | Date): string => {
    if (typeof dateInput === 'string') {
        const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const yy = match[1].slice(-2);
            const mm = match[2];
            const dd = match[3];
            return `${mm}${dd}${yy}`;
        }
    }

    const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date format');
    }
    const yy = String(dateObj.getUTCFullYear()).slice(-2);
    const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${mm}${dd}${yy}`;
};

