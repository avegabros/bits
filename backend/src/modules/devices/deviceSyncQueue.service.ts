import { prisma } from '../../shared/lib/prisma';
import { 
    getDriver, 
    acquireDeviceLock, 
    releaseDeviceLock, 
    zkErrMsg, 
    connectWithRetry,
    tryAcquireDeviceLock
} from './zk';
import { audit } from '../../shared/lib/auditLogger';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type SyncActionType = 'UPSERT_USER' | 'DELETE_USER' | 'DELETE_FINGER' | 'SYNC_FINGER_FROM_SOURCE';

export interface UpsertUserPayload {
    zkId: number;
    name: string;
    card: number;
    role: number;
}

export interface DeleteUserPayload {
    zkId: number;
}

export interface DeleteFingerPayload {
    zkId: number;
    fingerIndex: number;
}

export interface SyncFingerPayload {
    zkId: number;
    fingerIndex: number;
    employeeId: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enqueue Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pushes or updates a user on the device.
 * Collapses multiple updates for the same user/device into a single pending task.
 */
export async function enqueueUpsertUser(
    deviceId: number,
    payload: UpsertUserPayload
): Promise<void> {
    const entityId = `USER_${payload.zkId}`;
    
    await prisma.deviceSyncTask.upsert({
        where: {
            deviceId_actionType_entityId: {
                deviceId,
                actionType: 'UPSERT_USER',
                entityId
            }
        },
        update: {
            payload: payload as object,
            status: 'PENDING',
            retryCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        create: {
            deviceId,
            actionType: 'UPSERT_USER',
            entityId,
            payload: payload as object,
            status: 'PENDING'
        }
    });

    console.log(`[SyncQueue] Enqueued UPSERT_USER for zkId=${payload.zkId} on device ${deviceId}`);
}

/**
 * Pushes a task to pull a fingerprint from a source device and push it to this target device.
 */
export async function enqueueFingerprintPull(
    targetDeviceId: number,
    payload: SyncFingerPayload
): Promise<void> {
    const entityId = `FINGER_PULL_${payload.zkId}_${payload.fingerIndex}`;
    
    await prisma.deviceSyncTask.upsert({
        where: {
            deviceId_actionType_entityId: {
                deviceId: targetDeviceId,
                actionType: 'SYNC_FINGER_FROM_SOURCE',
                entityId
            }
        },
        update: {
            payload: payload as object,
            status: 'PENDING',
            retryCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        create: {
            deviceId: targetDeviceId,
            actionType: 'SYNC_FINGER_FROM_SOURCE',
            entityId,
            payload: payload as object,
            status: 'PENDING'
        }
    });

    console.log(`[SyncQueue] Enqueued SYNC_FINGER_FROM_SOURCE for zkId=${payload.zkId} finger=${payload.fingerIndex} on device ${targetDeviceId}`);
}

/**
 * Enqueue UPSERT_USER for ALL active devices.
 */
export async function enqueueGlobalUpsertUser(payload: UpsertUserPayload): Promise<void> {
    const devices = await prisma.device.findMany({ where: { syncEnabled: true }, select: { id: true } });
    for (const device of devices) {
        await enqueueUpsertUser(device.id, payload);
    }
}

/**
 * Enqueue deletion of a user from a specific device.
 */
export async function enqueueDeleteUser(
    deviceId: number,
    zkId: number
): Promise<void> {
    const entityId = `USER_${zkId}`;
    
    await prisma.deviceSyncTask.upsert({
        where: {
            deviceId_actionType_entityId: {
                deviceId,
                actionType: 'DELETE_USER',
                entityId
            }
        },
        update: {
            status: 'PENDING',
            retryCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        create: {
            deviceId,
            actionType: 'DELETE_USER',
            entityId,
            payload: { zkId } as object,
            status: 'PENDING'
        }
    });

    console.log(`[SyncQueue] Enqueued DELETE_USER for zkId=${zkId} on device ${deviceId}`);
}

/**
 * Enqueue DELETE_USER for ALL active+sync-enabled devices.
 * Used when an employee is soft-deleted or permanently removed.
 */
export async function enqueueGlobalDeleteUser(zkId: number): Promise<void> {
    const devices = await prisma.device.findMany({
        where: { syncEnabled: true },
        select: { id: true }
    });
    for (const device of devices) {
        await enqueueDeleteUser(device.id, zkId);
    }
    console.log(`[SyncQueue] Enqueued DELETE_USER (zkId=${zkId}) across ${devices.length} device(s).`);
}

/**
 * Enqueue deletion of a specific fingerprint.
 */
export async function enqueueDeleteFinger(
    deviceId: number,
    payload: DeleteFingerPayload
): Promise<void> {
    const entityId = `FINGER_${payload.zkId}_${payload.fingerIndex}`;
    
    await prisma.deviceSyncTask.upsert({
        where: {
            deviceId_actionType_entityId: {
                deviceId,
                actionType: 'DELETE_FINGER',
                entityId
            }
        },
        update: {
            status: 'PENDING',
            retryCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        create: {
            deviceId,
            actionType: 'DELETE_FINGER',
            entityId,
            payload: payload as object,
            status: 'PENDING'
        }
    });

    console.log(`[SyncQueue] Enqueued DELETE_FINGER (index ${payload.fingerIndex}) for zkId=${payload.zkId} on device ${deviceId}`);
}

/**
 * Enqueue deletion of a fingerprint across ALL devices matching an employee.
 * We look at EmployeeFingerprintEnrollment to know which devices held the finger.
 */
export async function enqueueGlobalDeleteFinger(
    employeeId: number,
    zkId: number,
    fingerIndex: number,
    fingerLabel: string
): Promise<void> {
    const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
        where: { employeeId, fingerIndex },
        select: { deviceId: true }
    });

    for (const enr of enrollments) {
        await enqueueDeleteFinger(enr.deviceId, { zkId, fingerIndex });
    }
    
    // Immediately remove enrollment records so DB is state-correct,
    // actual deletion happens via tasks when devices are reachable.
    await prisma.employeeFingerprintEnrollment.deleteMany({
        where: { employeeId, fingerIndex }
    });
    
    // Cleanup parent record if no fingers left
    for (const enr of enrollments) {
        const remaining = await prisma.employeeFingerprintEnrollment.count({
            where: { employeeId, deviceId: enr.deviceId }
        });
        if (remaining === 0) {
            await prisma.employeeDeviceEnrollment.deleteMany({
                where: { employeeId, deviceId: enr.deviceId }
            });
        }
    }
    
    console.log(`[SyncQueue] Translated global delete of ${fingerLabel} (zkId=${zkId}) into ${enrollments.length} queue tasks.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue Runner
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

/**
 * Execute a single queue task idempotently.
 * Throws an Error if it fails and needs retry, otherwise returns void for success.
 */
async function executeTask(task: { id: number; deviceId: number; actionType: string; entityId: string; payload: unknown; retryCount: number }, zk: InstanceType<typeof import('../../shared/lib/zk-driver').ZKDriver>): Promise<void> {
    const actionType = task.actionType as SyncActionType;
    
    try {
        if (actionType === 'UPSERT_USER') {
            const payload = task.payload as UpsertUserPayload;
            const deviceUid = payload.zkId;
            const visibleId = payload.zkId.toString();
            
            // Porting the robust pre-write occupancy check from addUserToDevice
            const deviceUsers = await zk.getUsers() || [];
            const occupant = deviceUsers.find((u) => u.uid === deviceUid);
            const visibleConflict = deviceUsers.find((u) =>
                String(u.userId).trim() === visibleId.trim() && u.uid !== deviceUid
            );

            if (occupant) {
                if (String(occupant.userId).trim() === visibleId.trim()) {
                    // Safe to update in place
                    await zk.setUser(deviceUid, payload.name, "", payload.role, payload.card, visibleId);
                } else {
                    throw new Error(`UID conflict: slot ${deviceUid} occupied by another user ("${occupant.name}")`);
                }
            } else if (visibleConflict) {
                throw new Error(`visibleId conflict: userId=${visibleId} already claimed by uid=${visibleConflict.uid}`);
            } else {
                // Empty slot, force clean before writing
                try { await zk.deleteUser(deviceUid); } catch { /* empty */ }
                await zk.clearUserFingerprints(deviceUid);
                await zk.setUser(deviceUid, payload.name, "", payload.role, payload.card, visibleId);
            }

            // Sync the database state for the card based on the successful device write
            const emp = await prisma.employee.findUnique({ where: { zkId: payload.zkId } });
            if (emp) {
                if (payload.card && payload.card > 0) {
                    await prisma.employeeCardEnrollment.upsert({
                        where: { employeeId_deviceId: { employeeId: emp.id, deviceId: task.deviceId } },
                        update: { enrolledAt: new Date() },
                        create: { employeeId: emp.id, deviceId: task.deviceId }
                    });
                    
                    await prisma.employeeDeviceEnrollment.upsert({
                        where: { employeeId_deviceId: { employeeId: emp.id, deviceId: task.deviceId } },
                        update: { enrolledAt: new Date() },
                        create: { employeeId: emp.id, deviceId: task.deviceId }
                    });
                } else if (payload.card === 0) {
                    await prisma.employeeCardEnrollment.deleteMany({
                        where: { employeeId: emp.id, deviceId: task.deviceId }
                    });
                }
            }
        } 
        else if (actionType === 'DELETE_USER') {
            const payload = task.payload as DeleteUserPayload;
            await zk.deleteUser(payload.zkId);
        }
        else if (actionType === 'DELETE_FINGER') {
            const payload = task.payload as DeleteFingerPayload;
            await zk.deleteFingerTemplate(payload.zkId, payload.fingerIndex);
        }
        else if (actionType === 'SYNC_FINGER_FROM_SOURCE') {
            const payload = task.payload as SyncFingerPayload;
            
            // 1. Evaluate possible source devices
            const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
                where: { employeeId: payload.employeeId, fingerIndex: payload.fingerIndex },
                select: { deviceId: true }
            });
            const sourceCandidateIds = enrollments.map(e => e.deviceId).filter(id => id !== task.deviceId);
            
            if (sourceCandidateIds.length === 0) {
                throw new Error(`Finger ${payload.fingerIndex} has no source devices (record might be corrupted or source devices deleted)`);
            }

            let sourceTemplateData: Buffer | null = null;
            const sourceDevices = await prisma.device.findMany({
                where: { id: { in: sourceCandidateIds }, isActive: true }
            });

            // 2. Iterate and securely extract template
            for (const srcDb of sourceDevices) {
                if (!tryAcquireDeviceLock(srcDb.id)) {
                    console.warn(`[SyncQueue] Source device ${srcDb.name} is busy. Skipping for now.`);
                    continue; // try next candidate (or fail and retry queue task later)
                }

                const srcZk = getDriver(srcDb.ip, srcDb.port);
                try {
                    await connectWithRetry(srcZk, 1);
                    const raw = await srcZk.getFingerTemplate(payload.zkId, payload.fingerIndex);
                    if (raw && raw.length > 0) {
                        sourceTemplateData = Buffer.alloc(raw.length);
                        raw.copy(sourceTemplateData);
                        raw.fill(0); // Secure wipe
                        break;
                    }
                } catch (err: unknown) {
                    console.warn(`[SyncQueue] Failed reading finger from source device ${srcDb.name}: ${zkErrMsg(err)}`);
                } finally {
                    try { await srcZk.disconnect(); } catch { /* ignore */ }
                    releaseDeviceLock(srcDb.id);
                }
            }

            if (!sourceTemplateData) {
                // Throw error so DeviceSyncQueue retries this exact task later!
                throw new Error(`Failed to extract finger template ${payload.fingerIndex} from any source devices (they might be offline or busy).`);
            }

            // 3. Write securely to target
            try {
                await zk.setFingerTemplate(payload.zkId, payload.fingerIndex, sourceTemplateData);
                
                await prisma.employeeFingerprintEnrollment.upsert({
                    where: { employeeId_deviceId_fingerIndex: { employeeId: payload.employeeId, deviceId: task.deviceId, fingerIndex: payload.fingerIndex } },
                    update: { enrolledAt: new Date() },
                    create: { employeeId: payload.employeeId, deviceId: task.deviceId, fingerIndex: payload.fingerIndex, fingerLabel: `Finger ${payload.fingerIndex}` }
                });
                
                // Update parent device enrollment wrapper
                await prisma.employeeDeviceEnrollment.upsert({
                    where: { employeeId_deviceId: { employeeId: payload.employeeId, deviceId: task.deviceId } },
                    update: { enrolledAt: new Date() },
                    create: { employeeId: payload.employeeId, deviceId: task.deviceId }
                });
                
                console.log(`[SyncQueue] ✓ Synced finger ${payload.fingerIndex} for zkId ${payload.zkId} securely over the network from device.`);
            } finally {
                sourceTemplateData.fill(0); // Final wipe
            }
        }
        else {
            throw new Error(`Unknown actionType: ${actionType}`);
        }
    } catch (error: unknown) {
        const msg = zkErrMsg(error).toLowerCase();
        
        // --- IDEMPOTENCY CHECKS ---
        if (actionType === 'DELETE_USER' || actionType === 'DELETE_FINGER') {
            if (msg.includes('not found') || msg.includes('no data') || msg.includes('does not exist')) {
                // Desired state achieved!
                console.log(`[SyncQueue] Overriding error for ${actionType} on ${task.entityId}: Data absent.`);
                return; // Treat as success
            }
        }
        
        // Re-throw if it wasn't an expected edge case
        throw error;
    }
}

/**
 * Process all pending tasks for a specific device.
 * Maintains O(1) impact since it only runs what explicitly changed.
 */
export async function processDeviceSyncQueue(deviceId: number): Promise<void> {
    const pendingTasks = await prisma.deviceSyncTask.findMany({
        where: { deviceId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' } // Strictly execute chronological DDL
    });

    if (pendingTasks.length === 0) {
        return;
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || !device.isActive) return;

    await acquireDeviceLock(deviceId);
    
    const zk = getDriver(device.ip, device.port);
    let successfullyConnected = false;
    
    try {
        console.log(`[SyncQueue] Processing ${pendingTasks.length} queued task(s) for "${device.name}"...`);
        await connectWithRetry(zk, 1);
        successfullyConnected = true;

        let processedCount = 0;
        let deadLetterCount = 0;

        for (const task of pendingTasks) {
            try {
                await executeTask(task, zk);
                
                await prisma.deviceSyncTask.update({
                    where: { id: task.id },
                    data: { status: 'SUCCESS' }
                });

                void audit({
                    action: 'SYNC_QUEUE_SUCCESS',
                    entityType: 'Device',
                    entityId: deviceId,
                    source: 'device-sync',
                    details: `Task ${task.actionType} for ${task.entityId} completed successfully`,
                    metadata: { actionType: task.actionType, entityId: task.entityId },
                });
                
                processedCount++;
                
            } catch (err: unknown) {
                const newRetryCount = task.retryCount + 1;
                const errorStr = zkErrMsg(err);
                
                if (newRetryCount >= MAX_RETRIES) {
                    // Dead letter
                    await prisma.deviceSyncTask.update({
                        where: { id: task.id },
                        data: { 
                            status: 'DEAD_LETTER', 
                            retryCount: newRetryCount 
                        }
                    });
                    
                    console.error(`[SyncQueue] Task ${task.id} (${task.actionType}) DEAD_LETTERED after ${MAX_RETRIES} attempts. Last error: ${errorStr}`);

                    void audit({
                        action: 'SYNC_QUEUE_FAIL',
                        level: 'ERROR',
                        entityType: 'Device',
                        entityId: deviceId,
                        details: `Task ${task.actionType} for ${task.entityId} failed permanently`,
                        metadata: { deviceId, task, errorStr }
                    });
                    
                    deadLetterCount++;
                } else {
                    // Queue for retry
                    await prisma.deviceSyncTask.update({
                        where: { id: task.id },
                        data: { retryCount: newRetryCount }
                    });
                    console.warn(`[SyncQueue] Task ${task.id} (${task.actionType}) failed (attempt ${newRetryCount}). Retrying next cycle. Error: ${errorStr}`);
                }
            }
        }

        // Refresh device data so its internal memory maps the changes
        if (processedCount > 0) {
            await zk.refreshData();
        }

        console.log(`[SyncQueue] Done for "${device.name}". Processed: ${processedCount}. Dead Letters: ${deadLetterCount}.`);
        
    } catch (err: unknown) {
        if (!successfullyConnected) {
            console.warn(`[SyncQueue] Cannot process queue for "${device?.name}" — device unreachable: ${zkErrMsg(err)}`);
        } else {
            console.error(`[SyncQueue] Critical error processing queue for "${device?.name}": ${zkErrMsg(err)}`);
        }
    } finally {
        if (successfullyConnected) {
            try { await zk.disconnect(); } catch { /* ignore */ }
        }
        releaseDeviceLock(deviceId);
    }
}


