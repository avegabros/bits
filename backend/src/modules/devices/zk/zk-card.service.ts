interface SyncResult { success: boolean; message?: string; error?: string; count?: number; results?: Record<string, unknown>[]; }

import { prisma } from '../../../shared/lib/prisma';
import { ZKDriver } from '../../../shared/lib/zk-driver';
import { getDriver, connectWithRetry, zkErrMsg } from './zk-connection.service';
import { acquireDeviceLock, releaseDeviceLock, acquireRegistrationMutex } from './zk-lock.service';
import { findNextSafeZkId } from './zk-user.service';
import { audit } from '../../../shared/lib/auditLogger';


export const enrollEmployeeCard = async (
    employeeId: number,
    cardNumber: number,
    targetDeviceId?: number,
): Promise<SyncResult> => {
    console.log(`[CardEnroll] Starting for employee ${employeeId}, card ${cardNumber}...`);

    // 1. Load employee from DB
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, zkId: true, firstName: true, lastName: true, role: true, cardNumber: true, employmentStatus: true, email: true },
    });

    if (!employee) {
        return { success: false, message: `Employee ${employeeId} not found in database.` };
    }

    const fullName = `${employee.firstName} ${employee.lastName}`;

    let currentZkId = employee.zkId;
    let employeeUpdates: any = { cardNumber, updatedAt: new Date() };

    const release = await acquireRegistrationMutex();
    try {
        if (!currentZkId) {
            console.log(`[CardEnroll] Assigning new zkId for STAGED employee ${employeeId}...`);
            const safeResult = await findNextSafeZkId();
            currentZkId = safeResult.zkId;
            employeeUpdates.zkId = currentZkId;
        }

        if (employee.employmentStatus === 'STAGED') {
            const { generateRandomPassword } = require('../../../shared/utils/password.utils');
            const { sendWelcomeEmail } = require('../../../shared/lib/email.service');
            const bcrypt = require('bcrypt');

            const newPassword = generateRandomPassword(10);
            employeeUpdates.password = await bcrypt.hash(newPassword, 10);
            employeeUpdates.employmentStatus = 'ACTIVE';
            console.log(`[CardEnroll] Promoting employee ${employeeId} from STAGED to ACTIVE.`);

            if (employee.email) {
                setImmediate(async () => {
                    try {
                        await sendWelcomeEmail(employee.email, fullName, newPassword);
                    } catch (emailErr) {
                        console.error(`[CardEnroll] Failed to send welcome email to ${employee.email}`, emailErr);
                    }
                });
            }
        }

        // 2. Validate card number uniqueness
        const existingHolder = await prisma.employee.findUnique({
            where: { cardNumber },
            select: { id: true, firstName: true, lastName: true },
        });

        if (existingHolder && existingHolder.id !== employeeId) {
            return {
                success: false,
                message: `Card #${cardNumber} is already assigned to ${existingHolder.firstName} ${existingHolder.lastName}.`,
                error: 'duplicate_card',
            };
        }

        // 3. Persist to DB FIRST.
        await prisma.employee.update({
            where: { id: employeeId },
            data: employeeUpdates,
        });

    } finally {
        release();
    }

    // 4. Queue update for target device or globally SECOND.
    const deviceRole = employee.role === 'ADMIN' ? 14 : 0;
    const { enqueueUpsertUser, processDeviceSyncQueue } = require('../deviceSyncQueue.service');
    const { getExcludedDeviceIds } = require('../biometric-exclusion.service');

    try {
        if (targetDeviceId) {
            await enqueueUpsertUser(targetDeviceId, {
                zkId: currentZkId!,
                name: fullName,
                role: deviceRole,
                card: cardNumber
            });
            // Inline execution.
            setImmediate(async () => {
                const dev = await prisma.device.findUnique({ where: { id: targetDeviceId } });
                if (dev?.isActive && dev?.syncEnabled) {
                    try { await processDeviceSyncQueue(targetDeviceId); } catch { /* retry */ }
                }
            });
        } else {
            const devices = await prisma.device.findMany({ where: { syncEnabled: true }, select: { id: true } });
            const cardExclusions = await getExcludedDeviceIds(employeeId, 'CARD');
            for (const dev of devices) {
                const effectiveCard = cardExclusions.has(dev.id) ? 0 : cardNumber;
                await enqueueUpsertUser(dev.id, {
                    zkId: currentZkId!,
                    name: fullName,
                    role: deviceRole,
                    card: effectiveCard
                });
            }
            // Inline execution for active devices.
            setImmediate(async () => {
                const onlineDevices = await prisma.device.findMany({
                    where: { isActive: true, syncEnabled: true },
                    select: { id: true },
                });
                for (const d of onlineDevices) {
                    try { await processDeviceSyncQueue(d.id); } catch { /* retry */ }
                }
            });
        }

        return {
            success: true,
            message: `Card #${cardNumber} enrolled for ${fullName} and queued for sync.`,
            results: [],
        };
    } catch (err: unknown) {
        console.error('[CardEnroll] Queue Error:', err);
        return { success: false, message: `Failed to queue card enrollment: ${zkErrMsg(err)}` };
    }
};

export const deleteEmployeeCard = async (
    employeeId: number,
    targetDeviceId?: number,
): Promise<SyncResult> => {
    console.log(`[CardDelete] Starting for employee ${employeeId}...`);

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, zkId: true, firstName: true, lastName: true, role: true, cardNumber: true },
    });

    if (!employee) return { success: false, message: `Employee ${employeeId} not found in database.` };
    if (!employee.zkId) return { success: false, message: `Employee ${employeeId} has no zkId assigned.` };
    if (!employee.cardNumber) return { success: true, message: `Employee already has no card assigned.` };

    const fullName = `${employee.firstName} ${employee.lastName}`;
    const deviceRole = employee.role === 'ADMIN' ? 14 : 0;
    const { enqueueGlobalUpsertUser, enqueueUpsertUser, processDeviceSyncQueue } = require('../deviceSyncQueue.service');

    try {
        if (targetDeviceId) {
            await enqueueUpsertUser(targetDeviceId, {
                zkId: employee.zkId,
                name: fullName,
                role: deviceRole,
                card: 0
            });
            await prisma.employeeCardEnrollment.deleteMany({
                where: { employeeId, deviceId: targetDeviceId }
            });
            // Inline execution.
            setImmediate(async () => {
                const dev = await prisma.device.findUnique({ where: { id: targetDeviceId } });
                if (dev?.isActive && dev?.syncEnabled) {
                    try { await processDeviceSyncQueue(targetDeviceId); } catch { /* retry */ }
                }
            });
        } else {
            const devices = await prisma.device.findMany({ where: { syncEnabled: true }, select: { id: true } });
            for (const dev of devices) {
                await enqueueUpsertUser(dev.id, {
                    zkId: employee.zkId,
                    name: fullName,
                    role: deviceRole,
                    card: 0
                });
            }
            // Try inline execution for all active
            setImmediate(async () => {
                const onlineDevices = await prisma.device.findMany({
                    where: { isActive: true, syncEnabled: true },
                    select: { id: true },
                });
                for (const d of onlineDevices) {
                    try { await processDeviceSyncQueue(d.id); } catch { /* retry */ }
                }
            });
        }

        // Drop global configuration state.
        if (!targetDeviceId) {
            await prisma.employee.update({
                where: { id: employeeId },
                data: { cardNumber: null, updatedAt: new Date() },
            });
            await prisma.employeeCardEnrollment.deleteMany({
                where: { employeeId }
            });
        }

        return {
            success: true,
            message: `Card removal queued successfully.`
        };
    } catch (err: unknown) {
        console.error('[CardDelete] Queue Error:', err);
        return { success: false, message: `Failed to queue card deletion: ${zkErrMsg(err)}` };
    }
};





