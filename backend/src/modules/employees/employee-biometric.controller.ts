import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../../shared/lib/prisma';
import { syncEmployeesToDevice, enrollEmployeeFingerprint, enrollEmployeeCard, deleteEmployeeCard, addUserToDevice, deleteUserFromDevice, findNextSafeZkId, acquireRegistrationMutex, deleteFingerprintGlobally, syncEmployeeFingerprints } from '../devices/zk';
import { enqueueGlobalUpsertUser, enqueueGlobalDeleteUser, processDeviceSyncQueue } from '../devices/deviceSyncQueue.service';
import { audit } from '../../shared/lib/auditLogger';
import bcrypt from 'bcryptjs';
import { generateRandomPassword } from '../../shared/utils/password.utils';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../../shared/lib/email.service';


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

        const body = req.body || {};
        const { fingerIndex, deviceId } = body;

        const finger = fingerIndex !== undefined ? parseInt(fingerIndex) : 5;

        if (finger < 0 || finger > 9) {
            return res.status(400).json({
                success: false,
                message: 'Finger index must be between 0 and 9',
            });
        }

        const device = deviceId ? parseInt(deviceId) : undefined;

        // Check 3-finger max limit
        const existingFingers = await prisma.employeeFingerprintEnrollment.findMany({
            where: { employeeId },
            distinct: ['fingerIndex'],
            select: { fingerIndex: true },
        });

        const isNewFinger = !existingFingers.some(f => f.fingerIndex === finger);
        if (isNewFinger && existingFingers.length >= 3) {
            return res.status(400).json({
                success: false,
                message: 'Employee has reached the maximum limit of 3 fingerprints. Please delete an existing fingerprint first.',
            });
        }

        console.log(`[API] Starting fingerprint enrollment for employee ${employeeId} (finger: ${finger}, device: ${device ?? 'auto'})...`);

        const result = await enrollEmployeeFingerprint(employeeId, finger, device);

        if (result.success) {
            const emp = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { firstName: true, lastName: true, zkId: true }
            });

            void audit({
                action: 'UPDATE',
                entityType: 'Employee',
                entityId: employeeId,
                performedBy: req.user?.employeeId,
                details: `Triggered fingerprint enrollment on device for ${emp?.firstName} ${emp?.lastName} (Finger ${finger})`,
                metadata: { deviceId: device, fingerIndex: finger, zkId: emp?.zkId },
                correlationId: req.correlationId
            });

            return res.status(200).json({
                success: true,
                message: result.message,
            });
        } else {
            const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { firstName: true, lastName: true } });

            void audit({
                action: 'UPDATE',
                level: 'ERROR',
                entityType: 'Employee',
                entityId: employeeId,
                performedBy: req.user?.employeeId,
                details: `Failed to enroll fingerprint for ${emp?.firstName} ${emp?.lastName} (Finger ${finger}): ${result.message}`,
                metadata: { deviceId: device, fingerIndex: finger, error: result.error || result.message },
                correlationId: req.correlationId
            });

            return res.status(500).json({
                success: false,
                message: result.message || 'Enrollment failed',
                error: result.error,
            });
        }

    } catch (error: unknown) {
        console.error('[API] Enrollment error:', error);

        const errMsg = error instanceof Error ? error.message : String(error);
        const empId = req.params.id ? parseInt(req.params.id as string) : undefined;
        void audit({
            action: 'UPDATE',
            level: 'ERROR',
            entityType: 'Employee',
            entityId: isNaN(empId as number) ? undefined : empId,
            performedBy: req.user?.employeeId,
            details: `Exception while starting fingerprint enrollment: ${errMsg}`,
            metadata: { error: errMsg, body: req.body },
            correlationId: req.correlationId
        });

        return res.status(500).json({
            success: false,
            message: 'Failed to start enrollment',
            error: process.env.NODE_ENV === 'development' ? errMsg : undefined,
        });
    }
};
// POST /api/employees/:id/enroll-card - Enroll RFID badge card for employee
export const enrollEmployeeCardController = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const employeeId = parseInt(id);

        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid employee ID',
            });
        }

        const body = req.body || {};
        const cardNumber = parseInt(body.cardNumber);

        if (isNaN(cardNumber) || cardNumber < 1 || cardNumber > 4294967295) {
            return res.status(400).json({
                success: false,
                message: 'Card number must be a valid uint32 (1–4294967295)',
            });
        }

        const deviceIdParam = body.deviceId;
        const deviceId = deviceIdParam ? parseInt(deviceIdParam as string) : undefined;

        console.log(`[API] Starting RFID card enrollment for employee ${employeeId}, card ${cardNumber}${deviceId ? ` on device ${deviceId}` : ''}...`);

        const result = await enrollEmployeeCard(employeeId, cardNumber, deviceId);

        if (result.success) {
            const emp = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { firstName: true, lastName: true, zkId: true }
            });

            void audit({
                action: 'UPDATE',
                entityType: 'Employee',
                entityId: employeeId,
                performedBy: req.user?.employeeId,
                details: `Enrolled RFID badge #${cardNumber} for ${emp?.firstName} ${emp?.lastName}`,
                metadata: { cardNumber, zkId: emp?.zkId },
                correlationId: req.correlationId
            });

            return res.status(200).json({
                success: true,
                message: result.message,
                results: result.results,
            });
        } else {
            const statusCode = result.error === 'duplicate_card' ? 409 : 500;

            void audit({
                action: 'UPDATE',
                level: 'ERROR',
                entityType: 'Employee',
                entityId: employeeId,
                performedBy: req.user?.employeeId,
                details: `Failed to enroll RFID badge #${cardNumber}: ${result.message}`,
                metadata: { cardNumber, error: result.error || result.message },
                correlationId: req.correlationId
            });

            return res.status(statusCode).json({
                success: false,
                message: result.message || 'Card enrollment failed',
                error: result.error,
                results: result.results,
            });
        }

    } catch (error: unknown) {
        console.error('[API] Card enrollment error:', error);

        const errMsg = error instanceof Error ? error.message : String(error);
        const empId = req.params.id ? parseInt(req.params.id as string) : undefined;
        void audit({
            action: 'UPDATE',
            level: 'ERROR',
            entityType: 'Employee',
            entityId: isNaN(empId as number) ? undefined : empId,
            performedBy: req.user?.employeeId,
            details: `Exception while enrolling RFID badge: ${errMsg}`,
            metadata: { error: errMsg, body: req.body },
            correlationId: req.correlationId
        });

        return res.status(500).json({
            success: false,
            message: 'Failed to enroll RFID badge',
            error: process.env.NODE_ENV === 'development' ? errMsg : undefined,
        });
    }
};
export const deleteEmployeeCardController = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const employeeId = parseInt(id);

        if (isNaN(employeeId)) {
            return res.status(400).json({ success: false, message: 'Invalid employee ID' });
        }

        const deviceIdParam = req.params.deviceId;
        const deviceId = deviceIdParam ? parseInt(deviceIdParam as string) : undefined;

        console.log(`[API] Deleting RFID card for employee ${employeeId}${deviceId ? ` on device ${deviceId}` : ''}...`);

        const result = await deleteEmployeeCard(employeeId, deviceId);

        if (result.success) {
            const emp = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { firstName: true, lastName: true, zkId: true }
            });

            void audit({
                action: 'DELETE',
                entityType: 'Employee',
                entityId: employeeId,
                performedBy: req.user?.employeeId,
                level: 'WARN',
                details: `Removed RFID badge for ${emp?.firstName} ${emp?.lastName}`,
                metadata: { zkId: emp?.zkId },
                correlationId: req.correlationId
            });

            return res.status(200).json({
                success: true,
                message: result.message,
            });
        } else {
            return res.status(500).json({
                success: false,
                message: result.message || 'Card deletion failed',
                error: result.error,
            });
        }

    } catch (error: unknown) {
        console.error('[API] Card deletion error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during card deletion',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
// GET /api/employees/:id/fingerprint-status - Get fingerprint enrollment dashboard data
export const getEmployeeFingerprintStatus = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.id as string);

        if (isNaN(employeeId)) {
            return res.status(400).json({ success: false, message: 'Invalid employee ID' });
        }

        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, zkId: true, firstName: true, lastName: true },
        });

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Fetch all fingerprint enrollment records for this employee
        const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
            where: { employeeId },
            include: {
                device: {
                    select: { id: true, name: true, isActive: true, syncEnabled: true },
                },
            },
        });

        // Fetch all devices
        const activeDevices = await prisma.device.findMany({
            select: { id: true, name: true, isActive: true, syncEnabled: true },
            orderBy: { id: 'asc' },
        });

        // Group enrollments by fingerIndex → collect device info per finger
        const fingerMap = new Map<number, {
            fingerIndex: number;
            fingerLabel: string;
            devices: {
                deviceId: number;
                deviceName: string;
                enrolled: boolean;
                enrolledAt?: string;
                isActive: boolean;
                syncEnabled: boolean;
                pendingDeletion: boolean;
            }[];
        }>();

        for (const enrollment of enrollments) {
            if (!fingerMap.has(enrollment.fingerIndex)) {
                fingerMap.set(enrollment.fingerIndex, {
                    fingerIndex: enrollment.fingerIndex,
                    fingerLabel: `Finger ${enrollment.fingerIndex + 1}`,
                    devices: [],
                });
            }

            fingerMap.get(enrollment.fingerIndex)!.devices.push({
                deviceId: enrollment.device.id,
                deviceName: enrollment.device.name,
                enrolled: true,
                enrolledAt: enrollment.enrolledAt.toISOString(),
                isActive: enrollment.device.isActive,
                syncEnabled: enrollment.device.syncEnabled,
                pendingDeletion: false,
            });
        }

        // Build slots array (Finger 1/2/3) — map existing enrollments to slots
        const MAX_SLOTS = 3;
        const enrolledFingerIndices = Array.from(fingerMap.keys()).sort((a, b) => a - b);
        const slots: Array<{
            slot: number;
            label: string;
            fingerIndex: number | null;
            enrolled: boolean;
            devices: {
                deviceId: number;
                deviceName: string;
                enrolled: boolean;
                enrolledAt?: string;
                isActive: boolean;
                syncEnabled: boolean;
                pendingDeletion: boolean;
            }[];
        }> = [];

        for (let i = 0; i < MAX_SLOTS; i++) {
            const fingerIndex = enrolledFingerIndices[i] ?? null;
            const fingerData = fingerIndex !== null ? fingerMap.get(fingerIndex) : null;

            const devices = activeDevices.map(device => {
                const enrolledDevice = fingerData?.devices.find(d => d.deviceId === device.id);
                return {
                    deviceId: device.id,
                    deviceName: device.name,
                    enrolled: enrolledDevice?.enrolled ?? false,
                    enrolledAt: enrolledDevice?.enrolledAt,
                    isActive: device.isActive,
                    syncEnabled: device.syncEnabled,
                    pendingDeletion: enrolledDevice?.pendingDeletion ?? false,
                };
            });

            slots.push({
                slot: i + 1,
                label: `Finger ${i + 1}`,
                fingerIndex,
                enrolled: fingerData !== null,
                devices,
            });
        }

        const totalEnrolled = fingerMap.size;

        return res.status(200).json({
            success: true,
            employee: {
                id: employee.id,
                name: `${employee.firstName} ${employee.lastName}`,
                zkId: employee.zkId,
            },
            slots,
            summary: {
                totalEnrolled,
                maxSlots: MAX_SLOTS,
                canEnrollMore: totalEnrolled < MAX_SLOTS,
            },
            allDevices: activeDevices,
        });

    } catch (error: unknown) {
        console.error('[API] Fingerprint status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch fingerprint status',
        });
    }
};
// DELETE /api/employees/:id/fingerprint/:fingerIndex - Delete specific fingerprint globally
export const deleteEmployeeFingerprint = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.id as string);
        const fingerIndex = parseInt(req.params.fingerIndex as string);

        if (isNaN(employeeId) || isNaN(fingerIndex)) {
            return res.status(400).json({ success: false, message: 'Invalid parameters' });
        }

        if (fingerIndex < 0 || fingerIndex > 9) {
            return res.status(400).json({ success: false, message: 'Finger index must be between 0 and 9' });
        }

        const result = await deleteFingerprintGlobally(employeeId, fingerIndex);

        if (result.success) {
            const fingerLabel = `Finger ${fingerIndex + 1}`;

            void audit({
                action: 'DELETE',
                entityType: 'Employee',
                entityId: employeeId,
                performedBy: req.user?.employeeId,
                level: 'WARN',
                details: `Deleted ${fingerLabel} globally`,
                metadata: { fingerIndex, fingerLabel },
                correlationId: req.correlationId
            });

            return res.status(200).json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error: unknown) {
        console.error('[API] Delete fingerprint error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete fingerprint',
        });
    }
};
// POST /api/employees/:id/sync-fingerprints - Sync fingerprints across devices
export const syncEmployeeFingerprintsController = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.id as string);

        if (isNaN(employeeId)) {
            return res.status(400).json({ success: false, message: 'Invalid employee ID' });
        }

        const result = await syncEmployeeFingerprints(employeeId);

        if (result.success) {
            const emp = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { firstName: true, lastName: true },
            });

            void audit({
                action: 'UPDATE',
                entityType: 'Employee',
                entityId: employeeId,
                performedBy: req.user?.employeeId,
                details: `Synced fingerprints for ${emp?.firstName} ${emp?.lastName}: ${result.results.filter((r: { status: string }) => r.status === 'synced').length} device(s)`,
                metadata: { results: result.results },
                correlationId: req.correlationId
            });

            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }

    } catch (error: unknown) {
        console.error('[API] Sync fingerprints error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to sync fingerprints',
            results: [],
        });
    }
};
// GET /api/employees/:id/card-status - Get card enrollment dashboard data
export const getEmployeeCardStatus = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.id as string);

        if (isNaN(employeeId)) {
            return res.status(400).json({ success: false, message: 'Invalid employee ID' });
        }

        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, zkId: true, firstName: true, lastName: true, cardNumber: true },
        });

        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Fetch all card enrollment records for this employee
        const enrollments = await prisma.employeeCardEnrollment.findMany({
            where: { employeeId },
            include: {
                device: {
                    select: { id: true, name: true, isActive: true, syncEnabled: true },
                },
            },
        });

        // Fetch all devices
        const activeDevices = await prisma.device.findMany({
            select: { id: true, name: true, isActive: true, syncEnabled: true },
            orderBy: { id: 'asc' },
        });

        // Build devices result
        const devicesResult = activeDevices.map(device => {
            const enroll = enrollments.find(e => e.deviceId === device.id);
            return {
                deviceId: device.id,
                deviceName: device.name,
                enrolled: !!enroll,
                enrolledAt: enroll ? enroll.enrolledAt.toISOString() : undefined,
                isActive: device.isActive,
                syncEnabled: device.syncEnabled,
                pendingDeletion: false,
            };
        });

        res.json({
            success: true,
            employee: {
                id: employee.id,
                name: `${employee.firstName} ${employee.lastName}`,
                cardNumber: employee.cardNumber,
            },
            devices: devicesResult,
        });

    } catch (error: unknown) {
        console.error('Error fetching employee card status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee card status',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
        });
    }
};




