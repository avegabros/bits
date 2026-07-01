import { prisma } from '../../../shared/lib/prisma';
import { ZKDriver } from '../../../shared/lib/zk-driver';
import { getDriver, connectWithRetry, zkErrMsg } from './zk-connection.service';
import { tryAcquireDeviceLock, releaseDeviceLock, acquireDeviceLock } from './zk-lock.service';
export const PROTECTED_DEVICE_UIDS = [1];
const MIN_EMPLOYEE_ZK_ID = 2;

interface SyncResult { success: boolean; message?: string; error?: string; newLogs?: number; count?: number; results?: Record<string, unknown>[]; }
export interface SafeZkIdResult {
    zkId: number;
    scannedDeviceCount: number;
    unreachableDevices: string[];
    totalUsedIds: number;
}


export const findNextSafeZkId = async (): Promise<SafeZkIdResult> => {
    // 1. Collect zkIds from DB.
    const dbEmployees = await prisma.employee.findMany({
        where: { zkId: { not: null } },
        select: { zkId: true },
    });

    const usedIds = new Set<number>([
        ...dbEmployees.map(e => e.zkId!),
        ...PROTECTED_DEVICE_UIDS,
    ]);

    // 2. Collect IDs used on active devices (both UID and userId).
    const activeDevices = await prisma.device.findMany({
        where: { isActive: true, syncEnabled: true },
        orderBy: { id: 'asc' },
    });

    const unreachableDevices: string[] = [];

    for (const dbDevice of activeDevices) {
        const zk = getDriver(dbDevice.ip, dbDevice.port);
        try {
            await connectWithRetry(zk, 1);
            const deviceUsers = await zk.getUsers();
            
            deviceUsers.forEach((u) => {
                // Scan both internal UID and external userId
                if (typeof u.uid === 'number') usedIds.add(u.uid);
                
                const parsedUserId = parseInt(String(u.userId));
                if (!isNaN(parsedUserId) && parsedUserId > 0) {
                    usedIds.add(parsedUserId);
                }
            });
            
            console.log(`[ZK] findNextSafeZkId — scanned ${deviceUsers.length} users from "${dbDevice.name}".`);
        } catch (err: unknown) {
            unreachableDevices.push(dbDevice.name);
            console.warn(`[ZK] findNextSafeZkId — could not reach "${dbDevice.name}" (${zkErrMsg(err)}).`);
        } finally {
            try { await zk.disconnect(); } catch { /* ignore */ }
        }
    }

    // FAIL-SAFE: Refuse assignment if any sync-enabled device was unreachable
    if (unreachableDevices.length > 0) {
        throw new Error(
            `Cannot safely assign ZKID — ${unreachableDevices.length} device(s) unreachable: ${unreachableDevices.join(', ')}. ` +
            `All sync-enabled devices must be online to guarantee ZKID uniqueness.`
        );
    }

    // 3. Find first available candidate.
    let candidate = MIN_EMPLOYEE_ZK_ID;
    while (usedIds.has(candidate)) {
        candidate++;
    }

    const { audit } = require('../../../shared/lib/auditLogger');
    void audit({
        action: 'ZKID_ASSIGNED',
        level: 'INFO',
        entityType: 'System',
        source: 'device-sync',
        details: `Assigned zkId=${candidate} (scanned ${usedIds.size} IDs across ${activeDevices.length} devices)`,
        metadata: { zkId: candidate, scannedDevices: activeDevices.length, totalUsedIds: usedIds.size }
    });

    return {
        zkId: candidate,
        scannedDeviceCount: activeDevices.length,
        unreachableDevices: [],
        totalUsedIds: usedIds.size,
    };
};

export async function triggerAutoReconcile(deviceId: number, deviceName: string): Promise<void> {
    try {
        const deviceRecord = await prisma.device.findUnique({
            where: { id: deviceId },
            select: { isActive: true },
        });

        if (!deviceRecord?.isActive) {
            return;
        }

        console.log(`[ZK] Device "${deviceName}" reconnected — scheduling queue processing...`);

        const { processDeviceSyncQueue } = require('../deviceSyncQueue.service');

        setImmediate(async () => {
            try {
                await processDeviceSyncQueue(deviceId);
            } catch (reconcileErr: unknown) {
                console.error(
                    `[ZK] Queue processing failed for "${deviceName}": ${zkErrMsg(reconcileErr)}`
                );
            }
        });

    } catch (err: unknown) {
        console.error(
            `[ZK] triggerAutoReconcile error for "${deviceName}": ${zkErrMsg(err)}`
        );
    }
}

export const addUserToDevice = async (zkId: number, name: string, role: string = 'USER', cardNumber: number = 0): Promise<SyncResult> => {
    try {
        console.log(`[ZK] Enqueuing UPSERT_USER for zkId=${zkId} (${name})...`);

        const { enqueueGlobalUpsertUser, processDeviceSyncQueue } = require('../deviceSyncQueue.service');
        const deviceRole = ['ADMIN', 'MANAGER'].includes(role) ? 14 : 0;
        
        await enqueueGlobalUpsertUser({
            zkId,
            name,
            role: deviceRole,
            card: cardNumber
        });

        // Inline execution for online devices.
        const onlineDevices = await prisma.device.findMany({
            where: { isActive: true, syncEnabled: true },
            select: { id: true, name: true },
        });

        for (const device of onlineDevices) {
            setImmediate(async () => {
                try {
                    await processDeviceSyncQueue(device.id);
                } catch (err: unknown) {
                    console.error(`[ZK] Inline queue flush failed for "${device.name}": ${zkErrMsg(err)}`);
                }
            });
        }

        return { success: true, message: `User ${name} queued for synchronization.` };
    } catch (error: unknown) {
        console.error('[ZK] Add User Error:', zkErrMsg(error));
        throw new Error(`Failed to queue adding employee: ${zkErrMsg(error)}`);
    }
};

export const deleteUserFromDevice = async (zkId: number): Promise<SyncResult> => {
    try {
        console.log(`[ZK] Enqueuing DELETE_USER for zkId=${zkId} across all devices...`);

        const { enqueueGlobalDeleteUser, processDeviceSyncQueue } = require('../deviceSyncQueue.service');
        await enqueueGlobalDeleteUser(zkId);

        // Inline execution for online devices.
        const onlineDevices = await prisma.device.findMany({
            where: { isActive: true, syncEnabled: true },
            select: { id: true, name: true },
        });

        for (const device of onlineDevices) {
            setImmediate(async () => {
                try {
                    await processDeviceSyncQueue(device.id);
                } catch (err: unknown) {
                    console.error(`[ZK] Inline queue flush failed for "${device.name}": ${zkErrMsg(err)}`);
                }
            });
        }

        return { success: true, message: `DELETE_USER queued for zkId=${zkId}. Online devices will sync immediately.` };
    } catch (error: unknown) {
        console.error('[ZK] Delete User Error:', zkErrMsg(error));
        return { success: false, message: `Failed to queue user deletion: ${zkErrMsg(error)}`, error: zkErrMsg(error) };
    }
};

export const syncEmployeesToDevice = async (): Promise<SyncResult> => {
    try {
        console.log(`[ZK] syncEmployeesToDevice — fetching DB employees...`);
        const employees = await prisma.employee.findMany({
            where: {
                zkId: { not: null, gt: 1 },
                employmentStatus: 'ACTIVE',
            },
            select: { id: true, zkId: true, firstName: true, lastName: true, role: true, cardNumber: true }
        });

        if (employees.length === 0) {
            return { success: true, message: "No employees to sync.", count: 0 };
        }

        const dbDevices = await prisma.device.findMany({
            where: { isActive: true, syncEnabled: true },
            orderBy: { id: 'asc' },
        });

        if (dbDevices.length === 0) {
            return { success: false, message: 'No active devices configured.' };
        }

        let totalSuccess = 0;

        for (const dbDevice of dbDevices) {
            await acquireDeviceLock(dbDevice.id);
            const zk = getDriver(dbDevice.ip, dbDevice.port);
            let successCount = 0;
            try {
                console.log(`[ZK] Connecting to "${dbDevice.name}"...`);
                await connectWithRetry(zk);

                // Fetch all device users once to avoid redundant network requests.
                const deviceUsers = await zk.getUsers();

                // Fetch device admin mapping for this device
                const enrollments = await prisma.employeeDeviceEnrollment.findMany({
                    where: { deviceId: dbDevice.id, isDeviceAdmin: true },
                    select: { employeeId: true }
                });
                const adminEmployeeIds = new Set(enrollments.map(e => e.employeeId));

                for (const employee of employees) {
                    const fullName = `${employee.firstName} ${employee.lastName}`;
                    const zkId = employee.zkId!;
                    const visibleId = zkId.toString();
                    const deviceRole = adminEmployeeIds.has(employee.id) ? 14 : 0;
                    const deviceUid = zkId;

                    if (PROTECTED_DEVICE_UIDS.includes(deviceUid)) {
                        console.warn(`[ZK]   ⚠ SKIP ${fullName} — zkId=${zkId} is a protected UID.`);
                        continue;
                    }

                    try {
                        // Pre-write slot occupancy check. Skip if slot is held by a different user.
                        const occupant = deviceUsers.find((u) => u.uid === deviceUid);

                        if (occupant) {
                            if (String(occupant.userId).trim() === visibleId.trim()) {
                                // Same employee — update name/role in place, skip delete
                                await zk.setUser(deviceUid, fullName, "", deviceRole, employee.cardNumber ?? 0, visibleId);
                                console.log(`[ZK]   ✓ Updated: "${fullName}" → UID=${deviceUid} (slot already owned, skipped delete)`);
                                successCount++;
                            } else {
                                // Different user in this slot — skip, never overwrite
                                console.warn(`[ZK]   ⚠ UID conflict: slot UID=${deviceUid} occupied by userId="${occupant.userId}" ("${occupant.name}") — skipping "${fullName}".`);
                                // continue to next employee — do NOT return, do NOT abort the sync
                            }
                        } else {
                            // Slot is empty — safe to write
                            try { await zk.deleteUser(deviceUid); } catch { /* empty slot — ok */ }
                            await zk.setUser(deviceUid, fullName, "", deviceRole, employee.cardNumber ?? 0, visibleId);
                            console.log(`[ZK]   ✓ Written: "${fullName}" → UID=${deviceUid} on "${dbDevice.name}"`);
                            successCount++;
                        }
                    } catch (err: unknown) {
                        console.error(`[ZK]   ✗ Failed "${fullName}": ${zkErrMsg(err)}`);
                    }
                }

                await zk.refreshData();
                totalSuccess += successCount;
            } catch (err: unknown) {
                console.error(`[ZK] Could not sync to "${dbDevice.name}": ${zkErrMsg(err)}`);
            } finally {
                try { await zk.disconnect(); } catch { /* ignore */ }
                releaseDeviceLock(dbDevice.id);
            }
        }

        return {
            success: totalSuccess > 0,
            message: `Synced ${totalSuccess} employee(s) across ${dbDevices.length} device(s).`,
            count: totalSuccess,
        };

    } catch (error: unknown) {
        throw new Error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const testDeviceConnection = async (): Promise<SyncResult> => {
    const zk = getDriver();
    // Uses sentinel device ID 0 for the lock.
    await acquireDeviceLock(0);
    try {
        await connectWithRetry(zk);

        let serial = 'N/A';
        try {
            const info = await zk.getInfo();
            serial = info?.serialNumber ?? 'N/A';
        } catch {
            console.warn('[ZK] getInfo() failed (UDP may be blocked) — serial unavailable.');
        }

        let timePart = '';
        try {
            const time = await zk.getTime();
            timePart = `, Time: ${JSON.stringify(time)}`;
        } catch {
            // getTime() failure is non-fatal
        }

        return { success: true, message: `Connected! Serial: ${serial}${timePart}` };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
        try { await zk.disconnect(); } catch { /* ignore disconnect errors */ }
        releaseDeviceLock(0);
    }
};

export const syncEmployeesFromDevice = async (): Promise<SyncResult> => {
    try {
        const dbDevices = await prisma.device.findMany({
            where: { isActive: true, syncEnabled: true },
            orderBy: { id: 'asc' },
        });

        if (dbDevices.length === 0) {
            return { success: true, message: 'No active, sync-enabled devices configured.' };
        }

        let totalUpdateCount = 0;
        let totalSkippedCount = 0;

        for (const dbDevice of dbDevices) {
            await acquireDeviceLock(dbDevice.id);
            const zk = getDriver(dbDevice.ip, dbDevice.port);
            try {
                console.log(`[ZK] syncEmployeesFromDevice — connecting to "${dbDevice.name}" (${dbDevice.ip}:${dbDevice.port})...`);
                await connectWithRetry(zk);
                const users = await zk.getUsers();

                console.log(`[ZK] Found ${users.length} users on "${dbDevice.name}".`);
                let updateCount = 0;
                let skippedCount = 0;

                for (const user of users) {
                    let zkId = parseInt(user.userId);
                    if (isNaN(zkId)) continue;

                    // SPECIAL CASE: Map Device Admin (2948876) to Database Admin (1)
                    if (zkId === 2948876) {
                        zkId = 1;
                    }

                    const existing = await prisma.employee.findUnique({ where: { zkId } });

                    if (existing) {
                        const nameParts = user.name.split(' ');
                        const firstName = nameParts[0] || existing.firstName;
                        const lastName = nameParts.slice(1).join(' ') || existing.lastName;

                        if (user.name && (existing.firstName !== firstName || existing.lastName !== lastName)) {
                            await prisma.employee.update({
                                where: { id: existing.id },
                                data: { firstName, lastName }
                            });
                            console.log(`[ZK] Updated Name for zkId=${zkId}: ${user.name}`);
                        }
                        updateCount++;
                    } else {
                        // Skip users not present in the database.
                        console.log(`[ZK] Skipping unknown zkId ${zkId} — not in database`);
                        skippedCount++;
                    }
                }

                totalUpdateCount += updateCount;
                totalSkippedCount += skippedCount;
                console.log(`[ZK] "${dbDevice.name}" done. Matched: ${updateCount}, Skipped: ${skippedCount}.`);

            } catch (err: unknown) {
                console.error(`[ZK] Failed to read users from "${dbDevice.name}": ${zkErrMsg(err)}`);
            } finally {
                try { await zk.disconnect(); } catch { /* ignore */ }
                releaseDeviceLock(dbDevice.id);
            }
        }

        return {
            success: true,
            message: `Scanned ${dbDevices.length} device(s). Matched ${totalUpdateCount}, Skipped ${totalSkippedCount} unknown.`,
            count: totalUpdateCount,
        };

    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
};




