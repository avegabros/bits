import { Request, Response, NextFunction } from 'express';
import { getManagerDepartmentIds } from '../utils/departmentScope.utils';

declare global {
  namespace Express {
    interface Request {
      managerDepartmentIds?: number[] | null;
    }
  }
}

/**
 * Middleware that populates req.managerDepartmentIds for MANAGER roles.
 * Must be applied AFTER authentication middleware.
 * 
 * If the user is a MANAGER, fetches their assigned departments from the DB
 * and attaches them to the request.
 * If the user is not a MANAGER (e.g. ADMIN, HR, USER), sets the value to null.
 */
export const departmentScope = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.user) {
            return next(); // Auth middleware should handle unauthorized access, just pass through
        }

        if (req.user.role === 'MANAGER') {
            const departmentIds = await getManagerDepartmentIds(req.user.employeeId);
            req.managerDepartmentIds = departmentIds;
            // Also extend req.user with departmentIds for convenience
            req.user.departmentIds = departmentIds;
        } else {
            req.managerDepartmentIds = null;
        }

        next();
    } catch (error) {
        console.error('Department scope middleware error:', error);
        res.status(500).json({ success: false, message: 'Failed to resolve department scope' });
    }
};
