import { prisma } from '../../../shared/lib/prisma';
import { ZKDriver } from '../../../shared/lib/zk-driver';
import { getDriver, connectWithRetry, zkErrMsg } from './zk-connection.service';
import { acquireDeviceLock, releaseDeviceLock } from './zk-lock.service';
import { PROTECTED_DEVICE_UIDS } from './zk-user.service';
import { getDeviceRoute } from '../device-router.service';
import { sendAgentCommand } from '../agent-gateway.service';


export interface ReconcileReport {
    deviceId: number;
    deviceName: string;
    dryRun: boolean;                                    // true = preview only, no writes made
    pushed: { zkId: number; name: string }[];           // DB-only → pushed to device (or would be)
    deleted: { uid: number; userId: string; name: string }[]; // device-only → removed (or would be)
    protected: { uid: number; name: string }[];          // admin users skipped
    needsEnrollment: { zkId: number; name: string }[];  // users with 0 fingerprints
    conflicts: {
        type: 'UID_MISMATCH' | 'USERID_COLLISION';
        zkId: number;
        name: string;
        details: string;
    }[];
    errors: string[];
}

export const reconcileDeviceWithDB = async (deviceId: number, dryRun: boolean = false, pushOnly: boolean = false): Promise<ReconcileReport> => {
    const report: ReconcileReport = {
        deviceId,
        deviceName: '',
        dryRun,
        pushed: [],
        deleted: [],
        protected: [],
        needsEnrollment: [],
        conflicts: [],
        errors: [],
    };

    if (dryRun) {
        console.log(`[Reconcile] 🔍 DRY RUN — no writes will be made to the device.`);
    }

    // Dynamically import Queue methods to avoid circular dependencies
    const { enqueueUpsertUser, enqueueDeleteUser, enqueueFingerprintPull, processDeviceSyncQueue } = await import('../deviceSyncQueue.service');
    const { getExcludedEmployeeIds } = await import('../biometric-exclusion.service');

    // 1. Load device config from DB
    const dbDevice = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!dbDevice) throw new Error(`Device ${deviceId} not found in DB`);
    report.deviceName = dbDevice.name;

    // 2. Load all active DB employees, including their card enrollment for this device
    const dbEmployees = await prisma.employee.findMany({
        where: { zkId: { not: null }, employmentStatus: 'ACTIVE' },
        select: { 
            id: true, 
            zkId: true, 
            firstName: true, 
            lastName: true, 
            role: true, 
            cardNumber: true,
            EmployeeDeviceEnrollment: {
                where: { deviceId },
                select: { isDeviceAdmin: true }
            }
        }
    });
    const dbByZkId = new Map(dbEmployees.map(e => [e.zkId!.toString(), e]));

    const route = await getDeviceRoute(deviceId);
    let zk: any = null;

    try {
        let deviceUsers: any[] = [];

        if (route.mode === 'agent') {
            console.log(`[Reconcile] Fetching users from "${dbDevice.name}" via Agent...`);
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
            await acquireDeviceLock(deviceId);
            zk = getDriver(dbDevice.ip, dbDevice.port);
            console.log(`[Reconcile] Connecting to "${dbDevice.name}" (${dbDevice.ip}:${dbDevice.port})...`);
            await connectWithRetry(zk, 2);
            deviceUsers = await zk.getUsers();
        }
        console.log(`[Reconcile] Device has ${deviceUsers.length} users. DB has ${dbEmployees.length} active employees.`);

        // Convert userId to trimmed format for accurate comparison.
        const deviceByVisibleId = new Map(deviceUsers.map((u) => [String(u.userId).trim(), u]));
        // Also build a UID-based lookup for secondary matching
        const deviceByUid = new Map(deviceUsers.map((u) => [u.uid as number, u]));

        // ── STEP B: Delete device-only ghost users ──────────────────────────
        if (pushOnly) {
            console.log(`[Reconcile] ⏩ Push-only mode — skipping ghost user deletion.`);
        } else {
        for (const dUser of deviceUsers) {
            const uid = dUser.uid;
            const visibleId = String(dUser.userId).trim();

            // Skip protected UIDs
            if (PROTECTED_DEVICE_UIDS.includes(uid)) {
                report.protected.push({ uid, name: dUser.name });
                continue;
            }

            // Skip device admins.
            if ((dUser.role ?? 0) > 0) {
                report.protected.push({ uid, name: dUser.name });
                console.log(`[Reconcile] ⛔ Skipping admin UID=${uid} ("${dUser.name}") — protected.`);
                continue;
            }

            // Check if user is active in DB.
            if (!dbByZkId.has(visibleId)) {
                // Ghost user — not in DB.
                if (dryRun) {
                    // Dry-run: record what would be deleted, touch nothing.
                    report.deleted.push({ uid, userId: visibleId, name: dUser.name });
                    console.log(`[Reconcile] 🔍 Would delete ghost UID=${uid} visibleId="${visibleId}" ("${dUser.name}").`);
                } else {
                    // Live run: delete the ghost from the device.
                    console.log(`[Reconcile] 🗑 Queuing deletion of ghost user UID=${uid} visibleId="${visibleId}" ("${dUser.name}")...`);
                    try {
                        await enqueueDeleteUser(deviceId, uid);
                        report.deleted.push({ uid, userId: visibleId, name: dUser.name });
                        console.log(`[Reconcile] ✓ Queued deletion of ghost UID=${uid}.`);
                    } catch (err: unknown) {
                        const msg = `Failed to queue delete for UID=${uid}: ${zkErrMsg(err)}`;
                        report.errors.push(msg);
                        console.error(`[Reconcile] ✗ ${msg}`);
                    }
                }
            }
        }
        } // end if (!pushOnly)

        // ── STEP C: Push DB-only employees to device ────────────────────────
        const cardExclusions = await getExcludedEmployeeIds(deviceId, 'CARD');
        const fpExclusions = await getExcludedEmployeeIds(deviceId, 'FINGERPRINT');
        for (const emp of dbEmployees) {
            const zkId = emp.zkId!;
            const visibleId = zkId.toString();
            const fullName = `${emp.firstName} ${emp.lastName}`;
            const isDevAdmin = emp.EmployeeDeviceEnrollment?.[0]?.isDeviceAdmin || false;
            const deviceRole = isDevAdmin ? 14 : 0;

            if (PROTECTED_DEVICE_UIDS.includes(zkId)) continue;

            // 3. Conflict Detection (Identity Guard)
            const dUserByVisibleId = deviceByVisibleId.get(visibleId);
            const dUserByUid = deviceByUid.get(zkId);

            if (dUserByVisibleId && dUserByVisibleId.uid !== zkId) {
                report.conflicts.push({
                    type: 'UID_MISMATCH',
                    zkId,
                    name: fullName,
                    details: `User "${dUserByVisibleId.name}" has correct userId=${visibleId} but is at wrong internal UID=${dUserByVisibleId.uid} (expected ${zkId})`
                });
            }

            if (dUserByUid && String(dUserByUid.userId).trim() !== visibleId) {
                report.conflicts.push({
                    type: 'USERID_COLLISION',
                    zkId,
                    name: fullName,
                    details: `Target UID slot ${zkId} is occupied by user "${dUserByUid.name}" (userId=${dUserByUid.userId})`
                });
            }

            const existsOnDevice = dUserByVisibleId || dUserByUid;

            const expectedCard = (emp.cardNumber && !cardExclusions.has(emp.id)) ? emp.cardNumber : 0;

            if (!existsOnDevice) {
                // Employee in DB but genuinely not on device.
                if (dryRun) {
                    // Dry-run: record what would be pushed, touch nothing.
                    report.pushed.push({ zkId, name: fullName });
                    report.needsEnrollment.push({ zkId, name: fullName });
                    console.log(`[Reconcile] 🔍 Would push "${fullName}" (zkId=${zkId}) [Card: ${expectedCard}] to device.`);
                } else {
                    console.log(`[Reconcile] ➕ Queuing push for "${fullName}" (zkId=${zkId}) [Card: ${expectedCard}] to device...`);
                    try {
                        await enqueueUpsertUser(deviceId, { zkId, name: fullName, card: expectedCard, role: deviceRole });
                        report.pushed.push({ zkId, name: fullName });
                        console.log(`[Reconcile] ✓ Queued push of "${fullName}" to UID=${zkId}.`);

                        // Queue all fingerprints registered in DB for this employee
                        if (!fpExclusions.has(emp.id)) {
                            const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
                                where: { employeeId: emp.id },
                                distinct: ['fingerIndex'],
                                select: { fingerIndex: true }
                            });
                            if (enrollments.length > 0) {
                                console.log(`[Reconcile] 🔄 Queuing pull of ${enrollments.length} fingerprint(s) for "${fullName}" (UID=${zkId})...`);
                                for (const { fingerIndex } of enrollments) {
                                    await enqueueFingerprintPull(deviceId, { zkId, employeeId: emp.id, fingerIndex });
                                }
                            } else {
                                report.needsEnrollment.push({ zkId, name: fullName });
                            }
                        } else {
                            console.log(`[Reconcile] ⏩ Skipping fingerprint pull for "${fullName}" — excluded.`);
                        }
                    } catch (err: unknown) {
                        const msg = `Failed to queue push for "${fullName}": ${zkErrMsg(err)}`;
                        report.errors.push(msg);
                        console.error(`[Reconcile] ✗ ${msg}`);
                    }
                }
            } else {
                // User exists on device — check finger count and check card state
                const dUser = deviceByVisibleId.get(visibleId) ?? deviceByUid.get(zkId);
                if (!dUser) continue; // Should not happen given existsOnDevice check above

                let enrolledFingers: number[] = [];
                const isAgent = route.mode === 'agent';
                if (isAgent) {
                    try {
                        const statusResult = await sendAgentCommand(route.branchId, {
                            action: 'GET_USER_FINGERS_STATUS',
                            deviceIp: dbDevice.ip,
                            devicePort: dbDevice.port,
                            zkId
                        });
                        if (statusResult.success && statusResult.data) {
                            enrolledFingers = statusResult.data.enrolledFingers || [];
                        }
                    } catch (err) {
                        console.warn(`[Reconcile] Failed to get user finger status via agent for ${fullName}:`, err);
                    }
                }

                const actualCard = Number(dUser.cardno || 0);

                if (actualCard !== expectedCard && !dryRun) {
                    console.log(`[Reconcile] 🔄 Queuing card fix for "${fullName}" (UID=${zkId}): Device has ${actualCard}, expected ${expectedCard}...`);
                    try {
                        await enqueueUpsertUser(deviceId, { zkId, name: fullName, card: expectedCard, role: deviceRole });
                        console.log(`[Reconcile] ✓ Queued card update for "${fullName}".`);
                    } catch (err: unknown) {
                        console.error(`[Reconcile] ✗ Failed to queue card update for "${fullName}": ${zkErrMsg(err)}`);
                        report.errors.push(`Failed to queue card update for ${fullName}`);
                    }
                } else if (actualCard !== expectedCard && dryRun) {
                     console.log(`[Reconcile] 🔍 Would update card for "${fullName}" (UID=${zkId}): Device has ${actualCard}, expected ${expectedCard}...`);
                }

                // Check missing fingerprints on device
                if (!fpExclusions.has(emp.id)) {
                    try {
                        const dbFingers = await prisma.employeeFingerprintEnrollment.findMany({
                            where: { employeeId: emp.id },
                            distinct: ['fingerIndex'],
                            select: { fingerIndex: true }
                        });

                        if (dbFingers.length > 0) {
                            let deviceFingerCount = 0;
                            for (const { fingerIndex } of dbFingers) {
                                const hasFinger = isAgent
                                    ? enrolledFingers.includes(fingerIndex)
                                    : await zk.hasFingerTemplate(dUser.uid, fingerIndex);
                                if (hasFinger) {
                                    deviceFingerCount++;
                                } else {
                                    if (!dryRun) {
                                        console.log(`[Reconcile] 🔄 Finger index ${fingerIndex} missing for "${fullName}" (UID=${dUser.uid}). Queuing pull...`);
                                        await enqueueFingerprintPull(deviceId, { zkId, employeeId: emp.id, fingerIndex });
                                    } else {
                                        console.log(`[Reconcile] 🔍 Would sync missing finger index ${fingerIndex} for "${fullName}" (UID=${dUser.uid}).`);
                                    }
                                }
                                if (!isAgent) {
                                    await new Promise(r => setTimeout(r, 50)); // 50ms rate limit delay
                                }
                            }
                            
                            // If they have fingers in DB but 0 were found on device, mark as needs enrollment
                            if (deviceFingerCount === 0) {
                                report.needsEnrollment.push({ zkId, name: fullName });
                            }
                        } else {
                            // If they have 0 fingers in DB, query device finger count to see if they need enrollment
                            try {
                                const fingerCount = isAgent
                                    ? enrolledFingers.length
                                    : await zk.getFingerCount(dUser.uid);
                                if (fingerCount === 0) {
                                    report.needsEnrollment.push({ zkId, name: fullName });
                                    console.log(`[Reconcile] ⚠ "${fullName}" (UID=${dUser.uid}) has 0 fingerprints — needs enrollment.`);
                                }
                            } catch {
                                // getFingerCount is best-effort; non-critical
                            }
                        }
                    } catch (err: unknown) {
                        console.error(`[Reconcile] Failed checking fingerprints for "${fullName}":`, zkErrMsg(err));
                    }
                } else {
                    console.log(`[Reconcile] ⏩ Skipping fingerprint checks for "${fullName}" — excluded.`);
                }
            }
        }

        // Skip reconcile-specific updates in dry-run — the device state was not changed
        if (!dryRun) {
            // NOTE: We intentionally do NOT set isActive here.
            // The healthCheckScheduler is the single source of truth for device connectivity.
            await prisma.device.update({ where: { id: deviceId }, data: { lastReconciledAt: new Date(), updatedAt: new Date() } });

            // Immediately trigger queue execution in the background
            setImmediate(() => {
                processDeviceSyncQueue(deviceId).catch(err => {
                    console.error('[Reconcile] Background queue runner failed:', err.message);
                });
            });
        }

        const mode = dryRun ? 'DRY RUN preview' : 'Live run';
        console.log(`[Reconcile] ✅ ${mode} complete. Pushed: ${report.pushed.length}, Deleted: ${report.deleted.length}, Needs enrollment: ${report.needsEnrollment.length}, Protected: ${report.protected.length}`);

        return report;

    } catch (error: unknown) {
        const msg = zkErrMsg(error);
        console.error(`[Reconcile] Fatal error: ${msg}`);
        // NOTE: We intentionally do NOT set isActive: false here.
        // A reconcile can fail for non-network reasons (protocol error, lock conflict).
        // The healthCheckScheduler is the single source of truth for device connectivity.
        throw new Error(`Reconcile failed: ${msg}`);
    } finally {
        if (zk) {
            try { await zk.disconnect(); } catch { /* ignore */ }
        }
        if (route && route.mode === 'direct') {
            releaseDeviceLock(deviceId);
        }
    }
};





