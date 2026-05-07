import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../../shared/lib/prisma';
import { Prisma } from '@prisma/client';
import { syncEmployeesToDevice, enrollEmployeeFingerprint, enrollEmployeeCard, deleteEmployeeCard, addUserToDevice, deleteUserFromDevice, findNextSafeZkId, acquireRegistrationMutex, deleteFingerprintGlobally, syncEmployeeFingerprints } from '../devices/zk';
import { enqueueGlobalUpsertUser, enqueueGlobalDeleteUser, processDeviceSyncQueue } from '../devices/deviceSyncQueue.service';
import { audit } from '../../shared/lib/auditLogger';
import { auditUpdate, auditCreate, auditDelete, buildChanges } from '../../shared/lib/auditHelpers';
import bcrypt from 'bcryptjs';
import { generateRandomPassword } from '../../shared/utils/password.utils';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../../shared/lib/email.service';

// GET /api/employees/:id - Get a single employee by ID (for profile view)
export const getEmployeeById = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const employeeId = parseInt(id, 10);

        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employee ID',
            });
        }

        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                zkId: true,
                cardNumber: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
                middleName: true,
                suffix: true,
                gender: true,
                dateOfBirth: true,
                email: true,
                role: true,
                departmentId: true,
                Department: { select: { name: true } },
                branchId: true,
                Branch: { select: { name: true } },
                companyId: true,
                Company: { select: { id: true, name: true } },
                position: true,
                contactNumber: true,
                hireDate: true,
                employmentStatus: true,
                profilePicture: true,
                shiftId: true,
                Shift: { select: { id: true, name: true, shiftCode: true, startTime: true, endTime: true, workDays: true, halfDays: true, graceMinutes: true, breakMinutes: true, isNightShift: true } },
                createdAt: true,
                updatedAt: true,
                EmployeeDeviceEnrollment: {
                    select: {
                        enrolledAt: true,
                        device: {
                            select: {
                                id: true,
                                name: true,
                                location: true,
                                isActive: true,
                            },
                        },
                    },
                },
                EmployeeFingerprintEnrollment: {
                    select: {
                        id: true,
                        fingerIndex: true,
                        fingerLabel: true,
                        enrolledAt: true,
                        device: {
                            select: { id: true, name: true },
                        },
                    },
                },
                EmployeeCardEnrollment: {
                    select: {
                        id: true,
                        enrolledAt: true,
                        device: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found',
            });
        }

        if (req.managerDepartmentIds) {
            if (!employee.departmentId || !req.managerDepartmentIds.includes(employee.departmentId)) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: Employee belongs to a department you do not manage.',
                });
            }
        }

        res.json({
            success: true,
            employee,
        });
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee',
        });
    }
};

// GET /api/employees - Get all employees
export const getAllEmployees = async (req: Request, res: Response) => {
    try {
        const where: Prisma.EmployeeWhereInput = {};
        if (req.managerDepartmentIds && req.query.scope !== 'company') {
            where.departmentId = { in: req.managerDepartmentIds };
        }

        const employees = await prisma.employee.findMany({
            where,
            select: {
                id: true,
                zkId: true,
                cardNumber: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
                middleName: true,
                suffix: true,
                gender: true,
                dateOfBirth: true,
                email: true,
                role: true,
                departmentId: true,
                Department: { select: { name: true } },
                branchId: true,
                Branch: { select: { name: true } },
                companyId: true,
                Company: { select: { id: true, name: true } },
                position: true,
                contactNumber: true,
                hireDate: true,
                employmentStatus: true,
                profilePicture: true,
                shiftId: true,
                Shift: { select: { id: true, name: true, shiftCode: true, startTime: true, endTime: true, workDays: true, halfDays: true, graceMinutes: true, breakMinutes: true, isNightShift: true } },
                createdAt: true,
                EmployeeDeviceEnrollment: {
                    select: {
                        enrolledAt: true,
                        device: {
                            select: {
                                id: true,
                                name: true,
                                location: true,
                                isActive: true,
                            },
                        },
                    },
                },
                EmployeeFingerprintEnrollment: {
                    select: {
                        id: true,
                    },
                },
            },
            orderBy: [
                { role: 'asc' },
                { zkId: 'asc' },
            ],
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

        // Delete from ZK Device if zkId exists — queue-based, non-blocking
        if (employee.zkId) {
            setImmediate(async () => {
                try {
                    await enqueueGlobalDeleteUser(employee.zkId!);
                    // Flush queue inline for online devices
                    const devices = await prisma.device.findMany({
                        where: { isActive: true, syncEnabled: true },
                        select: { id: true },
                    });
                    for (const d of devices) {
                        try { await processDeviceSyncQueue(d.id); } catch { /* retry later */ }
                    }
                    console.log(`[API] (background) Queued DELETE_USER for zkId=${employee.zkId}`);
                } catch (err: unknown) {
                    console.error(`[API] (background) Failed to queue device deletion:`, err);
                }
            });
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

        void auditUpdate({
            entityType: 'Employee',
            entityId: employeeId,
            performedBy: req.user?.employeeId,
            details: `Employee ${employee.firstName} ${employee.lastName} deactivated`,
            correlationId: req.correlationId
        }, [
            { field: 'employmentStatus', oldValue: employee.employmentStatus, newValue: 'INACTIVE' }
        ]);

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

        void auditUpdate({
            entityType: 'Employee',
            entityId: employeeId,
            performedBy: req.user?.employeeId,
            details: `Employee ${updatedEmployee.firstName} ${updatedEmployee.lastName} reactivated`,
            correlationId: req.correlationId
        }, [
            { field: 'employmentStatus', oldValue: existingEmployee.employmentStatus, newValue: 'ACTIVE' }
        ]);

        res.json({
            success: true,
            message: `Employee "${updatedEmployee.firstName} ${updatedEmployee.lastName}" reactivated`,
            employee: updatedEmployee,
        });
    } catch (error: unknown) {
        console.error('Error reactivating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reactivate employee',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error',
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
            middleName,
            suffix,
            gender,
            dateOfBirth,
            email,
            role,
            departmentId,
            position,
            branchId,
            contactNumber,
            hireDate,
            employmentStatus,
            shiftId,
            companyId
        } = req.body;

        // The validators have already handled empty formats

        // Validate required fields
        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'First name and Last name are required'
            });
        }

        // Validate email format and require it
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'A valid email is required to receive login credentials'
            });
        }

        // Enforce USER role — Admin/HR must be created via /api/users
        // This is the second line of defense after the validator
        if (role && role !== 'USER') {
            void audit({
                action: 'CREATE',
                level: 'WARN',
                entityType: 'Employee',
                performedBy: req.user?.employeeId,
                source: 'admin-panel',
                details: `Blocked role escalation attempt: tried to create employee with role "${role}"`,
                metadata: { attemptedRole: role, email },
                correlationId: req.correlationId
            });

            return res.status(403).json({
                success: false,
                message: 'Employee registration only supports USER role. Admin/HR accounts must be created via User Accounts.'
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
                    { contactNumber: contactNumber || undefined },
                ]
            }
        });

        if (existingEmployee) {
            let duplicateField = 'information';
            if (email && existingEmployee.email === email) duplicateField = 'email address';
            else if (employeeNumber && existingEmployee.employeeNumber === employeeNumber) duplicateField = 'employee number';
            else if (contactNumber && existingEmployee.contactNumber === contactNumber) duplicateField = 'contact number';

            void audit({
                action: 'CREATE',
                level: 'WARN',
                entityType: 'Employee',
                performedBy: req.user?.employeeId,
                details: `Failed to create employee: duplicate ${duplicateField}`,
                metadata: { email, employeeNumber, contactNumber },
                correlationId: req.correlationId
            });

            return res.status(400).json({
                success: false,
                message: `This ${duplicateField} is already in use by another employee`
            });
        }

        // ── Acquire registration mutex before zkId assignment ─────────────────────
        // findNextSafeZkId() + prisma.employee.create() must run as an atomic unit.
        // Without this mutex, two simultaneous POST /api/employees requests both call
        // findNextSafeZkId() before either has written to the DB, both receive the
        // same integer, and one of the prisma.employee.create() calls fails with a
        // P2002 unique constraint violation on Employee.zkId.
        const release = await acquireRegistrationMutex();
        let newEmployee;
        const generatedPassword = generateRandomPassword(10);
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        try {
            const nextZkId = await findNextSafeZkId();

            newEmployee = await prisma.employee.create({
                data: {
                    employeeNumber: employeeNumber.trim(),
                    firstName,
                    lastName,
                    middleName: middleName || null,
                    suffix: suffix || null,
                    gender: gender || null,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                    email,
                    password: hashedPassword,
                    role: 'USER',
                    departmentId: departmentId ? parseInt(departmentId, 10) : null,
                    position,
                    branchId: branchId ? parseInt(branchId, 10) : null,
                    companyId: companyId ? parseInt(companyId, 10) : null,
                    contactNumber,
                    hireDate: hireDate ? new Date(hireDate) : undefined,
                    employmentStatus: employmentStatus || 'ACTIVE',
                    zkId: nextZkId,
                    shiftId: shiftId ? parseInt(shiftId, 10) : null,
                    needsPasswordChange: true,
                    updatedAt: new Date()
                },
                select: {
                    id: true,
                    zkId: true,
                    employeeNumber: true,
                    firstName: true,
                    lastName: true,
                    middleName: true,
                    suffix: true,
                    gender: true,
                    dateOfBirth: true,
                    email: true,
                    role: true,
                    departmentId: true,
                    Department: { select: { name: true } },
                    position: true,
                    branchId: true,
                    Branch: { select: { name: true } },
                    companyId: true,
                    Company: { select: { id: true, name: true } },
                    contactNumber: true,
                    hireDate: true,
                    employmentStatus: true,
                    createdAt: true,
                }
            });
        } finally {
            // Always release — even on error — to prevent deadlocking future registrations
            release();
        }

        // Guard: if the mutex block threw, the outer try/catch handles it
        if (!newEmployee) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create employee — unexpected state after registration.',
            });
        }

        console.log(`[API] Created employee: ${newEmployee.firstName} ${newEmployee.lastName} (zkId: ${newEmployee.zkId})`);

        void auditCreate({
            entityType: 'Employee',
            entityId: newEmployee.id,
            performedBy: req.user?.employeeId,
            details: `Created employee ${newEmployee.firstName} ${newEmployee.lastName}`,
            correlationId: req.correlationId
        }, { 
            email, 
            role: newEmployee.role, 
            employeeNumber 
        });

        // ── Respond immediately — device sync happens in the background ──────
        // We do NOT await the device call here. The ZKTeco device may take up to
        // 25 s to time out (3 retries × ~8 s each). Holding the HTTP response
        // open that long causes the success toast to never appear on the frontend.
        // Instead, we respond with 201 right away and let the sync run in the
        // background. If it fails, the admin can use the Fingerprint button later.
        res.status(201).json({
            success: true,
            message: 'Employee created and credentials sent via email.',
            employee: newEmployee,
            deviceSync: { success: null, message: 'Device sync running in background' },
        });

        // Fire-and-forget: sync to biometric device and send email
        setImmediate(async () => {
            // Send welcome email
            if (email) {
                try {
                    await sendWelcomeEmail(email, `${firstName} ${lastName}`, generatedPassword);
                } catch (emailErr) {
                    console.error(`[API] (background) Failed to send welcome email to ${email}:`, emailErr);
                }
            }

            // Sync device
            if (newEmployee.zkId) {
                try {
                    console.log(`[API] (background) Syncing ${newEmployee.firstName} ${newEmployee.lastName} to device...`);
                    const displayName = `${newEmployee.firstName} ${newEmployee.lastName}`;
                    await addUserToDevice(newEmployee.zkId!, displayName, newEmployee.role);
                    console.log(`[API] (background) Device sync OK: ${displayName} (zkId: ${newEmployee.zkId})`);
                } catch (syncErr: unknown) {
                    console.error(`[API] (background) Device sync failed for zkId ${newEmployee.zkId}:`, syncErr instanceof Error ? syncErr.message : String(syncErr));
                }
            }
        });

    } catch (error: unknown) {
        console.error('Error creating employee:', error);

        const errMsg = error instanceof Error ? error.message : String(error);
        void audit({
            action: 'CREATE',
            level: 'ERROR',
            entityType: 'Employee',
            performedBy: req.user?.employeeId,
            details: `Failed to create employee due to server error: ${errMsg}`,
            metadata: { error: errMsg },
            correlationId: req.correlationId
        });

        res.status(500).json({
            success: false,
            message: 'Failed to create employee',
            error: process.env.NODE_ENV === 'development' ? errMsg : 'Internal server error',
        });
    }
};
// PUT /api/employees/:id - Update an employee's details
export const updateEmployee = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const employeeId = parseInt(id as string, 10);

        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employee ID format',
            });
        }

        const {
            employeeNumber,
            firstName,
            lastName,
            middleName,
            suffix,
            gender,
            dateOfBirth,
            email,
            contactNumber,
            position,
            departmentId,
            branchId,
            hireDate,
            shiftId,
            companyId,
            employmentStatus
        } = req.body;

        // Check if employee exists
        const existingEmployee = await prisma.employee.findUnique({
            where: { id: employeeId },
        });

        if (!existingEmployee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found',
            });
        }

        // Validate employeeNumber uniqueness (exclude the current employee)
        if (employeeNumber !== undefined && employeeNumber !== '' && employeeNumber !== existingEmployee.employeeNumber) {
            const dup = await prisma.employee.findFirst({
                where: { employeeNumber: employeeNumber.trim(), id: { not: employeeId } }
            });
            if (dup) {
                return res.status(400).json({
                    success: false,
                    message: 'Employee ID is already in use by another employee'
                });
            }
        }

        // Validate email uniqueness (exclude the current employee)
        if (email !== undefined && email !== '' && email !== existingEmployee.email) {
            const emailDup = await prisma.employee.findFirst({
                where: { email, id: { not: employeeId } }
            });
            if (emailDup) {
                return res.status(400).json({
                    success: false,
                    message: 'This email address is already in use by another employee'
                });
            }
        }

        // Validate contact number uniqueness (exclude current employee)
        if (contactNumber !== undefined && contactNumber !== '' && contactNumber !== existingEmployee.contactNumber) {
            const contactDup = await prisma.employee.findFirst({
                where: { contactNumber, id: { not: employeeId } }
            });
            if (contactDup) {
                return res.status(400).json({
                    success: false,
                    message: 'This contact number is already in use by another employee'
                });
            }
        }

        // Block role escalation — prevent promoting USER to ADMIN/MANAGER/HR via this endpoint
        if (req.body.role && ['ADMIN', 'MANAGER', 'HR'].includes(req.body.role) && existingEmployee.role === 'USER') {
            void audit({
                action: 'UPDATE',
                level: 'WARN',
                entityType: 'Employee',
                entityId: employeeId,
                performedBy: req.user?.employeeId,
                source: 'admin-panel',
                details: `Blocked role escalation attempt on employee ID ${employeeId}: tried to change from USER to ${req.body.role}`,
                metadata: { attemptedRole: req.body.role },
                correlationId: req.correlationId
            });

            return res.status(403).json({
                success: false,
                message: 'Role escalation not allowed. Admin/Manager/HR accounts must be managed via User Accounts.'
            });
        }

        // Prepare data for update
        const updateData: Record<string, unknown> = {};
        if (employeeNumber !== undefined) updateData.employeeNumber = employeeNumber.trim();
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (middleName !== undefined) updateData.middleName = middleName || null;
        if (suffix !== undefined) updateData.suffix = suffix || null;
        if (gender !== undefined) updateData.gender = gender || null;
        if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
        if (email !== undefined) updateData.email = email === '' ? null : email;
        if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
        if (position !== undefined) updateData.position = position;
        if (departmentId !== undefined) {
            updateData.departmentId = departmentId ? parseInt(departmentId, 10) : null;
        }
        if (branchId !== undefined) {
            updateData.branchId = branchId ? parseInt(branchId, 10) : null;
        }
        if (hireDate !== undefined && hireDate !== '') {
            updateData.hireDate = new Date(hireDate);
        }
        if (shiftId !== undefined) updateData.shiftId = shiftId ? parseInt(shiftId, 10) : null;
        if (companyId !== undefined) updateData.companyId = companyId ? parseInt(companyId, 10) : null;
        if (employmentStatus !== undefined && ['ACTIVE', 'INACTIVE', 'TERMINATED'].includes(employmentStatus)) {
            updateData.employmentStatus = employmentStatus;
        }

        updateData.updatedAt = new Date();

        // Update the employee
        const updatedEmployee = await prisma.employee.update({
            where: { id: employeeId },
            data: updateData,
            select: {
                id: true,
                zkId: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
                middleName: true,
                suffix: true,
                gender: true,
                dateOfBirth: true,
                email: true,
                role: true,
                departmentId: true,
                Department: { select: { name: true } },
                position: true,
                branchId: true,
                Branch: { select: { name: true } },
                companyId: true,
                Company: { select: { id: true, name: true } },
                contactNumber: true,
                hireDate: true,
                employmentStatus: true,
                shiftId: true,
                Shift: { select: { id: true, name: true, shiftCode: true, startTime: true, endTime: true, workDays: true, halfDays: true, graceMinutes: true, breakMinutes: true } },
                createdAt: true,
                updatedAt: true
            },
        });

        const trackedFields = Object.keys(updateData).filter(k => k !== 'updatedAt' && k !== 'password');
        const changes = buildChanges(existingEmployee as Record<string, unknown>, updateData, trackedFields);

        void auditUpdate({
            entityType: 'Employee',
            entityId: employeeId,
            performedBy: req.user?.employeeId,
            details: `Updated employee ${updatedEmployee.firstName} ${updatedEmployee.lastName}`,
            correlationId: req.correlationId
        }, changes);

        res.json({
            success: true,
            message: 'Employee updated successfully',
            employee: updatedEmployee,
        });

        // ── Queue device sync if employee details changed and they're on devices ──
        if (updatedEmployee.zkId && updatedEmployee.employmentStatus === 'ACTIVE') {
            const nameChanged = firstName !== undefined || lastName !== undefined;
            const roleChanged = req.body.role !== undefined;
            if (nameChanged || roleChanged) {
                const fullName = `${updatedEmployee.firstName} ${updatedEmployee.lastName}`;
                const deviceRole = updatedEmployee.role === 'ADMIN' ? 14 : 0;
                setImmediate(async () => {
                    try {
                        await enqueueGlobalUpsertUser({
                            zkId: updatedEmployee.zkId!,
                            name: fullName,
                            card: existingEmployee.cardNumber ?? 0,
                            role: deviceRole,
                        });
                        // Flush queue inline for online devices
                        const devices = await prisma.device.findMany({
                            where: { isActive: true, syncEnabled: true },
                            select: { id: true },
                        });
                        for (const d of devices) {
                            try { await processDeviceSyncQueue(d.id); } catch { /* retry later */ }
                        }
                        console.log(`[API] (background) Queued UPSERT_USER for zkId=${updatedEmployee.zkId}`);
                    } catch (err: unknown) {
                        console.error(`[API] (background) Failed to queue device update:`, err);
                    }
                });
            }
        }

    } catch (error: unknown) {
        console.error('Error updating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update employee',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error'
        });
    }
};
// DELETE /api/employees/:id/permanent - Permanently delete an inactive employee
export const permanentDeleteEmployee = async (req: Request, res: Response) => {
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
            select: { id: true, firstName: true, lastName: true, employmentStatus: true, zkId: true, role: true, email: true },
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found',
            });
        }

        // Prevent deleting the main admin account
        if (employee.email === 'admin@avegabros.com') {
            return res.status(403).json({
                success: false,
                message: 'Permanent deletion of the main admin account is protected.',
            });
        }

        // Only allow permanent deletion of inactive users
        if (employee.employmentStatus === 'ACTIVE') {
            return res.status(400).json({
                success: false,
                message: 'Cannot permanently delete an active user. Please deactivate them first.',
            });
        }

        // ── DB delete first — device removal is fire-and-forget ────────────
        // We must NOT await deleteUserFromDevice before the transaction.
        // If the device is offline it retries for up to 25 s, causing the
        // permanent delete to appear to fail. The DB is the source of truth.
        // Delete from DB unconditionally; remove from device in the background.
        await prisma.$transaction(async (tx) => {
            await tx.attendanceLog.deleteMany({ where: { employeeId } });
            await tx.attendance.deleteMany({ where: { employeeId } });
            await tx.employee.delete({ where: { id: employeeId } });
        });

        void auditDelete({
            entityType: 'Employee',
            entityId: employeeId,
            performedBy: req.user?.employeeId,
            level: 'WARN',
            details: `Permanently deleted employee ${employee.firstName} ${employee.lastName}`,
            correlationId: req.correlationId
        }, { 
            email: employee.email, 
            role: employee.role 
        });

        res.json({
            success: true,
            message: `User "${employee.firstName} ${employee.lastName}" permanently deleted`,
        });

        // Fire-and-forget: queue deletion from biometric devices
        if (employee.zkId) {
            setImmediate(async () => {
                try {
                    await enqueueGlobalDeleteUser(employee.zkId!);
                    // Flush queue inline for online devices
                    const devices = await prisma.device.findMany({
                        where: { isActive: true, syncEnabled: true },
                        select: { id: true },
                    });
                    for (const d of devices) {
                        try { await processDeviceSyncQueue(d.id); } catch { /* retry later */ }
                    }
                    console.log(`[API] (background) Queued DELETE_USER for zkId=${employee.zkId}`);
                } catch (devErr: unknown) {
                    console.error(`[API] (background) Could not queue zkId ${employee.zkId} for deletion:`, devErr);
                }
            });
        }
    } catch (error) {
        console.error('Error permanently deleting employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to permanently delete employee',
        });
    }
};
// POST /api/employees/:id/reset-password - HR/Admin initiated password reset
export const resetEmployeePassword = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const employeeId = parseInt(id);

        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employee ID',
            });
        }

        // Check if employee exists and has an email
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, firstName: true, lastName: true, email: true },
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found',
            });
        }

        if (!employee.email) {
            return res.status(400).json({
                success: false,
                message: 'Employee does not have an email address configured',
            });
        }

        const generatedPassword = generateRandomPassword(10);
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        // Update DB
        await prisma.employee.update({
            where: { id: employeeId },
            data: {
                password: hashedPassword,
                needsPasswordChange: true,
                updatedAt: new Date()
            }
        });

        // Send email
        const emailSent = await sendPasswordResetEmail(
            employee.email,
            `${employee.firstName} ${employee.lastName}`,
            generatedPassword
        );

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: "Password was reset but the email could not be sent. Please verify SMTP configuration and try again.",
            });
        }

        res.json({
            success: true,
            message: `Password reset successfully. Email sent to ${employee.email}.`,
        });

    } catch (error: unknown) {
        console.error('Error resetting password:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
        });
    }
};
// GET /api/employees/check-duplicate?field=email&value=...&excludeId=...
export const checkDuplicate = async (req: Request, res: Response) => {
    try {
        const { field, value, excludeId } = req.query;

        if (!field || typeof field !== 'string' || !['email', 'employeeNumber', 'contactNumber'].includes(field)) {
            return res.status(400).json({ success: false, message: 'Valid field is required' });
        }
        
        if (!value || typeof value !== 'string') {
            return res.status(400).json({ success: false, message: 'Value is required' });
        }

        const where: any = {};
        where[field] = value.trim();
        if (field === 'email') {
            where[field] = value.trim().toLowerCase();
        }

        if (excludeId) {
            where.id = { not: parseInt(excludeId as string, 10) };
        }

        const existing = await prisma.employee.findFirst({ where });

        res.json({
            success: true,
            available: !existing,
        });
    } catch (error: unknown) {
        console.error('Error checking duplicate:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check duplicate availability',
        });
    }
};




