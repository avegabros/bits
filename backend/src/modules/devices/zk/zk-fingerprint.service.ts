import { prisma } from '../../../shared/lib/prisma';
import { ZKDriver } from '../../../shared/lib/zk-driver';
import { getDriver, connectWithRetry, zkErrMsg } from './zk-connection.service';
import { acquireDeviceLock, releaseDeviceLock, acquireInteractiveDeviceLock } from './zk-lock.service';
import { getExcludedDeviceIds } from '../biometric-exclusion.service';
import { getDeviceRoute } from '../device-router.service';
import { sendAgentCommand } from '../agent-gateway.service';

const FINGER_MAP: { [key: number]: string } = { 5: 'Right Thumb', 6: 'Right Index', 7: 'Right Middle', 8: 'Right Ring', 9: 'Right Little', 4: 'Left Thumb', 3: 'Left Index', 2: 'Left Middle', 1: 'Left Ring', 0: 'Left Little' };
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
import { audit } from '../../../shared/lib/auditLogger';
interface SyncResult { success: boolean; message?: string; error?: string; newLogs?: number; count?: number; results?: Record<string, unknown>[]; }


export const deleteFingerprintGlobally = async (
    employeeId: number,
    fingerIndex: number
): Promise<{ success: boolean; message: string }> => {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, zkId: true, firstName: true, lastName: true },
    });

    if (!employee?.zkId) {
        return { success: false, message: 'Employee not found or has no zkId' };
    }

    const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
        where: { employeeId, fingerIndex },
        include: { device: true },
    });

    if (enrollments.length === 0) {
        return { success: true, message: 'Fingerprint is not enrolled on any device.' };
    }

    const fullName = `${employee.firstName} ${employee.lastName}`;
    const fingerLabel = FINGER_MAP[fingerIndex] || `Finger ${fingerIndex + 1}`;
    console.log(`[GlobalDelete] Wiping ${fingerLabel} for ${fullName} across ${enrollments.length} device(s)...`);

    const { enqueueGlobalDeleteFinger, processDeviceSyncQueue } = require('../deviceSyncQueue.service');

    await enqueueGlobalDeleteFinger(employee.id, employee.zkId, fingerIndex, fingerLabel);

    // Immediate processing for active devices.
    setImmediate(async () => {
        for (const enr of enrollments) {
            if (enr.device.isActive) {
                try {
                    await processDeviceSyncQueue(enr.device.id);
                } catch (err) {
                    console.error(`[GlobalDelete] Immediate queue processing failed for device ${enr.device.name}`);
                }
            }
        }
    });

    return { 
        success: true, 
        message: `${fingerLabel} deletion queued for all devices.` 
    };
};

export const enrollEmployeeFingerprint = async (
    employeeId: number,
    fingerIndex: number = 5,
    deviceId?: number
): Promise<SyncResult> => {
    console.log(`[Enrollment] Starting for employee ${employeeId}, finger ${fingerIndex}, device ${deviceId ?? 'auto'}...`);

    // 1. Load employee from DB
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, zkId: true, firstName: true, lastName: true, cardNumber: true, employmentStatus: true },
    });

    if (!employee) {
        return { success: false, message: `Employee ${employeeId} not found in database.` };
    }

    let currentZkId = employee.zkId;
    if (!currentZkId) {
        console.log(`[Enrollment] Assigning new zkId for STAGED employee ${employeeId}...`);
        const { acquireRegistrationMutex } = require('./zk-lock.service');
        const { findNextSafeZkId } = require('./zk-user.service');
        const release = await acquireRegistrationMutex();
        try {
            const safeResult = await findNextSafeZkId();
            currentZkId = safeResult.zkId;
            await prisma.employee.update({
                where: { id: employeeId },
                data: { zkId: currentZkId }
            });
        } finally {
            release();
        }
    }

    if (!currentZkId) {
        return { success: false, message: 'Failed to assign zkId for enrollment.' };
    }

    // 2. Resolve which device to use
    let dbDevice;

    if (deviceId) {
        // Use specific device.
        dbDevice = await prisma.device.findUnique({ where: { id: deviceId } });
        if (!dbDevice) {
            return { success: false, message: `Device ${deviceId} not found in database.` };
        }
    } else {
        // Use first active device.
        dbDevice = await prisma.device.findFirst({
            where: { isActive: true },
            orderBy: { id: 'asc' },
        });
        if (!dbDevice) {
            return { success: false, message: 'No active devices configured.' };
        }
    }

    // Refuse enrollment if device is offline.
    if (!dbDevice.isActive) {
        return {
            success: false,
            message: `Device "${dbDevice.name}" is currently offline. Please wait for it to come back online before enrolling.`,
        };
    }

    const fullName = `${employee.firstName} ${employee.lastName}`;
    const visibleId = currentZkId.toString();
    const deviceUid = currentZkId;

    const route = await getDeviceRoute(dbDevice.id);
    let zk: any = null;

    try {
        let deviceUsers: any[] = [];
        const isAgent = route.mode === 'agent';

        if (isAgent) {
            console.log(`[Enrollment] Fetching users from "${dbDevice.name}" via Agent...`);
            const result = await sendAgentCommand(route.branchId, {
                action: 'GET_USERS',
                deviceIp: dbDevice.ip,
                devicePort: dbDevice.port
            });
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch users via Agent');
            }
            deviceUsers = result.data || [];
        } else {
            await acquireInteractiveDeviceLock(dbDevice.id);
            zk = getDriver(dbDevice.ip, dbDevice.port);
            console.log(`[Enrollment] Connecting to "${dbDevice.name}" (${dbDevice.ip}:${dbDevice.port})...`);
            await connectWithRetry(zk, 1);
            deviceUsers = await zk.getUsers();
        }

        // Slot occupancy check.
        const slotOccupant = deviceUsers.find((u) => u.uid === deviceUid);
        const userByVisibleId = deviceUsers.find((u) => String(u.userId).trim() === visibleId.trim());

        if (slotOccupant && String(slotOccupant.userId).trim() !== visibleId.trim()) {
            console.warn(`[Enrollment] ⚠ UID conflict: slot UID=${deviceUid} is occupied by userId="${slotOccupant.userId}" ("${slotOccupant.name}") — refusing enrollment for "${fullName}" (visibleId="${visibleId}").`);
            return {
                success: false,
                message: `Cannot enroll: slot UID=${deviceUid} is already occupied by a different user ("${slotOccupant.name}"). Resolve the UID conflict first.`,
                error: 'uid_conflict'
            };
        }

        if (slotOccupant && String(slotOccupant.userId).trim() === visibleId.trim()) {
            console.log(`[Enrollment] User already at correct slot UID=${deviceUid}. Proceeding to enroll.`);
        } else if (!userByVisibleId) {
            console.log(`[Enrollment] User not found on device — force-clearing slot UID=${deviceUid} and adding (visibleId="${visibleId}")...`);
            if (isAgent) {
                try {
                    await sendAgentCommand(route.branchId, {
                        action: 'DELETE_USER',
                        deviceIp: dbDevice.ip,
                        devicePort: dbDevice.port,
                        zkId: deviceUid
                    });
                } catch { /* empty */ }
                await sendAgentCommand(route.branchId, {
                    action: 'UPSERT_USER',
                    deviceIp: dbDevice.ip,
                    devicePort: dbDevice.port,
                    zkId: deviceUid,
                    name: fullName,
                    card: employee.cardNumber ?? 0,
                    role: 0
                });
            } else {
                try { await zk.deleteUser(deviceUid); } catch { /* slot empty — ok */ }
                await zk.clearUserFingerprints(deviceUid);
                await zk.setUser(deviceUid, fullName, '', 0, employee.cardNumber ?? 0, visibleId);
                await zk.refreshData();
            }
            console.log(`[Enrollment] User written to UID=${deviceUid}.`);
        } else if (userByVisibleId.uid !== deviceUid) {
            console.warn(`[Enrollment] ⚠ User found at wrong UID=${userByVisibleId.uid} — re-writing to correct slot UID=${deviceUid}.`);
            if (isAgent) {
                try {
                    await sendAgentCommand(route.branchId, {
                        action: 'DELETE_USER',
                        deviceIp: dbDevice.ip,
                        devicePort: dbDevice.port,
                        zkId: deviceUid
                    });
                } catch { /* slot may be empty */ }
                await sendAgentCommand(route.branchId, {
                    action: 'UPSERT_USER',
                    deviceIp: dbDevice.ip,
                    devicePort: dbDevice.port,
                    zkId: deviceUid,
                    name: fullName,
                    card: employee.cardNumber ?? 0,
                    role: 0
                });
            } else {
                try { await zk.deleteUser(deviceUid); } catch { /* slot may be empty */ }
                await zk.clearUserFingerprints(deviceUid);
                await zk.setUser(deviceUid, fullName, '', 0, employee.cardNumber ?? 0, visibleId);
                await zk.refreshData();
            }
            console.log(`[Enrollment] User re-written to UID=${deviceUid}.`);
        } else {
            console.log(`[Enrollment] User already at correct slot UID=${deviceUid}. Proceeding to enroll.`);
        }

        // 4. Send enrollment command
        const fingerName = FINGER_MAP[fingerIndex] || `Finger ${fingerIndex}`;
        console.log(`[Enrollment] Sending CMD_STARTENROLL for "${fullName}" (${fingerName}) on "${dbDevice.name}"...`);
        
        if (isAgent) {
            const startRes = await sendAgentCommand(route.branchId, {
                action: 'START_ENROLLMENT',
                deviceIp: dbDevice.ip,
                devicePort: dbDevice.port,
                zkId: visibleId,
                fingerIndex
            });
            if (!startRes.success) {
                throw new Error(startRes.error || 'Failed to start enrollment on Agent');
            }
        } else {
            await zk.startEnrollment(visibleId, fingerIndex);
        }

        // Extract template in background.
        extractAndDistributeTemplate(dbDevice.id, employee.id, fingerIndex).catch((err: unknown) => {
            console.error('[BiometricSync] Background task error:', err);
        });

        // Record enrollment in DB.
        await prisma.employeeDeviceEnrollment.upsert({
            where: {
                employeeId_deviceId: {
                    employeeId: employee.id,
                    deviceId: dbDevice.id,
                },
            },
            update: {
                enrolledAt: new Date(),
            },
            create: {
                employeeId: employee.id,
                deviceId: dbDevice.id,
            },
        });

        // Record fingerprint metadata.
        const fingerLabel = FINGER_MAP[fingerIndex] || `Finger ${fingerIndex}`;
        await prisma.employeeFingerprintEnrollment.upsert({
            where: {
                employeeId_deviceId_fingerIndex: {
                    employeeId: employee.id,
                    deviceId: dbDevice.id,
                    fingerIndex,
                },
            },
            update: { enrolledAt: new Date() },
            create: {
                employeeId: employee.id,
                deviceId: dbDevice.id,
                fingerIndex,
                fingerLabel,
            },
        });

        console.log(`[Enrollment] ✓ Enrollment recorded in DB for employee ${employeeId} (${fingerLabel}) on device "${dbDevice.name}".`);

        return {
            success: true,
            message: `Enrollment started for ${fullName} on device "${dbDevice.name}". Please scan finger now.`,
        };

    } catch (error: unknown) {
        console.error(`[Enrollment] Error:`, error);
        return {
            success: false,
            message: 'Enrollment failed',
            error: zkErrMsg(error),
        };
    } finally {
        if (zk) {
            try { await zk.disconnect(); } catch { /* ignore */ }
            releaseDeviceLock(dbDevice.id);
        }
    }
};

export const propagateFingerprintToAllDevices = async (
    employeeId: number,
    sourceDeviceId: number,
    fingerIndex?: number
): Promise<{ success: boolean; pushed: number; errors: string[] }> => {

    // 1. Validate inputs
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { zkId: true, firstName: true, lastName: true }
    });

    if (!employee?.zkId) {
        return { success: false, pushed: 0,
            errors: ['Employee not found or has no zkId'] };
    }

    const sourceDevice = await prisma.device.findUnique({
        where: { id: sourceDeviceId }
    });

    if (!sourceDevice) {
        return { success: false, pushed: 0,
            errors: ['Source device not found'] };
    }

    // 1. Find all other active, sync-enabled devices.
    const allTargetDevices = await prisma.device.findMany({
        where: { isActive: true, syncEnabled: true, id: { not: sourceDeviceId } }
    });

    const excludedIds = await getExcludedDeviceIds(employeeId, 'FINGERPRINT');
    const targetDevices = allTargetDevices.filter(d => !excludedIds.has(d.id));

    if (targetDevices.length === 0) {
        console.log('[Propagate] No other active devices — nothing to propagate.');
        return { success: true, pushed: 0, errors: [] };
    }

    const fullName = `${employee.firstName} ${employee.lastName}`;

    // 2. Read templates from source device or cloud DB.
    let templates: { finger: number; data: Buffer }[] = [];

    // Query cloud DB first
    const cloudTemplates = await prisma.fingerprintTemplate.findMany({
        where: { employeeId, fingerIndex }
    });

    if (cloudTemplates.length > 0) {
        templates = cloudTemplates.map(t => ({
            finger: t.fingerIndex,
            data: Buffer.from(t.templateData)
        }));
        console.log(`[Propagate] Read ${templates.length} template(s) from Cloud DB for employeeId ${employeeId}.`);
    } else {
        // Fallback: Read templates from source device
        await acquireInteractiveDeviceLock(sourceDeviceId);
        const srcZk = getDriver(sourceDevice.ip, sourceDevice.port);

        try {
            await connectWithRetry(srcZk, 2);
            templates = await srcZk.readAllFingerprintTemplates(employee.zkId);

            if (fingerIndex !== undefined) {
                templates = templates.filter(t => t.finger === fingerIndex);
            }

            console.log(
                `[Propagate] Read ${templates.length} template(s) from`,
                `"${sourceDevice.name}" for ${fullName} (zkId: ${employee.zkId}).`,
                templates.map(t => `slot${t.finger}=${t.data.length}B`).join(', ')
            );

            // Persist read templates to cloud DB for future use
            for (const { finger, data } of templates) {
                await prisma.fingerprintTemplate.upsert({
                    where: { employeeId_fingerIndex: { employeeId, fingerIndex: finger } },
                    update: { templateData: data as any, updatedAt: new Date() },
                    create: { employeeId, fingerIndex: finger, templateData: data as any }
                });
            }
        } catch (err: unknown) {
            return { success: false, pushed: 0,
                errors: [`Failed to read from source: ${zkErrMsg(err)}`] };
        } finally {
            try { await srcZk.disconnect(); } catch { /* ignore */ }
            releaseDeviceLock(sourceDeviceId);
        }
    }

    // Guard: ensure templates were read successfully.
    if (templates.length === 0) {
        return { success: false, pushed: 0,
            errors: ['No templates on source device or database — enrollment may not be complete yet'] };
    }

    // 3. Write templates to each target device sequentially.
    let pushed = 0;
    const errors: string[] = [];

    for (const targetDevice of targetDevices) {
        const route = await getDeviceRoute(targetDevice.id);

        if (route.mode === 'agent') {
            try {
                // Ensure user record exists
                await sendAgentCommand(route.branchId, {
                    action: 'UPSERT_USER',
                    deviceIp: targetDevice.ip,
                    devicePort: targetDevice.port,
                    zkId: employee.zkId,
                    name: fullName,
                    card: 0,
                    role: 0
                });

                for (const { finger, data } of templates) {
                    console.log(`[Propagate] Writing slot ${finger} to "${targetDevice.name}" via Agent...`);
                    const res = await sendAgentCommand(route.branchId, {
                        action: 'WRITE_FINGERPRINT',
                        deviceIp: targetDevice.ip,
                        devicePort: targetDevice.port,
                        zkId: employee.zkId,
                        fingerIndex: finger,
                        templateData: data
                    });
                    if (!res.success) {
                        console.error(`[Propagate] Failed to write slot ${finger} on "${targetDevice.name}" via Agent:`, res.error);
                    }
                }

                pushed++;

                // Record device enrollment in DB.
                await prisma.employeeDeviceEnrollment.upsert({
                    where: {
                        employeeId_deviceId: {
                            employeeId, deviceId: targetDevice.id
                        }
                    },
                    update: { enrolledAt: new Date() },
                    create: { employeeId, deviceId: targetDevice.id }
                });

                // Record fingerprint metadata.
                for (const { finger } of templates) {
                    const fingerLabel = FINGER_MAP[finger] || `Finger ${finger}`;
                    await prisma.employeeFingerprintEnrollment.upsert({
                        where: {
                            employeeId_deviceId_fingerIndex: {
                                employeeId,
                                deviceId: targetDevice.id,
                                fingerIndex: finger,
                            },
                        },
                        update: { enrolledAt: new Date() },
                        create: {
                            employeeId,
                            deviceId: targetDevice.id,
                            fingerIndex: finger,
                            fingerLabel,
                        },
                    });
                }
            } catch (err: any) {
                console.error(`[Propagate] Agent write failed for "${targetDevice.name}":`, err);
                errors.push(`Agent write failed for "${targetDevice.name}": ${err.message || String(err)}`);
            }
        } else {
            await acquireInteractiveDeviceLock(targetDevice.id);
            const tgtZk = getDriver(targetDevice.ip, targetDevice.port);

            try {
                await connectWithRetry(tgtZk, 2);

                // Ensure user record exists.
                const deviceUsers = await tgtZk.getUsers();
                const exists = deviceUsers.find(
                    (u) => String(u.userId).trim() === String(employee.zkId)
                );

                if (!exists) {
                    await tgtZk.setUser(employee.zkId, fullName, '', 0, 0,
                        String(employee.zkId));
                    await tgtZk.refreshData();
                }

                for (const { finger, data } of templates) {
                    // Write to empty slots only to prevent degradation.
                    const existing = await tgtZk.getFingerTemplate(employee.zkId, finger);
                    if (existing && existing.length > 0) {
                        existing.fill(0); // zero the read buffer
                        continue;
                    }

                    await tgtZk.setFingerTemplate(
                        employee.zkId, finger, data
                    );
                }

                await tgtZk.refreshData();
                pushed++;

                // Record device enrollment in DB.
                await prisma.employeeDeviceEnrollment.upsert({
                    where: {
                        employeeId_deviceId: {
                            employeeId, deviceId: targetDevice.id
                        }
                    },
                    update: { enrolledAt: new Date() },
                    create: { employeeId, deviceId: targetDevice.id }
                });

                // Record fingerprint metadata.
                for (const { finger } of templates) {
                    const fingerLabel = FINGER_MAP[finger] || `Finger ${finger}`;
                    await prisma.employeeFingerprintEnrollment.upsert({
                        where: {
                            employeeId_deviceId_fingerIndex: {
                                employeeId,
                                deviceId: targetDevice.id,
                                fingerIndex: finger,
                            },
                        },
                        update: { enrolledAt: new Date() },
                        create: {
                            employeeId,
                            deviceId: targetDevice.id,
                            fingerIndex: finger,
                            fingerLabel,
                        },
                    });
                }
            } catch (err: unknown) {
                errors.push(`Failed to write to "${targetDevice.name}": ${zkErrMsg(err)}`);
            } finally {
                try { await tgtZk.disconnect(); } catch { /* ignore */ }
                releaseDeviceLock(targetDevice.id);
            }
        }
    }

    // 4. Zero template buffers for security.
    for (const tmpl of templates) {
        tmpl.data.fill(0);
    }
    templates.length = 0;

    return { success: errors.length === 0, pushed, errors };
};

export const deleteFingerprintFromDevice = async (
    employeeId: number,
    fingerIndex: number,
    deviceId: number
): Promise<{ success: boolean; message: string }> => {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, zkId: true, firstName: true, lastName: true },
    });

    if (!employee?.zkId) {
        return { success: false, message: 'Employee not found or has no zkId' };
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
        return { success: false, message: 'Device not found' };
    }

    if (!device.isActive) {
        return { success: false, message: `Device "${device.name}" is offline` };
    }

    const fullName = `${employee.firstName} ${employee.lastName}`;
    const fingerLabel = `Finger ${fingerIndex + 1}`;

    const route = await getDeviceRoute(deviceId);
    let zk: any = null;

    try {
        const isAgent = route.mode === 'agent';
        console.log(`[DeleteFinger] Deleting ${fingerLabel} for ${fullName} from "${device.name}" (mode: ${route.mode})...`);

        if (isAgent) {
            const res = await sendAgentCommand(route.branchId, {
                action: 'DELETE_FINGER',
                deviceIp: device.ip,
                devicePort: device.port,
                zkId: employee.zkId,
                fingerIndex
            });
            if (!res.success) {
                throw new Error(res.error || 'Failed to delete fingerprint via Agent');
            }
        } else {
            await acquireInteractiveDeviceLock(deviceId);
            zk = getDriver(device.ip, device.port);
            await connectWithRetry(zk, 1);

            // Step 1: Delete only the specific finger index
            await zk.deleteFingerTemplate(employee.zkId, fingerIndex);
            await zk.refreshData();

            // Step 2: Verify the target slot is actually empty
            const verifyTemplate = await zk.getFingerTemplate(employee.zkId, fingerIndex);
            if (verifyTemplate !== null) {
                console.warn(`[DeleteFinger] ⚠ Verification failed — template still present in slot ${fingerIndex} on "${device.name}". Retrying clear...`);
                try {
                    await zk.deleteFingerTemplate(employee.zkId, fingerIndex);
                    await zk.refreshData();
                } catch { /* best effort retry */ }
                verifyTemplate.fill(0);
            }
        }

        console.log(`[DeleteFinger] ✓ Deleted ${fingerLabel} for ${fullName} from "${device.name}".`);

        // Step 7: Remove fingerprint enrollment metadata from DB
        await prisma.employeeFingerprintEnrollment.deleteMany({
            where: { employeeId, deviceId, fingerIndex },
        });

        // Step 8: If no fingerprints remain on this device, remove the device-level enrollment
        const remaining = await prisma.employeeFingerprintEnrollment.count({
            where: { employeeId, deviceId },
        });

        if (remaining === 0) {
            await prisma.employeeDeviceEnrollment.deleteMany({
                where: { employeeId, deviceId },
            });
            console.log(`[DeleteFinger] No fingerprints remain on "${device.name}" — device enrollment record removed.`);
        }

        return { success: true, message: `${fingerLabel} deleted from "${device.name}"` };

    } catch (error: unknown) {
        console.error(`[DeleteFinger] Error:`, error);
        return { success: false, message: `Failed to delete fingerprint: ${zkErrMsg(error)}` };
    } finally {
        if (zk) {
            try { await zk.disconnect(); } catch { /* ignore */ }
            releaseDeviceLock(deviceId);
        }
    }
};

export const syncEmployeeFingerprints = async (
    employeeId: number,
    targetDeviceId?: number
): Promise<{
    success: boolean;
    message: string;
    type?: 'success' | 'warning' | 'error';
    totalPushed?: number;
    totalFailed?: number;
    results: Array<{ deviceId: number; deviceName: string; status: 'synced' | 'skipped' | 'failed' | 'offline'; error?: string }>;
}> => {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, zkId: true, firstName: true, lastName: true },
    });

    if (!employee?.zkId) {
        return { success: false, message: 'Employee not found or has no zkId', results: [] };
    }

    const fullName = `${employee.firstName} ${employee.lastName}`;

    // ── STEP 1: DB-driven gap analysis ─────────────────────────────────────
    const rawDevices = await prisma.device.findMany({
        where: { isActive: true, syncEnabled: true },
        orderBy: { id: 'asc' },
    });

    const excludedIds = await getExcludedDeviceIds(employeeId, 'FINGERPRINT');
    let allDevices = rawDevices.filter(d => !excludedIds.has(d.id));

    if (targetDeviceId) {
        allDevices = allDevices.filter(d => d.id === targetDeviceId);
    }

    if (allDevices.length === 0) {
        return { success: false, message: 'No active/eligible devices configured for sync', results: [] };
    }

    const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
        where: { employeeId },
        include: { device: { select: { id: true, name: true, isActive: true, syncEnabled: true, ip: true, port: true } } },
    });

    if (enrollments.length === 0) {
        return {
            success: false,
            message: `${fullName} has no fingerprint enrollments on any device. Enroll first.`,
            results: allDevices.map(d => ({ deviceId: d.id, deviceName: d.name, status: 'skipped' as const })),
        };
    }

    // Build map: fingerIndex → list of deviceIds that have it (sources)
    const fingerToSources = new Map<number, number[]>();
    for (const enrollment of enrollments) {
        if (!enrollment.device.isActive || !enrollment.device.syncEnabled) continue;
        if (!fingerToSources.has(enrollment.fingerIndex)) {
            fingerToSources.set(enrollment.fingerIndex, []);
        }
        fingerToSources.get(enrollment.fingerIndex)!.push(enrollment.deviceId);
    }

    const allFingerIndices = Array.from(fingerToSources.keys()).sort((a, b) => a - b);
    console.log(
        `[SyncFingers] ${fullName}: ${allFingerIndices.length} distinct finger(s) ` +
        `[${allFingerIndices.join(', ')}] enrolled in DB.`
    );

    // ── STEP 2: Enumerate finger slots ───────────────────────────────────
    const results: Array<{ 
        deviceId: number; 
        deviceName: string; 
        status: 'synced' | 'skipped' | 'failed' | 'offline'; 
        error?: string;
        pushed?: number;
        failed?: number;
    }> = [];

    for (const targetDevice of allDevices) {
        const route = await getDeviceRoute(targetDevice.id);
        let tgtZk: any = null;
        let pushed = 0;
        const slotErrors: string[] = [];

        try {
            // Determine enrolled fingers in DB for target
            const enrolledOnTarget = new Set(
                enrollments
                    .filter(e => e.deviceId === targetDevice.id)
                    .map(e => e.fingerIndex)
            );

            const missingFingers: number[] = [];

            if (route.mode === 'agent') {
                // Ensure user record is written to target
                await sendAgentCommand(route.branchId, {
                    action: 'UPSERT_USER',
                    deviceIp: targetDevice.ip,
                    devicePort: targetDevice.port,
                    zkId: employee.zkId,
                    name: fullName,
                    card: 0,
                    role: 0
                });

                // Trust DB state for agents to save connection latency
                for (const fi of allFingerIndices) {
                    const dbHasRecord = enrolledOnTarget.has(fi);
                    if (!dbHasRecord) {
                        missingFingers.push(fi);
                    }
                }
            } else {
                await acquireInteractiveDeviceLock(targetDevice.id);
                tgtZk = getDriver(targetDevice.ip, targetDevice.port);
                await connectWithRetry(tgtZk, 1);

                // Ensure user record exists on target
                const deviceUsers = await tgtZk.getUsers();
                const userExists = deviceUsers.find(
                    (u: any) => String(u.userId).trim() === String(employee.zkId)
                );
                if (!userExists) {
                    await tgtZk.setUser(employee.zkId, fullName, '', 0, 0, String(employee.zkId));
                    await tgtZk.refreshData();
                    console.log(`[SyncFingers] Created user record on "${targetDevice.name}".`);
                }

                for (const fi of allFingerIndices) {
                    const dbHasRecord = enrolledOnTarget.has(fi);
                    const deviceHasFinger = await tgtZk.hasFingerTemplate(employee.zkId, fi);
                    
                    if (!deviceHasFinger) {
                        missingFingers.push(fi);
                    } else if (!dbHasRecord) {
                        const fingerLabel = FINGER_MAP[fi] || `Finger ${fi}`;
                        await prisma.employeeFingerprintEnrollment.upsert({
                            where: {
                                employeeId_deviceId_fingerIndex: {
                                    employeeId, deviceId: targetDevice.id, fingerIndex: fi,
                                },
                            },
                            update: { enrolledAt: new Date() },
                            create: { employeeId, deviceId: targetDevice.id, fingerIndex: fi, fingerLabel },
                        });
                    }
                }
            }

            if (missingFingers.length === 0) {
                results.push({ deviceId: targetDevice.id, deviceName: targetDevice.name, status: 'skipped', pushed: 0, failed: 0 });
                console.log(`[SyncFingers] "${targetDevice.name}": all ${allFingerIndices.length} finger(s) already enrolled on device — skipping.`);
                
                // Ensure overall device enrollment record exists in DB
                await prisma.employeeDeviceEnrollment.upsert({
                    where: { employeeId_deviceId: { employeeId, deviceId: targetDevice.id } },
                    update: {},
                    create: { employeeId, deviceId: targetDevice.id },
                });
                continue;
            }

            console.log(
                `[SyncFingers] "${targetDevice.name}": missing finger(s) [${missingFingers.join(', ')}] — syncing.`
            );

            // ── STEP 3: Sync missing templates ──────────────────────────────────
            const retrievedTemplates = new Map<number, Buffer>();
            const remainingFingers = new Set(missingFingers);

            // Check Cloud Database first
            const cloudTemplates = await prisma.fingerprintTemplate.findMany({
                where: { employeeId, fingerIndex: { in: missingFingers } }
            });

            for (const ct of cloudTemplates) {
                retrievedTemplates.set(ct.fingerIndex, Buffer.from(ct.templateData));
                remainingFingers.delete(ct.fingerIndex);
                console.log(`[SyncFingers] Loaded template for finger ${ct.fingerIndex} directly from cloud DB.`);
            }

            const sourceToFingersMap = new Map<number, Set<number>>();
            for (const fingerIndex of remainingFingers) {
                const candidateIds = (fingerToSources.get(fingerIndex) || [])
                    .filter(id => id !== targetDevice.id);
                for (const srcId of candidateIds) {
                    if (!sourceToFingersMap.has(srcId)) {
                        sourceToFingersMap.set(srcId, new Set());
                    }
                    sourceToFingersMap.get(srcId)!.add(fingerIndex);
                }
            }

            while (remainingFingers.size > 0) {
                let bestSourceId: number | null = null;
                let bestFingersToFetch: number[] = [];

                for (const [srcId, fingersSet] of sourceToFingersMap.entries()) {
                    const activeFingers = [...fingersSet].filter(f => remainingFingers.has(f));
                    if (activeFingers.length > bestFingersToFetch.length) {
                        bestFingersToFetch = activeFingers;
                        bestSourceId = srcId;
                    }
                }

                if (!bestSourceId || bestFingersToFetch.length === 0) {
                    break;
                }

                const srcDevice = rawDevices.find(d => d.id === bestSourceId);
                if (srcDevice) {
                    await acquireInteractiveDeviceLock(bestSourceId);
                    const srcZk = getDriver(srcDevice.ip, srcDevice.port);
                    let connected = false;
                    try {
                        await connectWithRetry(srcZk, 1);
                        connected = true;
                        for (const fingerIndex of bestFingersToFetch) {
                            const raw = await srcZk.getFingerTemplate(employee.zkId, fingerIndex);
                            if (raw && raw.length > 0) {
                                const templateData = Buffer.alloc(raw.length);
                                raw.copy(templateData);
                                raw.fill(0);
                                retrievedTemplates.set(fingerIndex, templateData);
                                remainingFingers.delete(fingerIndex);
                                console.log(
                                    `[SyncFingers] Batched read finger ${fingerIndex} (${templateData.length}B) from "${srcDevice.name}".`
                                );

                                // Save to cloud DB
                                await prisma.fingerprintTemplate.upsert({
                                    where: { employeeId_fingerIndex: { employeeId, fingerIndex } },
                                    update: { templateData, updatedAt: new Date() },
                                    create: { employeeId, fingerIndex, templateData }
                                });
                            }
                        }
                    } catch (err: unknown) {
                        console.warn(
                            `[SyncFingers] Failed batched read of fingers [${bestFingersToFetch.join(', ')}] from "${srcDevice.name}": ${zkErrMsg(err)}`
                        );
                        sourceToFingersMap.delete(bestSourceId);
                    } finally {
                        if (connected) {
                            try { await srcZk.disconnect(); } catch { /* ignore */ }
                            await sleep(300);
                        }
                        releaseDeviceLock(bestSourceId);
                    }
                } else {
                    sourceToFingersMap.delete(bestSourceId);
                }
            }

            for (const fingerIndex of missingFingers) {
                const templateData = retrievedTemplates.get(fingerIndex);
                if (!templateData) {
                    slotErrors.push(`Finger ${fingerIndex}: could not extract from any source`);
                    continue;
                }

                let writeSuccess = false;
                let lastWriteError: unknown = null;

                if (route.mode === 'agent') {
                    try {
                        console.log(`[SyncFingers] Writing finger ${fingerIndex} (${templateData.length}B) to "${targetDevice.name}" via Agent...`);
                        const res = await sendAgentCommand(route.branchId, {
                            action: 'WRITE_FINGERPRINT',
                            deviceIp: targetDevice.ip,
                            devicePort: targetDevice.port,
                            zkId: employee.zkId,
                            fingerIndex,
                            templateData
                        });
                        if (res.success) {
                            writeSuccess = true;
                            pushed++;
                        } else {
                            throw new Error(res.error || 'Agent write failed');
                        }
                    } catch (err: any) {
                        lastWriteError = err;
                        console.warn(`[SyncFingers] Agent write failed for finger ${fingerIndex} on "${targetDevice.name}":`, err);
                    }
                } else {
                    let writeAttempts = 3;
                    for (let attempt = 1; attempt <= writeAttempts; attempt++) {
                        try {
                            if (pushed > 0 || attempt > 1) {
                                await sleep(300);
                            }
                            await tgtZk.setFingerTemplate(employee.zkId, fingerIndex, templateData);
                            writeSuccess = true;
                            pushed++;
                            console.log(
                                `[SyncFingers] ✓ Wrote finger ${fingerIndex} (${templateData.length}B) to "${targetDevice.name}" (attempt ${attempt}).`
                            );
                            break;
                        } catch (err: unknown) {
                            lastWriteError = err;
                            console.warn(
                                `[SyncFingers] Write attempt ${attempt} failed for finger ${fingerIndex} on "${targetDevice.name}": ${zkErrMsg(err)}`
                            );
                        }
                    }
                }

                if (writeSuccess) {
                    try {
                        const fingerLabel = FINGER_MAP[fingerIndex] || `Finger ${fingerIndex}`;
                        await prisma.employeeFingerprintEnrollment.upsert({
                            where: {
                                employeeId_deviceId_fingerIndex: {
                                    employeeId, deviceId: targetDevice.id, fingerIndex,
                                },
                            },
                            update: { enrolledAt: new Date() },
                            create: { employeeId, deviceId: targetDevice.id, fingerIndex, fingerLabel },
                        });
                    } catch (dbErr) {
                        console.error(`[SyncFingers] Failed to save enrollment to DB for finger ${fingerIndex}:`, dbErr);
                    }
                } else {
                    slotErrors.push(`Finger ${fingerIndex}: write failed — ${zkErrMsg(lastWriteError)}`);
                }

                templateData.fill(0);
            }

            if (pushed > 0 && route.mode === 'direct' && tgtZk) {
                await tgtZk.refreshData();
            }

            if (slotErrors.length === 0) {
                await prisma.employeeDeviceEnrollment.upsert({
                    where: { employeeId_deviceId: { employeeId, deviceId: targetDevice.id } },
                    update: { enrolledAt: new Date() },
                    create: { employeeId, deviceId: targetDevice.id },
                });
            } else {
                await prisma.employeeDeviceEnrollment.deleteMany({
                    where: { employeeId, deviceId: targetDevice.id },
                });
            }

            const status = pushed > 0 
                ? (slotErrors.length > 0 ? 'failed' as const : 'synced' as const)
                : 'skipped' as const;
            const errorMsg = slotErrors.length > 0 ? slotErrors.join('; ') : undefined;
            results.push({ 
                deviceId: targetDevice.id, 
                deviceName: targetDevice.name, 
                status, 
                error: errorMsg,
                pushed,
                failed: slotErrors.length
            });
            console.log(
                `[SyncFingers] "${targetDevice.name}": wrote ${pushed}/${missingFingers.length} finger(s).` +
                (slotErrors.length > 0 ? ` Errors: ${slotErrors.join('; ')}` : '')
            );

        } catch (err: unknown) {
            const errMsg = zkErrMsg(err);
            results.push({ 
                deviceId: targetDevice.id, 
                deviceName: targetDevice.name, 
                status: 'failed', 
                error: errMsg,
                pushed: 0,
                failed: allFingerIndices.length 
            });
            console.error(`[SyncFingers] ✗ Failed on "${targetDevice.name}": ${errMsg}`);
        } finally {
            if (tgtZk) {
                try { await tgtZk.disconnect(); } catch { /* ignore */ }
            }
            if (route.mode === 'direct') {
                releaseDeviceLock(targetDevice.id);
            }
        }
    }

    const totalPushed = results.reduce((acc, r) => acc + (r.pushed || 0), 0);
    const totalFailed = results.reduce((acc, r) => acc + (r.failed || 0), 0);

    const success = totalFailed === 0 && results.every(r => r.status !== 'failed');
    let message = '';

    if (totalFailed === 0) {
        if (totalPushed > 0) {
            message = `Fingerprint synchronization completed successfully. ${totalPushed} fingerprint template(s) synchronized.`;
        } else {
            message = `Fingerprints are already fully synchronized on target device(s).`;
        }
    } else {
        if (totalPushed > 0) {
            message = `${totalPushed} fingerprint(s) synchronized successfully. ${totalFailed} fingerprint(s) failed to synchronize.`;
        } else {
            const firstError = results.find(r => r.error)?.error;
            message = `Fingerprint synchronization failed. ${firstError || 'Device connection timeout.'}`;
        }
    }

    return {
        success,
        message,
        type: totalFailed === 0 ? 'success' : (totalPushed > 0 ? 'warning' : 'error'),
        totalPushed,
        totalFailed,
        results: results.map(r => ({
            deviceId: r.deviceId,
            deviceName: r.deviceName,
            status: r.status,
            error: r.error
        })),
    };
};







async function extractAndDistributeTemplate(deviceId: number, employeeId: number, fingerIndex: number) {	
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });	
    const dbDevice = await prisma.device.findUnique({ where: { id: deviceId } });	
    	
    if (!employee || !employee.zkId || !dbDevice) return;	
	
    const deviceUid = employee.zkId;	
    let found = false;	
	
    console.log(`[BiometricSync] Waiting for user to scan finger... started polling device "${dbDevice.name}".`);	
	
    const route = await getDeviceRoute(dbDevice.id);
    const isAgent = route.mode === 'agent';

    // Poll 15 times (60s) for enrollment completion.	
    for (let attempts = 0; attempts < 15; attempts++) {	
        await new Promise(r => setTimeout(r, 4000)); // wait 4 seconds	
        
        let zk: any = null;
        try {
            let template: Buffer | null = null;

            if (isAgent) {
                const res = await sendAgentCommand(route.branchId, {
                    action: 'READ_FINGERPRINT',
                    deviceIp: dbDevice.ip,
                    devicePort: dbDevice.port,
                    zkId: deviceUid,
                    fingerIndex
                });
                if (res.success && res.data) {
                    template = Buffer.from(res.data);
                }
            } else {
                await acquireDeviceLock(dbDevice.id);	
                zk = getDriver(dbDevice.ip, dbDevice.port);	
                await connectWithRetry(zk, 0);	
                template = await zk.getFingerTemplate(deviceUid, fingerIndex);
            }

            if (template && template.length > 8) {	
                found = true;	
                console.log(	
                    `[BiometricSync] ✓ Detected template for ${employee.firstName}`,	
                    `on "${dbDevice.name}" — slot ${fingerIndex}, ${template.length} bytes.`,	
                    `(attempt ${attempts + 1}/15)`	
                );	
            }	
        } catch (e) {	
            // ignore — device may still be processing enrollment	
        } finally {	
            if (zk) {
                try { await zk.disconnect(); } catch {}	
                releaseDeviceLock(dbDevice.id);	
            }
        }	
	
        if (found) break;	
    }	
	
    if (!found) {	
        console.warn(`[BiometricSync] ⚠ Failed to detect template for ${employee.firstName} from ${dbDevice.name} after 60s. User may have aborted enrollment.`);	
        return;	
    }	

    if (employee.employmentStatus === 'STAGED') {
        const { generateRandomPassword } = require('../../../shared/utils/password.utils');
        const { sendWelcomeEmail } = require('../../../shared/lib/email.service');
        const bcrypt = require('bcrypt');

        if (employee.email && employee.email.trim() !== '') {
            const newPassword = generateRandomPassword(10);
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            console.log(`[BiometricSync] Promoting employee ${employeeId} from STAGED to ACTIVE (with email).`);
            await prisma.employee.update({
                where: { id: employeeId },
                data: { employmentStatus: 'ACTIVE', password: hashedPassword, updatedAt: new Date() }
            });

            setImmediate(async () => {
                try {
                    await sendWelcomeEmail(employee.email!, `${employee.firstName} ${employee.lastName}`, newPassword);
                } catch (emailErr) {
                    console.error(`[BiometricSync] Failed to send welcome email to ${employee.email}`, emailErr);
                }
            });
        } else {
            console.log(`[BiometricSync] Promoting employee ${employeeId} from STAGED to ACTIVE (no email - keeping default password).`);
            await prisma.employee.update({
                where: { id: employeeId },
                data: { employmentStatus: 'ACTIVE', updatedAt: new Date() }
            });
        }
    }	
	
	
    // Distribute via DB-driven propagation.	
    console.log(`[BiometricSync] Starting in-memory propagation for ${employee.firstName}...`);	
	
    const result = await syncEmployeeFingerprints(employeeId);	
	
    if (result.success) {	
        const synced = result.results.filter(r => r.status === 'synced').length;	
        console.log(	
            `[BiometricSync] ✓ Propagation complete:`,	
            `${synced} device(s) updated.`	
        );	
    } else {	
        const errors = result.results.filter(r => r.error).map(r => `${r.deviceName}: ${r.error}`);	
        console.warn(	
            `[BiometricSync] ⚠ Propagation partial or failed:`,	
            errors.length > 0 ? errors.join('; ') : result.message	
        );	
    }	
}	