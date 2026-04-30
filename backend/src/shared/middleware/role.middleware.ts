import { Request, Response, NextFunction } from 'express';

type Role = 'USER' | 'HR' | 'MANAGER' | 'ADMIN';

/**
 * Role-Based Authorization Middleware
 * Checks if authenticated user has one of the required roles
 * 
 * @param allowedRoles - Array of roles that can access the route
 * @returns Middleware function
 * 
 * @example
 * router.get('/employees', authenticate, authorize(['ADMIN', 'MANAGER', 'HR']), getAllEmployees);
 */
export const authorize = (allowedRoles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Check if user is attached to request (should be done by authenticate middleware)
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required. Please login first.',
                error: 'unauthorized'
            });
            return;
        }

        // Check if user's role is in the allowed roles
        if (!allowedRoles.includes(req.user.role as Role)) {
            res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
                error: 'forbidden'
            });
            return;
        }

        // User has required role, continue
        next();
    };
};

/**
 * Convenience middleware for ADMIN-only routes
 */
export const adminOnly = authorize(['ADMIN']);

/**
 * Convenience middleware for MANAGER or ADMIN routes
 * Used for features that Manager shares with Admin but HR cannot access
 */
export const managerOrAdmin = authorize(['MANAGER', 'ADMIN']);

/**
 * Convenience middleware for ADMIN, MANAGER, and HR routes
 * Replaces the old adminOrHR for routes where all three management roles need access
 */
export const adminManagerOrHR = authorize(['ADMIN', 'MANAGER', 'HR']);

/**
 * @deprecated Use adminManagerOrHR instead for new routes.
 * Kept for backward compatibility — equivalent to authorize(['ADMIN', 'HR'])
 * Does NOT include MANAGER. Use adminManagerOrHR if Manager should have access.
 */
export const adminOrHR = authorize(['ADMIN', 'HR']);
