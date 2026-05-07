import { Request } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Fetches the IDs of all departments assigned to a Manager.
 * @param managerId - The employee ID of the manager
 * @returns Array of department IDs
 */
export const getManagerDepartmentIds = async (managerId: number): Promise<number[]> => {
    const assignments = await prisma.managerDepartment.findMany({
        where: { managerId },
        select: { departmentId: true }
    });
    return assignments.map(a => a.departmentId);
};

/**
 * Builds a Prisma filter object for scoping queries by department.
 * - For Managers: returns { departmentId: { in: [1, 2, ...] } }
 * - For Admin/HR: returns {} (no filtering)
 * 
 * Note: If a Manager has no departments assigned, this returns { departmentId: { in: [] } },
 * which will naturally result in 0 records matched, which is the desired behavior.
 * 
 * @param req - The Express request object containing managerDepartmentIds
 * @returns Prisma filter object
 */
export const buildDepartmentFilter = (req: Request): { departmentId?: { in: number[] } } => {
    if (req.user?.role === 'MANAGER') {
        return { departmentId: { in: req.managerDepartmentIds || [] } };
    }
    return {};
};

/**
 * Validates whether a Manager has access to a specific department.
 * - Always returns true for non-Managers (Admin/HR).
 * - For Managers, checks if the department ID is in their assigned list.
 * 
 * @param req - The Express request object
 * @param departmentId - The department ID to check
 * @returns boolean indicating access
 */
export const validateDepartmentAccess = (req: Request, departmentId: number | null): boolean => {
    if (req.user?.role !== 'MANAGER') {
        return true; // Admin/HR have access to all departments
    }
    
    if (!departmentId) {
        return false; // Manager cannot access records with no department
    }
    
    return !!req.managerDepartmentIds?.includes(departmentId);
};
