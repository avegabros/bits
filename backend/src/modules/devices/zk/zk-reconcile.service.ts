import { prisma } from '../../../shared/lib/prisma';
import { ZKDriver } from '../../../shared/lib/zk-driver';
import { getDriver, connectWithRetry, zkErrMsg } from './zk-connection.service';
import { acquireDeviceLock, releaseDeviceLock } from './zk-lock.service';
import { PROTECTED_DEVICE_UIDS } from './zk-user.service';


export interface ReconcileReport {
    deviceId: number;
    deviceName: string;
    dryRun: boolean;                                    // true = preview only, no writes made
    pushed: { zkId: number; name: string }[];           // DB-only → pushed to device (or would be)
    deleted: { uid: number; userId: string; name: string }[]; // device-only → removed (or would be)
    protected: { uid: number; name: string }[];          // admin users skipped
    needsEnrollment: { zkId: number; name: string }[];  // users with 0 fingerprints
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
        errors: [],
    };

    if (dryRun) {
        console.log(`[Reconcile] 🔍 DRY RUN — no writes will be made to the device.`);
    }

    // Dynamically import Queue methods to avoid circular dependencies
    const { enqueueUpsertUser, enqueueDeleteUser, enqueueFingerprintPull, processDeviceSyncQueue } = await import('../deviceSyncQueue.service');

    // 1. Load device config from DB
    const dbDevice = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!dbDevice) throw new Error(`Device ${deviceId} not found in DB`);
    report.deviceName = dbDevice.name;

    // 2. Load all active DB employees, including their card enrollment for this device
    const dbEmployees = await prisma.employee.findMany({
        where: { zkId: { not: null }, employmentStatus: 'ACTIVE' },
        select: { 
            id: true, zkId: true, firstName: true, lastName: true, role: true, cardNumber: true,
            EmployeeCardEnrollment: { where: { deviceId } }
        }
    });
    const dbByZkId = new Map(dbEmployees.map(e => [e.zkId!.toString(), e]));

    await acquireDeviceLock(deviceId);
    const zk = getDriver(dbDevice.ip, dbDevice.port);

    try {
        console.log(`[Reconcile] Connecting to "${dbDevice.name}" (${dbDevice.ip}:${dbDevice.port})...`);
        await connectWithRetry(zk, 2);

        // ── PRE-RECONCILE: Global Deletions Sweep (Handled by Queue) ───────

        // 3. Get all users currently on device
        const deviceUsers = await zk.getUsers();
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
        for (const emp of dbEmployees) {
            const zkId = emp.zkId!;
            const visibleId = zkId.toString();
            const fullName = `${emp.firstName} ${emp.lastName}`;
            const deviceRole = emp.role === 'ADMIN' ? 14 : 0;

            if (PROTECTED_DEVICE_UIDS.includes(zkId)) continue;

            // Check by trimmed visibleId first, then by UID as fallback.
            // This prevents false "not on device" when the string has trailing spaces
            // or the user was written with a different visibleId format.
            const existsOnDevice = deviceByVisibleId.has(visibleId) || deviceByUid.has(zkId);

            const expectedCard = emp.EmployeeCardEnrollment.length > 0
                ? (emp.cardNumber || 0) : 0;

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
                        // Newly pushed user has no fingerprints yet
                        report.needsEnrollment.push({ zkId, name: fullName });
                        console.log(`[Reconcile] ✓ Queued push of "${fullName}" to UID=${zkId}.`);
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

                try {
                    const fingerCount = await zk.getFingerCount(dUser.uid);
                    if (fingerCount === 0) {
                        report.needsEnrollment.push({ zkId, name: fullName });
                        console.log(`[Reconcile] ⚠ "${fullName}" (UID=${dUser.uid}) has 0 fingerprints — needs enrollment.`);
                    }
                } catch {
                    // getFingerCount is best-effort; non-critical
                }
            }
        }

        // Skip reconcile-specific updates in dry-run — the device state was not changed
        if (!dryRun) {
            // NOTE: We intentionally do NOT set isActive here.
            // The healthCheckScheduler is the single source of truth for device connectivity.
            await prisma.device.update({ where: { id: deviceId }, data: { lastReconciledAt: new Date(), updatedAt: new Date() } });

            // Fire async fingerprint queueing for users that were newly pushed or found missing fingerprints
            if (report.needsEnrollment.length > 0) {
                console.log(`[Reconcile] 🔄 Queuing fingerprint pulls for ${report.needsEnrollment.length} user(s)...`);
                for (const { zkId } of report.needsEnrollment) {
                    try {
                        const emp = await prisma.employee.findUnique({ where: { zkId }, select: { id: true } });
                        if (!emp) continue;

                        const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
                            where: { employeeId: emp.id },
                            distinct: ['fingerIndex']
                        });

                        for (const { fingerIndex } of enrollments) {
                            await enqueueFingerprintPull(deviceId, { zkId, employeeId: emp.id, fingerIndex });
                        }
                    } catch (err: unknown) {
                        console.error(`[Reconcile] Failed to queue fingerprint for zkId ${zkId}:`, zkErrMsg(err));
                    }
                }
            }

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
        try { await zk.disconnect(); } catch { /* ignore */ }
        releaseDeviceLock(deviceId);
    }
};





