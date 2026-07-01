import { prisma } from '../../../shared/lib/prisma';
import { ZKDriver } from '../../../shared/lib/zk-driver';
import { processAttendanceLogs } from '../../attendance/attendance.service';
import deviceEmitter from '../../../shared/events/deviceEmitter';
import { audit } from '../../../shared/lib/auditLogger';
import { auditBatch } from '../../../shared/lib/auditHelpers';
import { getDriver, connectWithRetry, zkErrMsg } from './zk-connection.service';
import { tryAcquireDeviceLock, releaseDeviceLock } from './zk-lock.service';

function getAuthMethodFromVerifyMode(verifyMode: number): string {
    switch (verifyMode) {
        case 1:
            return 'FINGERPRINT';
        case 2:
            return 'CARD';
        case 3:
            return 'PASSWORD';
        default:
            return 'FINGERPRINT';
    }
}

export interface SyncZkDataResult {
    success: boolean;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'NO_DEVICES';
    message: string;
    totalDevices: number;
    successfulDevices: number;
    failedDevices: Array<{ id: number; name: string; error: string }>;
    newLogs: number;
}

const convertPHTtoUTC = (deviceDate: Date): Date => {
    // Extract what the device screen actually printed (which was mapped blindly to local OS components)
    const year = deviceDate.getFullYear();
    const month = deviceDate.getMonth();
    const date = deviceDate.getDate();
    const hours = deviceDate.getHours();
    const minutes = deviceDate.getMinutes();
    const seconds = deviceDate.getSeconds();

    // Map those raw screen components to a UTC string format, then subtract exactly 8 hours.
    const rawUTC = new Date(Date.UTC(year, month, date, hours, minutes, seconds));
    return new Date(rawUTC.getTime() - (8 * 60 * 60 * 1000));
};

async function syncSingleDevice(dbDevice: {
    id: number;
    name: string;
    ip: string;
    port: number;
    isActive: boolean;
    syncEnabled: boolean;
}, clearLogsOnSuccess = false): Promise<{ deviceId: number; newLogs: number; skipped: boolean; error?: string }> {
    if (dbDevice.syncEnabled === false) {
        console.debug(`[ZK] Skipping "${dbDevice.name}" — sync is disabled.`);
        return { deviceId: dbDevice.id, newLogs: 0, skipped: true };
    }

    if (dbDevice.isActive === false) {
        console.debug(`[ZK] Skipping "${dbDevice.name}" — device is currently offline.`);
        return { deviceId: dbDevice.id, newLogs: 0, skipped: true };
    }

    if (!tryAcquireDeviceLock(dbDevice.id)) {
        console.debug(`[ZK] Cron sync skipped for "${dbDevice.name}" — device is busy.`);
        return { deviceId: dbDevice.id, newLogs: 0, skipped: true };
    }

    // 1. Read the latest sync watermark for this device.
    const deviceRecord = await prisma.device.findUnique({
        where: { id: dbDevice.id },
        select: { lastSyncedAt: true },
    });

    // 2. Set watermark fallback (48 hours) to prevent gaps.
    const FALLBACK_WINDOW_MS = 48 * 60 * 60 * 1000;
    const watermark: Date = deviceRecord?.lastSyncedAt ?? new Date(Date.now() - FALLBACK_WINDOW_MS);

    console.log(`[ZK] "${dbDevice.name}" watermark: ${watermark.toISOString()} (${deviceRecord?.lastSyncedAt ? 'from DB' : '48h fallback'})`);

    const zk = getDriver(dbDevice.ip, dbDevice.port);
    try {
        console.log(`[ZK] Syncing device "${dbDevice.name}" at ${dbDevice.ip}:${dbDevice.port}...`);
        // Use 30s cron interval as the retry mechanism.
        await connectWithRetry(zk, 0);

        // Optional: Get serial info (UDP).
        try {
            const info = await zk.getInfo();
            if (!info?.serialNumber || info.serialNumber === 'N/A') {
                console.warn(`[ZK] "${dbDevice.name}" Serial N/A — UDP may be blocked. Device may be slow.`);
            } else {
                console.log(`[ZK] Connected! Serial: ${info.serialNumber}`);
            }
        } catch {
            console.warn(`[ZK] getInfo() failed (UDP may be blocked) — continuing with TCP only.`);
        }

        const allLogs = await zk.getLogs();

        // 3. Filter and sort logs by watermark.
        const logs = allLogs
            .filter((log) => {
                const logUTC = convertPHTtoUTC(log.recordTime);
                return logUTC > watermark;
            })
            .sort((a, b) =>
                convertPHTtoUTC(a.recordTime).getTime() -
                convertPHTtoUTC(b.recordTime).getTime()
            );

        console.log(`[ZK] Fetched ${allLogs.length} total logs, filtered to ${logs.length} logs newer than watermark.`);

        // Track insertion progress to advance the watermark.
        let latestInsertedTimestamp: Date | null = null;
        let newCount = 0;
        for (const log of logs) {
            try {
                const zkUserId = parseInt(log.deviceUserId);
                const utcTime = convertPHTtoUTC(log.recordTime);

                if (isNaN(zkUserId)) {
                    if (latestInsertedTimestamp === null || utcTime > latestInsertedTimestamp) {
                        latestInsertedTimestamp = utcTime;
                    }
                    continue;
                }

                // 1. Find Employee by zkId — SKIP if not in DB (prevents ghost re-creation)
                const employee = await prisma.employee.findUnique({
                    where: { zkId: zkUserId }
                });

                if (!employee) {
                    // This zkId was removed from the DB intentionally. Do not re-create.
                    console.log(`[ZK] Skipping unknown zkId ${zkUserId} — not in database`);
                    if (latestInsertedTimestamp === null || utcTime > latestInsertedTimestamp) {
                        latestInsertedTimestamp = utcTime;
                    }
                    continue;
                }

                // 2. Check for exact duplicate in DB (same timestamp + same employee)
                const exists = await prisma.attendanceLog.findUnique({
                    where: {
                        timestamp_employeeId: {
                            timestamp: utcTime,
                            employeeId: employee.id
                        }
                    }
                });

                if (exists) {
                    // Exact-timestamp duplicate — log it and skip
                    void audit({
                        action: 'DUPLICATE_PUNCH',
                        level: 'WARN',
                        entityType: 'Attendance',
                        entityId: employee.id,
                        performedBy: employee.id,
                        source: 'device-sync',
                        details: `Duplicate punch detected for ${employee.firstName} ${employee.lastName} (exact timestamp match)`,
                        metadata: { employeeId: employee.id, zkId: zkUserId, diffSeconds: 0, deviceId: dbDevice.id }
                    });
                    if (latestInsertedTimestamp === null || utcTime > latestInsertedTimestamp) {
                        latestInsertedTimestamp = utcTime;
                    }
                    continue;
                }

                await prisma.attendanceLog.create({
                    data: {
                        timestamp: utcTime,  // Store UTC time
                        employeeId: employee.id,
                        status: log.status,
                        deviceId: dbDevice.id,
                        authMethod: getAuthMethodFromVerifyMode(log.verifyMode)
                    },
                });
                newCount++;

                // Update watermark tracker.
                if (latestInsertedTimestamp === null || utcTime > latestInsertedTimestamp) {
                    latestInsertedTimestamp = utcTime;
                }
            } catch (logErr) {
                console.error(`[ZK] Error processing log:`, logErr);
            }
        }

        // 4. Persist the new watermark.
        if (latestInsertedTimestamp !== null) {
            // Advance by 1ms so the next sync's strict '>' filter excludes this
            // exact timestamp and never re-processes the same log.
            const nextWatermark = new Date(latestInsertedTimestamp.getTime() + 1);
            await prisma.device.update({
                where: { id: dbDevice.id },
                data: { lastSyncedAt: nextWatermark, lastSyncStatus: 'SUCCESS', lastSyncError: null, lastPolledAt: new Date() },
            });
            console.log(`[ZK] "${dbDevice.name}" watermark advanced to ${nextWatermark.toISOString()}`);
        } else {
            await prisma.device.update({
                where: { id: dbDevice.id },
                data: { lastSyncStatus: 'SUCCESS', lastSyncError: null, lastPolledAt: new Date() }
            }).catch(() => { /* ignore */ });
        }

        // Log buffer clearing is handled by a separate maintenance job.
        // The DB watermark prevents duplicate imports.

        deviceEmitter.emit('device-sync-result', {
            id: dbDevice.id,
            lastSyncStatus: 'SUCCESS',
            lastSyncedAt: latestInsertedTimestamp || watermark,
            lastSyncError: null,
            lastPolledAt: new Date()
        });

        if (newCount > 0) {
            void auditBatch({
                action: 'DEVICE_SYNC',
                entityType: 'Device',
                entityId: dbDevice.id,
                source: 'cron',
                level: 'INFO',
                details: `Synced ${newCount} new logs from ${dbDevice.name}`
            }, {
                affectedCount: newCount,
                summary: `Synced ${newCount} logs from ${dbDevice.name}`,
                deviceName: dbDevice.name,
                newLogs: newCount
            });
        }

        if (clearLogsOnSuccess) {
            console.log(`[ZK] [LogBufferMaintenance] Safely clearing attendance logs on "${dbDevice.name}"...`);
            await zk.clearAttendanceLogs();
            console.log(`[ZK] [LogBufferMaintenance] ✓ "${dbDevice.name}" logs cleared.`);
        }

        console.log(`[ZK] Device "${dbDevice.name}" sync complete. ${newCount} new logs.`);
        return { deviceId: dbDevice.id, newLogs: newCount, skipped: false };

    } catch (deviceErr: unknown) {
        console.error(`[ZK] Error syncing "${dbDevice.name}" (${dbDevice.ip}): ${zkErrMsg(deviceErr)}`);

        // Record sync failure — intentionally omit lastPolledAt since a failed
        // sync does not confirm the device is reachable.
        await prisma.device.update({
            where: { id: dbDevice.id },
            data: { 
                lastSyncStatus: 'FAILED',
                lastSyncError: zkErrMsg(deviceErr),
            }
        }).catch(() => { /* ignore */ });

        deviceEmitter.emit('device-sync-result', {
            id: dbDevice.id,
            lastSyncStatus: 'FAILED',
            lastSyncedAt: watermark,
            lastSyncError: zkErrMsg(deviceErr),
            lastPolledAt: new Date()
        });

        void auditBatch({
            action: 'DEVICE_SYNC',
            entityType: 'Device',
            entityId: dbDevice.id,
            source: 'cron',
            level: 'ERROR',
            details: `Sync failed for ${dbDevice.name}: ${zkErrMsg(deviceErr)}`
        }, {
            affectedCount: 0,
            summary: `Sync failed: ${zkErrMsg(deviceErr)}`,
            deviceName: dbDevice.name,
            error: zkErrMsg(deviceErr)
        });

        return { deviceId: dbDevice.id, newLogs: 0, skipped: false, error: zkErrMsg(deviceErr) };
    } finally {
        try { await zk.disconnect(); } catch { /* ignore */ }
        releaseDeviceLock(dbDevice.id);
    }
}

export const syncZkData = async (): Promise<SyncZkDataResult> => {
    try {
        // Load all devices from DB.
        const dbDevices = await prisma.device.findMany({ orderBy: { id: 'asc' } });

        if (dbDevices.length === 0) {
            console.warn('[ZK] No devices found in DB — skipping sync.');
            return { 
                success: true, 
                status: 'NO_DEVICES', 
                message: 'No devices configured', 
                totalDevices: 0, 
                successfulDevices: 0, 
                failedDevices: [], 
                newLogs: 0 
            };
        }

        // Run all device syncs in parallel.
        const results = await Promise.allSettled(
            dbDevices.map(dbDevice => syncSingleDevice(dbDevice))
        );

        let totalNewLogs = 0;
        let successfulDevices = 0;
        const failedDevices: Array<{ id: number; name: string; error: string }> = [];

        results.forEach((result, index) => {
            const dbDevice = dbDevices[index];
            if (result.status === 'fulfilled') {
                const deviceResult = result.value;
                totalNewLogs += deviceResult.newLogs;
                if (deviceResult.error) {
                    failedDevices.push({ id: dbDevice.id, name: dbDevice.name, error: deviceResult.error });
                } else if (!deviceResult.skipped) {
                    successfulDevices++;
                }
            } else {
                failedDevices.push({ id: dbDevice.id, name: dbDevice.name, error: String(result.reason) });
                console.error('[ZK] Unexpected rejection in syncSingleDevice:', result.reason);
            }
        });

        // Always process attendance logs — even when no new device logs were imported this tick.
        // If a previous tick imported logs but processAttendanceLogs() partially failed,
        // those AttendanceLogs sit orphaned with no matching Attendance record until this
        // function is called again. Removing the gate ensures every tick retries any unprocessed
        // logs from within the rolling 48-hour scan window. processAttendanceLogs() is fully
        // idempotent: duplicate creates are caught by the P2002 handler and skipped safely.
        console.log(`[ZK] Processing attendance logs (${totalNewLogs} new this tick)...`);
        await processAttendanceLogs();

        const activeDevicesCount = dbDevices.filter(d => d.syncEnabled && d.isActive).length;
        
        let status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS';
        if (failedDevices.length > 0) {
            status = successfulDevices > 0 ? 'PARTIAL' : 'FAILED';
        }

        return { 
            success: status !== 'FAILED',
            status, 
            message: `Synced ${successfulDevices}/${activeDevicesCount} active devices.`,
            totalDevices: activeDevicesCount,
            successfulDevices,
            failedDevices,
            newLogs: totalNewLogs
        };

    } catch (error: unknown) {
        console.error('[ZK] syncZkData fatal error:', zkErrMsg(error));
        return { 
            success: false, 
            status: 'FAILED',
            message: `Sync Error: ${zkErrMsg(error)}`,
            totalDevices: 0,
            successfulDevices: 0,
            failedDevices: [],
            newLogs: 0
        };
    }
    // NOTE: No top-level releaseDeviceLock() here — each device releases its own lock
};

export interface SyncZkTimeResult {
    success: boolean;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'NO_DEVICES';
    message: string;
    totalDevices: number;
    successfulDevices: number;
    failedDevices: Array<{ id: number; name: string; error: string }>;
}

export const syncAllDeviceClocks = async (): Promise<SyncZkTimeResult> => {
    const activeDevices = await prisma.device.findMany({
        where: { isActive: true, syncEnabled: true }
    });

    if (activeDevices.length === 0) {
        console.log('[ClockSync] No active devices found.');
        return {
            success: true,
            status: 'NO_DEVICES',
            message: 'No devices configured',
            totalDevices: 0,
            successfulDevices: 0,
            failedDevices: []
        };
    }

    console.log(`[ClockSync] Syncing time on ${activeDevices.length} device(s)...`);

    let successfulDevices = 0;
    const failedDevices: Array<{ id: number; name: string; error: string }> = [];

    for (const device of activeDevices) {
        // Use non-blocking lock — skip this device if already busy with attendance sync or enrollment
        if (!tryAcquireDeviceLock(device.id)) {
            console.warn(`[ClockSync] Skipping "${device.name}" — device busy.`);
            failedDevices.push({ id: device.id, name: device.name, error: 'Device is busy with another task' });
            continue;
        }
        try {
            const zk = getDriver(device.ip, device.port || 4370);
            await zk.connect();
            try {
                const nowUTC = new Date();
                await zk.setTime(nowUTC);
                console.log(`[ClockSync] ✓ "${device.name}" (${device.ip}) — time set to PHT`);
                successfulDevices++;
            } finally {
                await zk.disconnect();
            }
        } catch (err: unknown) {
            console.warn(`[ClockSync] ✗ "${device.name}" (${device.ip}) — failed: ${zkErrMsg(err)}`);
            failedDevices.push({ id: device.id, name: device.name, error: zkErrMsg(err) });
        } finally {
            releaseDeviceLock(device.id);
        }
    }

    console.log('[ClockSync] Done.');

    let status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS';
    if (failedDevices.length > 0) {
        status = successfulDevices > 0 ? 'PARTIAL' : 'FAILED';
    }

    return {
        success: status !== 'FAILED',
        status,
        message: `Synced time on ${successfulDevices}/${activeDevices.length} active devices.`,
        totalDevices: activeDevices.length,
        successfulDevices,
        failedDevices
    };
};

export const clearAllDeviceLogBuffers = async (): Promise<{
    clearedDevices: number;
    failedDevices: Array<{ id: number; name: string; error: string }>;
}> => {
    const activeDevices = await prisma.device.findMany({
        where: { isActive: true, syncEnabled: true },
        select: { id: true, name: true, ip: true, port: true },
        orderBy: { id: 'asc' },
    });

    if (activeDevices.length === 0) {
        console.log('[LogBufferMaintenance] No active devices found — nothing to clear.');
        return { clearedDevices: 0, failedDevices: [] };
    }

    console.log(`[LogBufferMaintenance] Safe clearing log buffers on ${activeDevices.length} device(s)...`);

    let clearedDevices = 0;
    const failedDevices: Array<{ id: number; name: string; error: string }> = [];

    for (const device of activeDevices) {
        console.log(`[LogBufferMaintenance] Initiating pre-clear sync and clear on "${device.name}"...`);
        // Force sync and clear within a single lock/connection session
        const syncResult = await syncSingleDevice({
            id: device.id,
            name: device.name,
            ip: device.ip,
            port: device.port,
            isActive: true,
            syncEnabled: true
        }, true); // clearLogsOnSuccess = true

        if (syncResult.error) {
            console.error(`[LogBufferMaintenance] ✗ Safe clear failed for "${device.name}": ${syncResult.error}`);
            failedDevices.push({ id: device.id, name: device.name, error: syncResult.error });
        } else if (syncResult.skipped) {
            console.warn(`[LogBufferMaintenance] ⚠ Safe clear skipped for "${device.name}" (device busy or offline).`);
            failedDevices.push({ id: device.id, name: device.name, error: 'Device busy or offline' });
        } else {
            console.log(`[LogBufferMaintenance] ✓ "${device.name}" log buffer cleared safely.`);
            clearedDevices++;
        }
    }

    return { clearedDevices, failedDevices };
};



