import { prisma } from '../../shared/lib/prisma';
import { audit } from '../../shared/lib/auditLogger';
import {
    enqueueDeleteFinger,
    enqueueFingerprintPull,
    enqueueUpsertUser,
    processDeviceSyncQueue
} from './deviceSyncQueue.service';

export async function getExcludedDeviceIds(employeeId: number, type: 'FINGERPRINT' | 'CARD'): Promise<Set<number>> {
    const exclusions = await prisma.deviceBiometricExclusion.findMany({
        where: { employeeId, type },
        select: { deviceId: true }
    });
    return new Set(exclusions.map(e => e.deviceId));
}

export async function getExcludedEmployeeIds(deviceId: number, type: 'FINGERPRINT' | 'CARD'): Promise<Set<number>> {
    const exclusions = await prisma.deviceBiometricExclusion.findMany({
        where: { deviceId, type },
        select: { employeeId: true }
    });
    return new Set(exclusions.map(e => e.employeeId));
}

export async function addExclusion(
    employeeId: number,
    deviceId: number,
    type: 'FINGERPRINT' | 'CARD',
    excludedBy?: number,
    reason?: string
): Promise<void> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, zkId: true, firstName: true, lastName: true, role: true, cardNumber: true }
    });

    if (!employee || !employee.zkId) {
        throw new Error(`Employee ${employeeId} not found or has no zkId`);
    }

    const device = await prisma.device.findUnique({
        where: { id: deviceId }
    });

    if (!device) {
        throw new Error(`Device ${deviceId} not found`);
    }

    // 1. Create or ensure exclusion record
    await prisma.deviceBiometricExclusion.upsert({
        where: {
            employeeId_deviceId_type: {
                employeeId,
                deviceId,
                type
            }
        },
        update: { excludedAt: new Date(), excludedBy, reason },
        create: { employeeId, deviceId, type, excludedBy, reason }
    });

    // 2. Perform side effects
    if (type === 'FINGERPRINT') {
        // Always delete fingers 0, 1, 2 — the only slots used for enrollment
        for (const fingerIndex of [0, 1, 2]) {
            await enqueueDeleteFinger(deviceId, {
                zkId: employee.zkId,
                fingerIndex
            });
        }

        // Clean up database records
        await prisma.employeeFingerprintEnrollment.deleteMany({
            where: { employeeId, deviceId }
        });

        const remaining = await prisma.employeeFingerprintEnrollment.count({
            where: { employeeId, deviceId }
        });

        if (remaining === 0) {
            await prisma.employeeDeviceEnrollment.deleteMany({
                where: { employeeId, deviceId }
            });
        }

    } else if (type === 'CARD') {
        // Enqueue UPSERT_USER with card: 0
        const enrollment = await prisma.employeeDeviceEnrollment.findUnique({
            where: { employeeId_deviceId: { employeeId, deviceId } },
            select: { isDeviceAdmin: true }
        });
        const deviceRole = enrollment?.isDeviceAdmin ? 14 : 0;
        await enqueueUpsertUser(deviceId, {
            zkId: employee.zkId,
            name: `${employee.firstName} ${employee.lastName}`,
            role: deviceRole,
            card: 0
        });

        // Clean up database records
        await prisma.employeeCardEnrollment.deleteMany({
            where: { employeeId, deviceId }
        });
    }

    // Process queue in background
    if (device.isActive && device.syncEnabled) {
        setImmediate(async () => {
            try { await processDeviceSyncQueue(deviceId); } catch { /* ignore */ }
        });
    }

    // Audit log
    void audit({
        action: 'BIOMETRIC_EXCLUSION_ADD',
        level: 'WARN',
        entityType: 'Employee',
        entityId: employeeId,
        performedBy: excludedBy,
        source: 'system',
        details: `Excluded ${type} sync for ${employee.firstName} on ${device.name}`,
        metadata: { deviceId, type, reason }
    });
}

export async function removeExclusion(
    employeeId: number,
    deviceId: number,
    type: 'FINGERPRINT' | 'CARD',
    performedBy?: number
): Promise<void> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, zkId: true, firstName: true, lastName: true, role: true, cardNumber: true }
    });

    if (!employee || !employee.zkId) {
        throw new Error(`Employee ${employeeId} not found or has no zkId`);
    }

    const device = await prisma.device.findUnique({
        where: { id: deviceId }
    });

    if (!device) {
        throw new Error(`Device ${deviceId} not found`);
    }

    // 1. Delete exclusion record
    await prisma.deviceBiometricExclusion.deleteMany({
        where: { employeeId, deviceId, type }
    });

    // 2. Perform side effects
    if (type === 'FINGERPRINT') {
        // Enqueue SYNC_FINGER_FROM_SOURCE for all globally enrolled fingers
        const allEnrollments = await prisma.employeeFingerprintEnrollment.findMany({
            where: { employeeId }
        });

        // Get unique finger indices
        const uniqueFingers = Array.from(new Set(allEnrollments.map(e => e.fingerIndex)));

        for (const fingerIndex of uniqueFingers) {
            await enqueueFingerprintPull(deviceId, {
                zkId: employee.zkId,
                fingerIndex,
                employeeId
            });
        }
    } else if (type === 'CARD') {
        if (employee.cardNumber && employee.cardNumber > 0) {
            const enrollment = await prisma.employeeDeviceEnrollment.findUnique({
                where: { employeeId_deviceId: { employeeId, deviceId } },
                select: { isDeviceAdmin: true }
            });
            const deviceRole = enrollment?.isDeviceAdmin ? 14 : 0;
            await enqueueUpsertUser(deviceId, {
                zkId: employee.zkId,
                name: `${employee.firstName} ${employee.lastName}`,
                role: deviceRole,
                card: employee.cardNumber
            });
        }
    }

    // Process queue in background
    if (device.isActive && device.syncEnabled) {
        setImmediate(async () => {
            try { await processDeviceSyncQueue(deviceId); } catch { /* ignore */ }
        });
    }

    // Audit log
    void audit({
        action: 'BIOMETRIC_EXCLUSION_REMOVE',
        level: 'INFO',
        entityType: 'Employee',
        entityId: employeeId,
        performedBy,
        source: 'system',
        details: `Removed ${type} sync exclusion for ${employee.firstName} on ${device.name}`,
        metadata: { deviceId, type }
    });
}
