import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { syncEmployeesToDevice, enrollEmployeeFingerprint, addUserToDevice, deleteUserFromDevice } from '../services/zkServices';

// GET /api/employees - Get all employees
export const getAllEmployees = async (req: Request, res: Response) => {
    try {
        const employees = await prisma.employee.findMany({
            select: {
                id: true,
                zkId: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                department: true,
                position: true,
                branch: true,
                contactNumber: true,
                hireDate: true,
                employmentStatus: true,
                createdAt: true,
            },
            // Order by ZK ID ascending
            orderBy: {
                zkId: 'asc',
            },
        });

        res.json({
            success: true,
            employees: employees,
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employees',
        });
    }
};

// POST /api/employees/sync-to-device - Sync all employees to device
export const syncEmployeesToDeviceController = async (req: Request, res: Response) => {
    try {
        console.log('[API] Request to sync all employees to device...');
        const result = await syncEmployeesToDevice();

        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                count: result.count
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.message || 'Sync failed',
                error: result.error
            });
        }
    } catch (error: any) {
        console.error('Error syncing employees:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync employees',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// DELETE /api/employees/:id - Soft delete employee
export const deleteEmployee = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const employeeId = parseInt(id);

        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employee ID',
            });
        }

        // Check if employee exists
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, firstName: true, lastName: true, employmentStatus: true, zkId: true },
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found',
            });
        }

        // Delete from ZK Device if zkId exists
        if (employee.zkId) {
            try {
                await deleteUserFromDevice(employee.zkId);
            } catch (err) {
                console.error(`[API] Failed to delete user ${employee.zkId} from device:`, err);
                // Continue with soft delete even if device delete fails
            }
        }

        // Soft delete: Mark as INACTIVE instead of actually deleting
        const updatedEmployee = await prisma.employee.update({
            where: { id: employeeId },
            data: {
                employmentStatus: 'INACTIVE',
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                employmentStatus: true,
            },
        });
        res.json({
            success: true,
            message: `Employee "${employee.firstName} ${employee.lastName}" marked as inactive`,
            employee: updatedEmployee,
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete employee',
        });
    }
};

// PATCH /api/employees/:id/reactivate - Reactivate inactive employee
export const reactivateEmployee = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const employeeId = parseInt(id);

        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employee ID',
            });
        }

        // Check if employee exists
        const existingEmployee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, firstName: true, lastName: true, employmentStatus: true },
        });

        if (!existingEmployee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found',
            });
        }

        if (existingEmployee.employmentStatus === 'ACTIVE') {
            return res.status(400).json({
                success: false,
                message: 'Employee is already active',
            });
        }

        const updatedEmployee = await prisma.employee.update({
            where: { id: employeeId },
            data: {
                employmentStatus: 'ACTIVE',
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                employmentStatus: true,
            },
        });

        res.json({
            success: true,
            message: `Employee "${updatedEmployee.firstName} ${updatedEmployee.lastName}" reactivated`,
            employee: updatedEmployee,
        });
    } catch (error: any) {
        console.error('Error reactivating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reactivate employee',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        });
    }
};

// POST /api/employees - Create new employee
export const createEmployee = async (req: Request, res: Response) => {
    try {
        const {
            employeeNumber,
            firstName,
            lastName,
            email,
            role,
            department,
            position,
            branch,
            contactNumber,
            hireDate,
            employmentStatus
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'First name and Last name are required'
            });
        }

        // Validate email format if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Validate role
        if (role && !['USER', 'ADMIN', 'HR'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be USER, ADMIN, or HR'
            });
        }

        // Validate employment status
        if (employmentStatus && !['ACTIVE', 'INACTIVE', 'TERMINATED'].includes(employmentStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employment status. Must be ACTIVE, INACTIVE, or TERMINATED'
            });
        }

        // Check for existing employee with same email, employee number
        const existingEmployee = await prisma.employee.findFirst({
            where: {
                OR: [
                    { email: email || undefined },
                    { employeeNumber: employeeNumber || undefined },
                ]
            }
        });

        if (existingEmployee) {
            return res.status(400).json({
                success: false,
                message: 'Employee with this email or employee number already exists'
            });
        }

        // Auto-assign zkId: find the next available zkId
        // NOTE: zkId 1 is reserved for admin, start from 2 for regular employees
        const maxZkIdEmployee = await prisma.employee.findFirst({
            where: {
                zkId: { not: null }
            },
            orderBy: {
                zkId: 'desc'
            },
            select: {
                zkId: true
            }
        });
        // Start from zkId 2 (skip 1 for admin), or increment from max
        const nextZkId = maxZkIdEmployee?.zkId ? maxZkIdEmployee.zkId + 1 : 2;

        // Create employee
        const newEmployee = await prisma.employee.create({
            data: {
                employeeNumber,
                firstName,
                lastName,
                email,
                role: role || 'USER',
                department,
                position,
                branch,
                contactNumber,
                hireDate: hireDate ? new Date(hireDate) : undefined,
                employmentStatus: employmentStatus || 'ACTIVE',
                zkId: nextZkId,
                updatedAt: new Date()
            },
            select: {
                id: true,
                zkId: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                department: true,
                position: true,
                branch: true,
                contactNumber: true,
                hireDate: true,
                employmentStatus: true,
                createdAt: true,
            }
        });

        console.log(`[API] Created employee: ${newEmployee.firstName} ${newEmployee.lastName} (zkId: ${newEmployee.zkId})`);

        let deviceSyncResult = { success: false, message: '' };

        try {
            if (newEmployee.zkId) {
                console.log(`[API] Syncing new employee to device...`);
                // Use zkId for both userId and user_id(uid) on device
                // Concatenate firstName and lastName for device
                const displayName = `${newEmployee.firstName} ${newEmployee.lastName}`;
                const badgeNumber = newEmployee.employeeNumber || "";
                await addUserToDevice(newEmployee.zkId, displayName, newEmployee.role, badgeNumber);
                deviceSyncResult = { success: true, message: 'Synced to device' };
            }
        } catch (syncError: any) {
            console.error('[API] Failed to sync to device:', syncError);
            deviceSyncResult = { success: false, message: `Device sync failed: ${syncError.message}` };
        }

        res.status(201).json({
            success: true,
            message: `Employee created successfully with zkId ${nextZkId}. ${deviceSyncResult.message}`,
            employee: newEmployee,
            deviceSync: deviceSyncResult
        });

    } catch (error: any) {
        console.error('Error creating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create employee',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        });
    }
};

// POST /api/employees/:id/enroll-fingerprint - Enroll fingerprint for employee
export const enrollEmployeeFingerprintController = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const employeeId = parseInt(id);

        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employee ID',
            });
        }

        // Optional finger index from request body (default: 0 = Right Thumb)
        const body = req.body || {};
        const { fingerIndex } = body;
        const finger = fingerIndex !== undefined ? parseInt(fingerIndex) : 0;

        if (finger < 0 || finger > 9) {
            return res.status(400).json({
                success: false,
                message: 'Finger index must be between 0 and 9',
            });
        }

        console.log(`[API] Starting fingerprint enrollment for employee ${employeeId}...`);

        // Call enrollment service
        const result = await enrollEmployeeFingerprint(employeeId, finger);

        if (result.success) {
            res.json({
                success: true,
                message: result.message,
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message,
                error: result.error,
            });
        }

    } catch (error: any) {
        console.error('Error enrolling fingerprint:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enroll fingerprint',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};