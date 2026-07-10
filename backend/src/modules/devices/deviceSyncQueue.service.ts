import { prisma } from '../../shared/lib/prisma';
import { 
    getDriver, 
    acquireDeviceLock, 
    releaseDeviceLock, 
    zkErrMsg, 
    connectWithRetry
} from './zk';
import { audit } from '../../shared/lib/auditLogger';
import deviceEmitter from '../../shared/events/deviceEmitter';
import { getDeviceRoute } from './device-router.service';
import { sendAgentCommand } from './agent-gateway.service';
import { encryptTemplate, decryptTemplate } from '../../shared/utils/biometric-crypto';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

const MAX_RETRIES = 6;

/**
 * Execute a single queue task idempotently.
 * Throws an Error if it fails and needs retry, otherwise returns void for success.
 */
async function executeTask(
    task: { id: number; deviceId: number; actionType: string; entityId: string; payload: unknown; retryCount: number },
    route: any,
    zk: any
): Promise<void> {
    const actionType = task.actionType as SyncActionType;
    
    try {
        if (actionType === 'UPSERT_USER') {
            const payload = task.payload as UpsertUserPayload;
            const deviceUid = payload.zkId;
            const visibleId = payload.zkId.toString();

            if (route.mode === 'agent') {
                const res = await sendAgentCommand(route.branchId, {
                    action: 'UPSERT_USER',
                    deviceIp: route.device.ip,
                    devicePort: route.device.port,
                    zkId: payload.zkId,
                    name: payload.name,
                    card: payload.card,
                    role: payload.role
                });
                if (!res.success) {
                    throw new Error(res.error || 'Agent upsert user failed');
                }
            } else {
                // Porting the robust pre-write occupancy check from addUserToDevice
                const deviceUsers = await zk.getUsers() || [];
                const occupant = deviceUsers.find((u: any) => u.uid === deviceUid);
                const visibleConflict = deviceUsers.find((u: any) =>
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
                    // Empty slot, write user record
                    try { await zk.deleteUser(deviceUid); } catch { /* empty */ }
                    await zk.setUser(deviceUid, payload.name, "", payload.role, payload.card, visibleId);
                }
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
            if (route.mode === 'agent') {
                const res = await sendAgentCommand(route.branchId, {
                    action: 'DELETE_USER',
                    deviceIp: route.device.ip,
                    devicePort: route.device.port,
                    zkId: payload.zkId
                });
                if (!res.success) throw new Error(res.error || 'Agent delete user failed');
            } else {
                await zk.deleteUser(payload.zkId);
            }
        }
        else if (actionType === 'DELETE_FINGER') {
            const payload = task.payload as DeleteFingerPayload;
            if (route.mode === 'agent') {
                const res = await sendAgentCommand(route.branchId, {
                    action: 'DELETE_FINGER',
                    deviceIp: route.device.ip,
                    devicePort: route.device.port,
                    zkId: payload.zkId,
                    fingerIndex: payload.fingerIndex
                });
                if (!res.success) throw new Error(res.error || 'Agent delete finger failed');
            } else {
                await zk.deleteFingerTemplate(payload.zkId, payload.fingerIndex);
            }
        }
        else if (actionType === 'SYNC_FINGER_FROM_SOURCE') {
            const payload = task.payload as SyncFingerPayload;
            
            // 1. Evaluate possible source devices or Cloud DB
            let sourceTemplateData: Buffer | null = null;

            // Check Cloud Database first
            const dbTemplate = await prisma.fingerprintTemplate.findFirst({
                where: { employeeId: payload.employeeId, fingerIndex: payload.fingerIndex }
            });

            if (dbTemplate) {
                sourceTemplateData = decryptTemplate(Buffer.from(dbTemplate.templateData));
                console.log(`[SyncQueue] Loaded template for finger ${payload.fingerIndex} from Cloud DB for task.`);
            } else {
                const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
                    where: { employeeId: payload.employeeId, fingerIndex: payload.fingerIndex },
                    select: { deviceId: true }
                });
                const sourceCandidateIds = enrollments.map(e => e.deviceId).filter(id => id !== task.deviceId);
                
                if (sourceCandidateIds.length === 0) {
                    throw new Error(`Finger ${payload.fingerIndex} has no source devices (record might be corrupted or source devices deleted)`);
                }

                const sourceDevices = await prisma.device.findMany({
                    where: { id: { in: sourceCandidateIds }, isActive: true }
                });

                // 2. Iterate and securely extract template
                for (const srcDb of sourceDevices) {
                    const srcRoute = await getDeviceRoute(srcDb.id);

                    if (srcRoute.mode === 'agent') {
                        try {
                            console.log(`[SyncQueue] Reading template for finger ${payload.fingerIndex} from "${srcDb.name}" via Agent...`);
                            const res = await sendAgentCommand(srcRoute.branchId, {
                                action: 'READ_FINGERPRINT',
                                deviceIp: srcDb.ip,
                                devicePort: srcDb.port,
                                zkId: payload.zkId,
                                fingerIndex: payload.fingerIndex
                            });
                            if (res.success && res.data) {
                                sourceTemplateData = Buffer.from(res.data);
                                await prisma.fingerprintTemplate.upsert({
                                    where: { employeeId_fingerIndex: { employeeId: payload.employeeId, fingerIndex: payload.fingerIndex } },
                                    update: { templateData: encryptTemplate(sourceTemplateData) as any, updatedAt: new Date() },
                                    create: { employeeId: payload.employeeId, fingerIndex: payload.fingerIndex, templateData: encryptTemplate(sourceTemplateData) as any }
                                });
                                break;
                            }
                        } catch (err) {
                            console.warn(`[SyncQueue] Agent read failed from source "${srcDb.name}":`, err);
                        }
                    } else {
                        await acquireDeviceLock(srcDb.id);
                        const srcZk = getDriver(srcDb.ip, srcDb.port);
                        try {
                            await connectWithRetry(srcZk, 1);
                            const raw = await srcZk.getFingerTemplate(payload.zkId, payload.fingerIndex);
                            if (raw && raw.length > 0) {
                                sourceTemplateData = Buffer.alloc(raw.length);
                                raw.copy(sourceTemplateData);
                                raw.fill(0); // Secure wipe

                                // Save to cloud DB
                                await prisma.fingerprintTemplate.upsert({
                                    where: { employeeId_fingerIndex: { employeeId: payload.employeeId, fingerIndex: payload.fingerIndex } },
                                    update: { templateData: encryptTemplate(sourceTemplateData) as any, updatedAt: new Date() },
                                    create: { employeeId: payload.employeeId, fingerIndex: payload.fingerIndex, templateData: encryptTemplate(sourceTemplateData) as any }
                                });
                                break;
                            }
                        } catch (err: unknown) {
                            console.warn(`[SyncQueue] Failed reading finger from source device ${srcDb.name}: ${zkErrMsg(err)}`);
                        } finally {
                            try { await srcZk.disconnect(); } catch { /* ignore */ }
                            await sleep(300);
                            releaseDeviceLock(srcDb.id);
                        }
                    }
                }
            }

            if (!sourceTemplateData) {
                // Throw error so DeviceSyncQueue retries this exact task later!
                throw new Error(`Failed to extract finger template ${payload.fingerIndex} from any source devices (they might be offline or busy).`);
            }

            // 3. Write securely to target
            try {
                if (route.mode === 'agent') {
                    console.log(`[SyncQueue] Writing finger ${payload.fingerIndex} to "${route.device.name}" via Agent...`);
                    const res = await sendAgentCommand(route.branchId, {
                        action: 'WRITE_FINGERPRINT',
                        deviceIp: route.device.ip,
                        devicePort: route.device.port,
                        zkId: payload.zkId,
                        fingerIndex: payload.fingerIndex,
                        templateData: sourceTemplateData
                    });
                    if (!res.success) {
                        throw new Error(res.error || 'Agent write failed');
                    }
                } else {
                    await zk.setFingerTemplate(payload.zkId, payload.fingerIndex, sourceTemplateData);
                }
                
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
                
                console.log(`[SyncQueue] ✓ Synced finger ${payload.fingerIndex} for zkId ${payload.zkId} securely over the network.`);
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

    const route = await getDeviceRoute(deviceId);
    let zk: any = null;
    let successfullyConnected = false;
    
    try {
        console.log(`[SyncQueue] Processing ${pendingTasks.length} queued task(s) for "${device.name}" (mode: ${route.mode})...`);
        
        if (route.mode === 'direct') {
            await acquireDeviceLock(deviceId);
            zk = getDriver(device.ip, device.port);
            await connectWithRetry(zk, 1);
            successfullyConnected = true;
        } else {
            successfullyConnected = true; // WebSocket agent is assumed online/handled in gateway
        }

        let processedCount = 0;
        let deadLetterCount = 0;

        for (const task of pendingTasks) {
            try {
                if (processedCount > 0 && route.mode === 'direct') {
                    await sleep(300);
                }
                await executeTask(task, route, zk);
                
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

                    // Emit SSE event for admin dashboard
                    deviceEmitter.emit('dead-letter', {
                        deviceId,
                        taskId: task.id,
                        actionType: task.actionType,
                        entityId: task.entityId,
                        error: errorStr,
                        retryCount: newRetryCount,
                    });
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
        if (processedCount > 0 && route.mode === 'direct' && zk) {
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
        if (zk) {
            try { await zk.disconnect(); } catch { /* ignore */ }
        }
        if (route && route.mode === 'direct') {
            releaseDeviceLock(deviceId);
        }
    }
}


// ── Queue Health ──────────────────────────────────────────────

export interface QueueHealthReport {
    totalPending: number;
    totalDeadLetter: number;
    staleTasks: number;
    perDevice: {
        deviceId: number;
        deviceName: string;
        pending: number;
        deadLetter: number;
    }[];
}

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export async function getQueueHealth(): Promise<QueueHealthReport> {
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

    const tasks = await prisma.deviceSyncTask.findMany({
        where: { status: { in: ['PENDING', 'DEAD_LETTER'] } },
        include: { device: { select: { name: true } } },
    });

    const perDeviceMap = new Map<number, { deviceName: string; pending: number; deadLetter: number }>();

    let totalPending = 0;
    let totalDeadLetter = 0;
    let staleTasks = 0;

    for (const task of tasks) {
        if (task.status === 'PENDING') totalPending++;
        if (task.status === 'DEAD_LETTER') totalDeadLetter++;
        if (task.status === 'PENDING' && task.createdAt < staleThreshold) staleTasks++;

        const entry = perDeviceMap.get(task.deviceId) ?? {
            deviceName: task.device.name,
            pending: 0,
            deadLetter: 0,
        };
        if (task.status === 'PENDING') entry.pending++;
        if (task.status === 'DEAD_LETTER') entry.deadLetter++;
        perDeviceMap.set(task.deviceId, entry);
    }

    return {
        totalPending,
        totalDeadLetter,
        staleTasks,
        perDevice: Array.from(perDeviceMap.entries()).map(([deviceId, data]) => ({
            deviceId,
            ...data,
        })),
    };
}

// ── Queue Drain ──────────────────────────────────────────────

export interface DrainResult {
    devicesProcessed: number;
    totalTasksAttempted: number;
    errors: string[];
}

export async function drainAllPendingQueues(): Promise<DrainResult> {
    const devicesWithPending = await prisma.deviceSyncTask.findMany({
        where: { status: 'PENDING' },
        select: { deviceId: true },
        distinct: ['deviceId'],
    });

    const errors: string[] = [];
    let totalTasksAttempted = 0;

    for (const { deviceId } of devicesWithPending) {
        try {
            await processDeviceSyncQueue(deviceId);
            const remaining = await prisma.deviceSyncTask.count({
                where: { deviceId, status: 'PENDING' },
            });
            totalTasksAttempted += remaining === 0 ? 1 : remaining;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Device ${deviceId}: ${msg}`);
        }
    }

    if (devicesWithPending.length > 0) {
        console.log(`[SyncQueue] Drain completed: ${devicesWithPending.length} device(s), ${errors.length} error(s)`);
    }

    return {
        devicesProcessed: devicesWithPending.length,
        totalTasksAttempted,
        errors,
    };
}

// ── Dead-Letter Recovery ────────────────────────────────────────

export async function retryDeadLetterTasks(deviceId?: number): Promise<number> {
    const where: { status: string; deviceId?: number } = { status: 'DEAD_LETTER' };
    if (deviceId) where.deviceId = deviceId;

    const result = await prisma.deviceSyncTask.updateMany({
        where,
        data: { status: 'PENDING', retryCount: 0, updatedAt: new Date() },
    });

    if (result.count > 0) {
        console.log(`[SyncQueue] Reset ${result.count} dead-letter task(s) to PENDING`);
    }

    return result.count;
}
