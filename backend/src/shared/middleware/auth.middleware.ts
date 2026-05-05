import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

// JWT_SECRET is guaranteed to exist at startup by the validation in token.utils.ts.
// If the server started, this variable is safe to use.
const JWT_SECRET = process.env.JWT_SECRET as string;

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                employeeId: number;
                role: string;
                firstName: string;
                lastName: string;
                name: string;
            };
            correlationId: string;
        }
    }
}

/** Cookie options for clearing auth cookies */
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
};

/**
 * Authentication Middleware
 * Verifies JWT token, checks current employment status in DB,
 * and attaches user info to request.
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // ── Token extraction (cookie-first, then Authorization header) ─────────
        const cookieToken = req.cookies?.auth_token as string | undefined;
        const authHeader = req.headers.authorization;

        let token: string | undefined;
        if (cookieToken) {
            token = cookieToken;
        } else if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
                error: 'unauthorized'
            });
            return;
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET) as {
            employeeId: number;
            role: string;
            firstName: string;
            lastName: string;
            name: string;
        };

        // ── Fresh DB check: verify the account is still active ────────────────
        const freshUser = await prisma.employee.findUnique({
            where: { id: decoded.employeeId },
            select: { employmentStatus: true },
        });

        if (!freshUser || freshUser.employmentStatus !== 'ACTIVE') {
            // Clear auth cookies so the browser stops sending them
            res.clearCookie('auth_token', cookieOptions);
            res.clearCookie('refresh_token', cookieOptions);
            res.status(401).json({
                success: false,
                message: 'Session terminated. Your account has been deactivated.',
                error: 'account_inactive'
            });
            return;
        }

        // Attach user info to request
        req.user = {
            employeeId: decoded.employeeId,
            role: decoded.role,
            firstName: decoded.firstName || '',
            lastName: decoded.lastName || '',
            name: decoded.name
        };

        // Continue to next middleware
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                success: false,
                message: 'Token has expired. Please login again.',
                error: 'token_expired'
            });
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                message: 'Invalid token. Please login again.',
                error: 'invalid_token'
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: 'Authentication failed.',
            error: 'internal_error'
        });
    }
};
