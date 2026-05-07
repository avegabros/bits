import jwt from 'jsonwebtoken';

// ── Startup validation ────────────────────────────────────────────────
// The server MUST NOT start with a missing or placeholder JWT secret.
// These are validated once at module load time.
if (!process.env.JWT_SECRET) {
    throw new Error(
        '[STARTUP] JWT_SECRET is not set. ' +
        'Generate one with: node -e "require(\'crypto\').randomBytes(64).toString(\'hex\')" ' +
        'and add it to your .env file.'
    );
}
if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error(
        '[STARTUP] JWT_REFRESH_SECRET is not set. ' +
        'Generate one with: node -e "require(\'crypto\').randomBytes(64).toString(\'hex\')" ' +
        'and add it to your .env file.'
    );
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export interface TokenPayload {
    employeeId: number;
    role: string;
    firstName: string;
    lastName: string;
    name: string;
}

/**
 * Generate access token (1 hour)
 */
export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '1h'
    });
};

/**
 * Generate refresh token (long-lived, 7 days)
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
        expiresIn: '7d' // 7 days
    });
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
};

/**
 * Decode token without verification (useful for debugging)
 */
export const decodeToken = (token: string): TokenPayload | null => {
    try {
        return jwt.decode(token) as TokenPayload;
    } catch {
        return null;
    }
};
