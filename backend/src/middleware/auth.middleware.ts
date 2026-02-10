import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
        }
    }
}

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
                error: 'unauthorized'
            });
            return;
        }

        // Get token from "Bearer <token>"
        const token = authHeader.substring(7);

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Access denied. Invalid token format.',
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
