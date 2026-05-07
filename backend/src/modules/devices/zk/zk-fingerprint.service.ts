import { prisma } from '../../../shared/lib/prisma';
import { ZKDriver } from '../../../shared/lib/zk-driver';
import { getDriver, connectWithRetry, zkErrMsg } from './zk-connection.service';
import { acquireDeviceLock, releaseDeviceLock, acquireInteractiveDeviceLock } from './zk-lock.service';
import { getExcludedDeviceIds } from '../biometric-exclusion.service';

const FINGER_MAP: { [key: number]: string } = { 5: 'Right Thumb', 6: 'Right Index', 7: 'Right Middle', 8: 'Right Ring', 9: 'Right Little', 4: 'Left Thumb', 3: 'Left Index', 2: 'Left Middle', 1: 'Left Ring', 0: 'Left Little' };
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
            currentZkId = await findNextSafeZkId();
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

    // Acquire interactive device lock for priority handling.
    await acquireInteractiveDeviceLock(dbDevice.id);
    const zk = getDriver(dbDevice.ip, dbDevice.port);


    try {
        console.log(`[Enrollment] Connecting to "${dbDevice.name}" (${dbDevice.ip}:${dbDevice.port})...`);
        // Connect with 1 retry for interactive flow.
        await connectWithRetry(zk, 1);

        const deviceUsers = await zk.getUsers();
        // Slot occupancy check.
        const slotOccupant = deviceUsers.find((u) => u.uid === deviceUid);
        const userByVisibleId = deviceUsers.find((u) => String(u.userId).trim() === visibleId.trim());

        if (slotOccupant && String(slotOccupant.userId).trim() !== visibleId.trim()) {
            // Guard 1: A DIFFERENT person occupies the target slot — refuse immediately.
            console.warn(`[Enrollment] ⚠ UID conflict: slot UID=${deviceUid} is occupied by userId="${slotOccupant.userId}" ("${slotOccupant.name}") — refusing enrollment for "${fullName}" (visibleId="${visibleId}").`);
            return {
                success: false,
                message: `Cannot enroll: slot UID=${deviceUid} is already occupied by a different user ("${slotOccupant.name}"). Resolve the UID conflict first.`,
                error: 'uid_conflict'
            };
        }

        if (slotOccupant && String(slotOccupant.userId).trim() === visibleId.trim()) {
            // Guard 2 (short-circuit): The correct user is already in the correct slot.
            // Do NOT fall through to userByVisibleId — that Array.find() could return a
            // ghost user with the same userId at a different uid, triggering a false rewrite.
            console.log(`[Enrollment] User already at correct slot UID=${deviceUid}. Proceeding to enroll.`);
        } else if (!userByVisibleId) {
            // Slot is empty and no other record claims this visibleId — safe to write fresh.
            console.log(`[Enrollment] User not found on device — force-clearing slot UID=${deviceUid} and adding (visibleId="${visibleId}")...`);
            try { await zk.deleteUser(deviceUid); } catch { /* slot empty — ok */ }
            await zk.clearUserFingerprints(deviceUid);
            await zk.setUser(deviceUid, fullName, '', 0, employee.cardNumber ?? 0, visibleId);
            await zk.refreshData();
            console.log(`[Enrollment] User written to UID=${deviceUid}.`);
        } else if (userByVisibleId.uid !== deviceUid) {
            // User exists at the wrong UID (target slot is confirmed empty from Guard 1 pass).
            console.warn(`[Enrollment] ⚠ User found at wrong UID=${userByVisibleId.uid} — re-writing to correct slot UID=${deviceUid}.`);
            try { await zk.deleteUser(deviceUid); } catch { /* slot may be empty */ }
            await zk.clearUserFingerprints(deviceUid);
            await zk.setUser(deviceUid, fullName, '', 0, employee.cardNumber ?? 0, visibleId);
            await zk.refreshData();
            console.log(`[Enrollment] User re-written to UID=${deviceUid}.`);
        } else {
            console.log(`[Enrollment] User already at correct slot UID=${deviceUid}. Proceeding to enroll.`);
        }

        // 4. Send enrollment command
        const fingerName = FINGER_MAP[fingerIndex] || `Finger ${fingerIndex}`;
        console.log(`[Enrollment] Sending CMD_STARTENROLL for "${fullName}" (${fingerName}) on "${dbDevice.name}"...`);
        await zk.startEnrollment(visibleId, fingerIndex);

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
        try { await zk.disconnect(); } catch { /* ignore */ }
        releaseDeviceLock(dbDevice.id);
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

    // 2. Read templates from source device.
    await acquireInteractiveDeviceLock(sourceDeviceId);
    let templates: { finger: number; data: Buffer }[] = [];
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
    } catch (err: unknown) {
        return { success: false, pushed: 0,
            errors: [`Failed to read from source: ${zkErrMsg(err)}`] };
    } finally {
        try { await srcZk.disconnect(); } catch { /* ignore */ }
        releaseDeviceLock(sourceDeviceId);
    }

    // Guard: ensure templates were read successfully.
    if (templates.length === 0) {
        return { success: false, pushed: 0,
            errors: ['No templates on source device — enrollment may not be complete yet'] };
    }

    // 3. Write templates to each target device sequentially.
    let pushed = 0;
    const errors: string[] = [];

    for (const targetDevice of targetDevices) {
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
                console.log(
                    `[Propagate] User record written to "${targetDevice.name}"`,
                    'before template push.'
                );
            }

            for (const { finger, data } of templates) {
                // Write to empty slots only to prevent degradation.
                const existing = await tgtZk.getFingerTemplate(employee.zkId, finger);
                if (existing && existing.length > 0) {
                    console.log(
                        `[Propagate] Slot ${finger} already has ${existing.length}B on`,
                        `"${targetDevice.name}" — skipping to prevent degradation.`
                    );
                    existing.fill(0); // zero the read buffer
                    continue;
                }

                console.log(
                    `[Propagate] Writing slot ${finger} (${data.length} bytes)`,
                    `to "${targetDevice.name}" for UID=${employee.zkId}...`
                );
                await tgtZk.setFingerTemplate(
                    employee.zkId, finger, data
                );
            }

            await tgtZk.refreshData();

            // Verification: read back finger count to confirm template was committed
            try {
                const verifyCount = await tgtZk.getFingerCount(employee.zkId);
                console.log(
                    `[Propagate] ✓ ${templates.length} template(s) written`,
                    `to "${targetDevice.name}".`,
                    `Verify: device reports ${verifyCount} fingerprint(s) for UID=${employee.zkId}.`
                );
            } catch {
                console.log(
                    `[Propagate] ✓ ${templates.length} template(s) written`,
                    `to "${targetDevice.name}" (verification read-back skipped).`
                );
            }

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

            pushed++;

        } catch (err: unknown) {
            const msg = `"${targetDevice.name}": ${zkErrMsg(err)}`;
            errors.push(msg);
            console.error(`[Propagate] ✗ Failed to write to ${msg}`);
        } finally {
            try { await tgtZk.disconnect(); } catch { /* ignore */ }
            releaseDeviceLock(targetDevice.id);
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

    await acquireInteractiveDeviceLock(deviceId);
    const zk = getDriver(device.ip, device.port);

    try {
        await connectWithRetry(zk, 1);

        console.log(`[DeleteFinger] Deleting ${fingerLabel} for ${fullName} from "${device.name}"...`);

        // Step 1: Delete only the specific finger index
        await zk.deleteFingerTemplate(employee.zkId, fingerIndex);
        await zk.refreshData();

        // Step 2: Verify the target slot is actually empty
        const verifyTemplate = await zk.getFingerTemplate(employee.zkId, fingerIndex);
        if (verifyTemplate !== null) {
            console.warn(`[DeleteFinger] ⚠ Verification failed — template still present in slot ${fingerIndex} on "${device.name}". Retrying clear...`);
            // Retry clear just this specific slot
            try {
                await zk.deleteFingerTemplate(employee.zkId, fingerIndex);
                await zk.refreshData();
            } catch { /* best effort retry */ }
            verifyTemplate.fill(0);
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
        try { await zk.disconnect(); } catch { /* ignore */ }
        releaseDeviceLock(deviceId);
    }
};

export const syncEmployeeFingerprints = async (
    employeeId: number,
    targetDeviceId?: number
): Promise<{
    success: boolean;
    message: string;
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
    const results: Array<{ deviceId: number; deviceName: string; status: 'synced' | 'skipped' | 'failed' | 'offline'; error?: string }> = [];

    for (const targetDevice of allDevices) {
        // Which fingerIndices does this device already have in the DB?
        const enrolledOnTarget = new Set(
            enrollments
                .filter(e => e.deviceId === targetDevice.id)
                .map(e => e.fingerIndex)
        );

        // Which fingerIndices are MISSING on this device?
        const missingFingers = allFingerIndices.filter(fi => !enrolledOnTarget.has(fi));

        if (missingFingers.length === 0) {
            results.push({ deviceId: targetDevice.id, deviceName: targetDevice.name, status: 'skipped' });
            console.log(`[SyncFingers] "${targetDevice.name}": all ${allFingerIndices.length} finger(s) already enrolled — skipping.`);
            continue;
        }

        console.log(
            `[SyncFingers] "${targetDevice.name}": missing finger(s) [${missingFingers.join(', ')}] — syncing.`
        );

        // ── STEP 3: Sync missing templates ──────────────────────────────────
        let pushed = 0;
        const slotErrors: string[] = [];

        await acquireInteractiveDeviceLock(targetDevice.id);
        const tgtZk = getDriver(targetDevice.ip, targetDevice.port);

        try {
            await connectWithRetry(tgtZk, 1);

            // Ensure user record exists on target
            const deviceUsers = await tgtZk.getUsers();
            const userExists = deviceUsers.find(
                (u) => String(u.userId).trim() === String(employee.zkId)
            );
            if (!userExists) {
                await tgtZk.setUser(employee.zkId, fullName, '', 0, 0, String(employee.zkId));
                await tgtZk.refreshData();
                console.log(`[SyncFingers] Created user record on "${targetDevice.name}".`);
            }

            for (const fingerIndex of missingFingers) {
                // Find source devices for this fingerIndex (excluding the target itself)
                const candidateIds = (fingerToSources.get(fingerIndex) || [])
                    .filter(id => id !== targetDevice.id);

                if (candidateIds.length === 0) {
                    slotErrors.push(`Finger ${fingerIndex}: no source device`);
                    continue;
                }

                // Try each candidate until we get the template
                let templateData: Buffer | null = null;
                for (const srcDeviceId of candidateIds) {
                    const srcDevice = allDevices.find(d => d.id === srcDeviceId);
                    if (!srcDevice) continue;

                    await acquireInteractiveDeviceLock(srcDeviceId);
                    const srcZk = getDriver(srcDevice.ip, srcDevice.port);

                    try {
                        await connectWithRetry(srcZk, 1);
                        const raw = await srcZk.getFingerTemplate(employee.zkId, fingerIndex);
                        if (raw && raw.length > 0) {
                            templateData = Buffer.alloc(raw.length);
                            raw.copy(templateData);
                            raw.fill(0);
                            console.log(
                                `[SyncFingers] Read finger ${fingerIndex} (${templateData.length}B) from "${srcDevice.name}".`
                            );
                            break;
                        }
                    } catch (err: unknown) {
                        console.warn(
                            `[SyncFingers] Failed to read finger ${fingerIndex} from "${srcDevice.name}": ${zkErrMsg(err)}`
                        );
                    } finally {
                        try { await srcZk.disconnect(); } catch { /* ignore */ }
                        releaseDeviceLock(srcDeviceId);
                    }
                }

                if (!templateData) {
                    slotErrors.push(`Finger ${fingerIndex}: could not extract from any source`);
                    continue;
                }

                // Push this specific finger to the target
                try {
                    await tgtZk.setFingerTemplate(employee.zkId, fingerIndex, templateData);
                    pushed++;
                    console.log(
                        `[SyncFingers] ✓ Wrote finger ${fingerIndex} (${templateData.length}B) to "${targetDevice.name}".`
                    );

                    // Record in DB
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
                } catch (err: unknown) {
                    slotErrors.push(`Finger ${fingerIndex}: write failed — ${zkErrMsg(err)}`);
                } finally {
                    templateData.fill(0);
                }
            }

            if (pushed > 0) {
                await tgtZk.refreshData();
                await prisma.employeeDeviceEnrollment.upsert({
                    where: { employeeId_deviceId: { employeeId, deviceId: targetDevice.id } },
                    update: { enrolledAt: new Date() },
                    create: { employeeId, deviceId: targetDevice.id },
                });
            }

            const status = pushed > 0 ? 'synced' as const : 'skipped' as const;
            const errorMsg = slotErrors.length > 0 ? slotErrors.join('; ') : undefined;
            results.push({ deviceId: targetDevice.id, deviceName: targetDevice.name, status, error: errorMsg });
            console.log(
                `[SyncFingers] "${targetDevice.name}": wrote ${pushed}/${missingFingers.length} finger(s).` +
                (slotErrors.length > 0 ? ` Errors: ${slotErrors.join('; ')}` : '')
            );

        } catch (err: unknown) {
            const errMsg = zkErrMsg(err);
            results.push({ deviceId: targetDevice.id, deviceName: targetDevice.name, status: 'failed', error: errMsg });
            console.error(`[SyncFingers] ✗ Failed on "${targetDevice.name}": ${errMsg}`);
        } finally {
            try { await tgtZk.disconnect(); } catch { /* ignore */ }
            releaseDeviceLock(targetDevice.id);
        }
    }

    const synced = results.filter(r => r.status === 'synced').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return {
        success: failed === 0,
        message: failed === 0
            ? `Fingerprints synced to ${synced} device(s) for ${fullName}.`
            : `Partial sync: ${synced} succeeded, ${failed} failed for ${fullName}.`,
        results,
    };
};







async function extractAndDistributeTemplate(deviceId: number, employeeId: number, fingerIndex: number) {	
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });	
    const dbDevice = await prisma.device.findUnique({ where: { id: deviceId } });	
    	
    if (!employee || !employee.zkId || !dbDevice) return;	
	
    const deviceUid = employee.zkId;	
    let found = false;	
	
    console.log(`[BiometricSync] Waiting for user to scan finger... started polling device "${dbDevice.name}".`);	
	
    // Poll 15 times (60s) for enrollment completion.	
    for (let attempts = 0; attempts < 15; attempts++) {	
        await new Promise(r => setTimeout(r, 4000)); // wait 4 seconds	
        	
        await acquireDeviceLock(dbDevice.id);	
        const zk = getDriver(dbDevice.ip, dbDevice.port);	
        try {	
            await connectWithRetry(zk, 0);	
            const template = await zk.getFingerTemplate(deviceUid, fingerIndex);	
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
            try { await zk.disconnect(); } catch {}	
            releaseDeviceLock(dbDevice.id);	
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

        const newPassword = generateRandomPassword(10);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        console.log(`[BiometricSync] Promoting employee ${employeeId} from STAGED to ACTIVE.`);
        await prisma.employee.update({
            where: { id: employeeId },
            data: { employmentStatus: 'ACTIVE', password: hashedPassword, updatedAt: new Date() }
        });

        if (employee.email) {
            setImmediate(async () => {
                try {
                    await sendWelcomeEmail(employee.email, `${employee.firstName} ${employee.lastName}`, newPassword);
                } catch (emailErr) {
                    console.error(`[BiometricSync] Failed to send welcome email to ${employee.email}`, emailErr);
                }
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
	
// ─────────────────────────────────────────────────────────────────────────────	
// DEBUG & FORCED SYNC	
// ─────────────────────────────────────────────────────────────────────────────	
// RFID BADGE CARD ENROLLMENT	
// Writes a card number into the user record on ALL active devices, then


