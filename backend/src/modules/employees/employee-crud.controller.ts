import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../../shared/lib/prisma';
import { Prisma } from '@prisma/client';
import { syncEmployeesToDevice, enrollEmployeeFingerprint, enrollEmployeeCard, deleteEmployeeCard, addUserToDevice, deleteUserFromDevice, findNextSafeZkId, acquireRegistrationMutex, deleteFingerprintGlobally, syncEmployeeFingerprints } from '../devices/zk';
import { enqueueGlobalUpsertUser, enqueueGlobalDeleteUser, processDeviceSyncQueue } from '../devices/deviceSyncQueue.service';
import { audit } from '../../shared/lib/auditLogger';
import { auditUpdate, auditCreate, auditDelete, buildChanges } from '../../shared/lib/auditHelpers';
import bcrypt from 'bcryptjs';
import { generateRandomPassword, getBirthdatePassword } from '../../shared/utils/password.utils';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../../shared/lib/email.service';
import { validateShiftGap } from '../shifts/shift-conflict.service';
import { getChronologicalShiftIds } from '../shifts/shift-ordering.service';
import { reassignSameDayShifts } from '../attendance/attendance.service';

function calculateFingerprintSyncStatus(
    enrollments: { deviceId?: number; device?: { id: number }; fingerIndex: number }[],
    exclusions: { deviceId: number }[],
    activeDeviceIds: number[]
): 'none' | 'synced' | 'partial' {
    const enrolledFingerIndices = Array.from(new Set(enrollments.map(e => e.fingerIndex)));
    if (enrolledFingerIndices.length === 0) {
        return 'none';
    }

    const excludedDeviceIds = new Set(exclusions.map(e => e.deviceId));
    const eligibleDeviceIds = activeDeviceIds.filter(id => !excludedDeviceIds.has(id));

    if (eligibleDeviceIds.length === 0) {
        return 'synced';
    }

    let isFullySynced = true;
    for (const fingerIndex of enrolledFingerIndices) {
        for (const deviceId of eligibleDeviceIds) {
            const hasEnrollment = enrollments.some(e => {
                const depId = e.deviceId ?? e.device?.id;
                return depId === deviceId && e.fingerIndex === fingerIndex;
            });
            if (!hasEnrollment) {
                isFullySynced = false;
                break;
            }
        }
        if (!isFullySynced) break;
    }

    return isFullySynced ? 'synced' : 'partial';
}

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
                sectionId: true,
                Section: { select: { id: true, name: true } },
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
                EmployeeShift: {
                    select: {
                        id: true,
                        sortOrder: true,
                        isPrimary: true,
                        shift: { select: { id: true, name: true, shiftCode: true, startTime: true, endTime: true, workDays: true, halfDays: true, graceMinutes: true, breakMinutes: true, isNightShift: true } }
                    },
                    orderBy: { sortOrder: 'asc' }
                },
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
                DeviceBiometricExclusion: {
                    where: { type: 'FINGERPRINT' },
                    select: { deviceId: true },
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

        const activeDevices = await prisma.device.findMany({
            where: { syncEnabled: true },
            select: { id: true }
        });
        const activeDeviceIds = activeDevices.map(d => d.id);
        const fingerprintSyncStatus = calculateFingerprintSyncStatus(
            (employee as any).EmployeeFingerprintEnrollment || [],
            (employee as any).DeviceBiometricExclusion || [],
            activeDeviceIds
        );

        res.json({
            success: true,
            employee: {
                ...employee,
                fingerprintSyncStatus,
            },
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
        const { search, page: queryPage, limit: queryLimit, fields } = req.query;

        const page = parseInt(queryPage as string, 10) || 1;
        // Default to 9999 if no limit specified to preserve backward compatibility
        const limit = queryLimit ? parseInt(queryLimit as string, 10) : 9999;
        const skip = (page - 1) * limit;

        const where: Prisma.EmployeeWhereInput = {};
        if (req.managerDepartmentIds && req.query.scope !== 'company') {
            where.departmentId = { in: req.managerDepartmentIds };
        }

        if (search) {
            const searchTerms = (search as string).trim().split(/\s+/);
            const nameConditions = searchTerms.map(term => ({
                OR: [
                    { firstName: { contains: term, mode: 'insensitive' as const } },
                    { lastName: { contains: term, mode: 'insensitive' as const } },
                ]
            }));
            where.AND = nameConditions;
        }

        const isMinimal = fields === 'minimal';

        const selectConfig: Prisma.EmployeeSelect = isMinimal ? {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            departmentId: true,
            Department: { select: { name: true } },
            sectionId: true,
            Section: { select: { id: true, name: true } },
            Branch: { select: { name: true } },
        } : {
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
            sectionId: true,
            Section: { select: { id: true, name: true } },
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
            EmployeeShift: {
                select: {
                    id: true,
                    sortOrder: true,
                    isPrimary: true,
                    shift: { select: { id: true, name: true, shiftCode: true, startTime: true, endTime: true, workDays: true, halfDays: true, graceMinutes: true, breakMinutes: true, isNightShift: true } }
                },
                orderBy: { sortOrder: 'asc' }
            },
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
                    deviceId: true,
                    fingerIndex: true,
                },
            },
            DeviceBiometricExclusion: {
                where: { type: 'FINGERPRINT' },
                select: { deviceId: true },
            },
        };

        const [total, employees] = await Promise.all([
            prisma.employee.count({ where }),
            prisma.employee.findMany({
                where,
                select: selectConfig,
                orderBy: [
                    { role: 'asc' },
                    { zkId: 'asc' },
                ],
                skip,
                take: limit,
            })
        ]);

        const activeDevices = await prisma.device.findMany({
            where: { syncEnabled: true },
            select: { id: true }
        });
        const activeDeviceIds = activeDevices.map(d => d.id);

        const mappedEmployees = employees.map(emp => {
            const fingerprintSyncStatus = calculateFingerprintSyncStatus(
                (emp as any).EmployeeFingerprintEnrollment || [],
                (emp as any).DeviceBiometricExclusion || [],
                activeDeviceIds
            );
            return {
                ...emp,
                fingerprintSyncStatus,
            };
        });

        res.json({
            success: true,
            employees: mappedEmployees,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
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
            shiftIds,
            companyId,
            sectionId
        } = req.body;

        // The validators have already handled empty formats

        // Validate required fields
        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'First name and Last name are required'
            });
        }

        // Email is optional. If provided, validate it.
        if (email && email.trim() !== '') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'A valid email is required if provided'
                });
            }
        }

        // Birthdate is required
        if (!dateOfBirth) {
            return res.status(400).json({
                success: false,
                message: 'Date of birth is required'
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

        const normalizedEmail = (email && email.trim() !== '') ? email.trim().toLowerCase() : null;

        // Check for existing employee with same email, employee number
        const existingEmployee = await prisma.employee.findFirst({
            where: {
                OR: [
                    { email: normalizedEmail || undefined },
                    { employeeNumber: employeeNumber || undefined },
                    { contactNumber: contactNumber || undefined },
                ]
            }
        });

        if (existingEmployee) {
            let duplicateField = 'information';
            if (normalizedEmail && existingEmployee.email === normalizedEmail) duplicateField = 'email address';
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
        // Validate min gap
        const gapError = await validateShiftGap(shiftIds);
        if (gapError) {
            release();
            return res.status(400).json({ success: false, message: gapError });
        }

        // Chronologically sort shift assignments to prevent selection-order bugs
        const sortedShiftIds = await getChronologicalShiftIds(shiftIds || []);

        type NewEmployeeResult = Prisma.EmployeeGetPayload<{
            select: {
                id: true; zkId: true; employeeNumber: true; firstName: true; lastName: true;
                middleName: true; suffix: true; gender: true; dateOfBirth: true; email: true;
                role: true; departmentId: true; Department: { select: { name: true } };
                sectionId: true; Section: { select: { id: true; name: true } };
                position: true; branchId: true; Branch: { select: { name: true } };
                companyId: true; Company: { select: { id: true; name: true } };
                contactNumber: true; hireDate: true; employmentStatus: true; createdAt: true;
            }
        }>;
        let newEmployee: NewEmployeeResult | undefined;
        let generatedPassword = '';

        try {
            if (normalizedEmail) {
                generatedPassword = generateRandomPassword(10);
            } else {
                generatedPassword = getBirthdatePassword(dateOfBirth);
            }
            const hashedPassword = await bcrypt.hash(generatedPassword, 10);

            const safeResult = await findNextSafeZkId();
            const nextZkId = safeResult.zkId;

            newEmployee = await prisma.$transaction(async (tx) => {
                const emp = await tx.employee.create({
                    data: {
                        employeeNumber: employeeNumber.trim(),
                        firstName,
                        lastName,
                        middleName: middleName || null,
                        suffix: suffix || null,
                        gender: gender || null,
                        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                        email: normalizedEmail,
                        password: hashedPassword,
                        role: 'USER',
                        departmentId: departmentId ? parseInt(departmentId, 10) : null,
                        sectionId: sectionId ? parseInt(sectionId, 10) : null,
                        position,
                        branchId: branchId ? parseInt(branchId, 10) : null,
                        companyId: companyId ? parseInt(companyId, 10) : null,
                        contactNumber,
                        hireDate: hireDate ? new Date(hireDate) : undefined,
                        employmentStatus: employmentStatus || 'ACTIVE',
                        zkId: nextZkId,
                        shiftId: sortedShiftIds.length > 0 ? sortedShiftIds[0] : (shiftId ? parseInt(shiftId, 10) : null),
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
                        sectionId: true,
                        Section: { select: { id: true, name: true } },
                        position: true,
                        branchId: true,
                        Branch: { select: { name: true } },
                        companyId: true,
                        Company: { select: { id: true, name: true } },
                        contactNumber: true,
                        hireDate: true,
                        employmentStatus: true, createdAt: true }
                });

                if (sortedShiftIds.length > 0) {
                    await tx.employeeShift.createMany({
                        data: sortedShiftIds.map((sid: number, i: number) => ({
                            employeeId: emp.id,
                            shiftId: sid,
                            sortOrder: i,
                            isPrimary: i === 0
                        }))
                    });
                }

                return emp;
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
            if (normalizedEmail) {
                try {
                    await sendWelcomeEmail(normalizedEmail, `${firstName} ${lastName}`, generatedPassword);
                } catch (emailErr) {
                    console.error(`[API] (background) Failed to send welcome email to ${normalizedEmail}:`, emailErr);
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
            shiftIds,
            companyId,
            employmentStatus,
            sectionId
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
        if (sectionId !== undefined) {
            updateData.sectionId = sectionId ? parseInt(sectionId, 10) : null;
        }
        if (branchId !== undefined) {
            updateData.branchId = branchId ? parseInt(branchId, 10) : null;
        }
        if (hireDate !== undefined && hireDate !== null && hireDate !== '') {
            updateData.hireDate = new Date(hireDate);
        }
        if (shiftId !== undefined) updateData.shiftId = shiftId ? parseInt(shiftId, 10) : null;
        if (companyId !== undefined) updateData.companyId = companyId ? parseInt(companyId, 10) : null;
        if (employmentStatus !== undefined && ['ACTIVE', 'INACTIVE', 'TERMINATED'].includes(employmentStatus)) {
            updateData.employmentStatus = employmentStatus;
        }

        // Validate multi-shift gap
        const gapError = await validateShiftGap(shiftIds);
        if (gapError) {
            return res.status(400).json({ success: false, message: gapError });
        }

        // Chronologically sort shift assignments to prevent selection-order bugs
        const sortedShiftIds = await getChronologicalShiftIds(shiftIds || []);

        updateData.updatedAt = new Date();

        // Update the employee and shifts in a single transaction
        const updatedEmployee = await prisma.$transaction(async (tx) => {
            const emp = await tx.employee.update({
                where: { id: employeeId },
                data: updateData,
                select: {
                    id: true,
                    zkId: true,
                    employeeNumber: true,
                    cardNumber: true,
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
                    sectionId: true,
                    Section: { select: { id: true, name: true } },
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

            if (shiftIds && Array.isArray(shiftIds)) {
                // Get original shift assignments before deleting them
                const originalAssignments = await tx.employeeShift.findMany({
                    where: { employeeId },
                    select: { shiftId: true }
                });
                const originalShiftIds = originalAssignments.map(a => a.shiftId);
                
                // Also get the current employee legacy shiftId in case assignments were empty
                const originalLegacyShiftId = existingEmployee.shiftId;
                if (originalLegacyShiftId && !originalShiftIds.includes(originalLegacyShiftId)) {
                    originalShiftIds.push(originalLegacyShiftId);
                }

                // Delete existing shift assignments
                await tx.employeeShift.deleteMany({ where: { employeeId } });

                // Create new assignments (if any)
                if (sortedShiftIds.length > 0) {
                    await tx.employeeShift.createMany({
                        data: sortedShiftIds.map((sid: number, i: number) => ({
                            employeeId,
                            shiftId: sid,
                            sortOrder: i,
                            isPrimary: i === 0
                        }))
                    });
                }

                // Also update legacy shiftId to the primary shift for backward compatibility
                // (Though it might have been in updateData, we ensure it here)
                await tx.employee.update({
                    where: { id: employeeId },
                    data: { shiftId: sortedShiftIds[0] || null }
                });

                // Same-day shift reassignment logic
                await reassignSameDayShifts(employeeId, originalShiftIds, sortedShiftIds, tx);
            }

            return emp;
        });

        const trackedFields = Object.keys(updateData).filter(k => k !== 'updatedAt' && k !== 'password');
        const changes = buildChanges(existingEmployee as Record<string, unknown>, updateData, trackedFields);

        if (shiftIds && Array.isArray(shiftIds)) {
            changes.push({ field: 'shiftIds', oldValue: undefined, newValue: shiftIds });
        }

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
            const cardChanged = req.body.cardNumber !== undefined && req.body.cardNumber !== existingEmployee.cardNumber;
            if (nameChanged || cardChanged) {
                const fullName = `${updatedEmployee.firstName} ${updatedEmployee.lastName}`;
                setImmediate(async () => {
                    try {
                        // Fetch all device admin settings for this employee
                        const enrollments = await prisma.employeeDeviceEnrollment.findMany({
                            where: { employeeId: updatedEmployee.id, isDeviceAdmin: true },
                            select: { deviceId: true }
                        });
                        const adminDeviceIds = new Set(enrollments.map(e => e.deviceId));

                        // Find all active + sync-enabled devices
                        const devices = await prisma.device.findMany({
                            where: { isActive: true, syncEnabled: true },
                            select: { id: true }
                        });

                        const { enqueueUpsertUser, processDeviceSyncQueue } = require('../devices/deviceSyncQueue.service');

                        for (const d of devices) {
                            const deviceRole = adminDeviceIds.has(d.id) ? 14 : 0;
                            await enqueueUpsertUser(d.id, {
                                zkId: updatedEmployee.zkId!,
                                name: fullName,
                                card: updatedEmployee.cardNumber ?? 0,
                                role: deviceRole
                            });
                            try {
                                await processDeviceSyncQueue(d.id);
                            } catch {
                                // Ignore and let background cron handle offline/error devices
                            }
                        }
                        console.log(`[API] (background) Queued UPSERT_USER for zkId=${updatedEmployee.zkId} on ${devices.length} devices.`);
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

        // Check if employee exists
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, firstName: true, lastName: true, email: true, dateOfBirth: true },
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found',
            });
        }

        let generatedPassword = '';
        const hasEmail = employee.email && employee.email.trim() !== '';

        if (hasEmail) {
            generatedPassword = generateRandomPassword(10);
        } else {
            if (!employee.dateOfBirth) {
                return res.status(400).json({
                    success: false,
                    message: 'Employee does not have a birthdate configured, which is required to generate the default password.',
                });
            }

            try {
                generatedPassword = getBirthdatePassword(employee.dateOfBirth);
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to parse the employee birthdate to generate the default password.',
                });
            }
        }

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

        if (hasEmail) {
            // Send email
            const emailSent = await sendPasswordResetEmail(
                employee.email!,
                `${employee.firstName} ${employee.lastName}`,
                generatedPassword
            );

            if (!emailSent) {
                return res.status(500).json({
                    success: false,
                    message: "Password was reset but the email could not be sent. Please verify SMTP configuration and try again.",
                });
            }

            return res.json({
                success: true,
                message: `Password reset successfully. Email sent to ${employee.email}.`,
            });
        } else {
            return res.json({
                success: true,
                message: `Password reset successfully to the default birthdate-based password (${generatedPassword}).`,
            });
        }

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




