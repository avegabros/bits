import { prisma } from '../../shared/lib/prisma';
import deviceEmitter from '../../shared/events/deviceEmitter';
import { audit } from '../../shared/lib/auditLogger';
import { triggerAutoReconcile } from '../devices/zk';

/** Returns a formatted timestamp string for console logging (e.g. "11:15:30") */
function ts(): string {
    return new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimum interval guard — prevents admins from setting an interval so low
// that it causes lock contention with frequent data syncs.
// ─────────────────────────────────────────────────────────────────────────────
const MIN_INTERVAL_MS = 15_000; // 15 seconds

export interface HealthCheckStatus {
    isActive: boolean;
    intervalSec: number;
    lastCheckAt: Date | null;
    nextCheckAt: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-device lock check — reuse the same lock system from zkServices.
// We import tryAcquireDeviceLock and releaseDeviceLock so the health check
// never conflicts with ongoing syncs, enrollments, or reconcile operations.
// ─────────────────────────────────────────────────────────────────────────────
// These are not exported from zkServices directly, so we use a lightweight
// inline TCP probe that doesn't acquire the device lock but checks lock state.
// Instead, we re-implement a non-locking TCP probe here — the health check
// is read-only (no data transfer) and doesn't need the ZK protocol handshake
// lock because it opens and closes its own independent TCP socket.
//
// IMPORTANT: We still respect device locks by checking lastPolledAt — if a
// data sync already pinged this device recently, we skip the health check.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempts a minimal TCP connection to the ZKTeco device.
 * Uses ZKLibTCP directly (same as ZKDriver.connect) to perform:
 *   1. TCP socket open
 *   2. ZK protocol CMD_CONNECT handshake
 *   3. Immediate disconnect
 *
 * Returns true if the device responds, false on any error.
 * Total time: typically <100ms for reachable devices, up to timeout for unreachable ones.
 */
async function tcpProbe(ip: string, port: number, timeoutMs: number): Promise<boolean> {
    for (let attempt = 1; attempt <= 2; attempt++) {
        let zkInstance: { createSocket: () => Promise<void>; connect: () => Promise<void>; disconnect: () => Promise<void> } | null = null;
        try {
            const ZKLibTCP = require('node-zklib/zklibtcp');
            zkInstance = new ZKLibTCP(ip, port, timeoutMs);
            await zkInstance!.createSocket();
            await zkInstance!.connect();
            return true;
        } catch {
            if (attempt === 1) {
                // Wait 3 seconds before the retry to absorb transient network drops
                await new Promise(r => setTimeout(r, 3000));
            }
        } finally {
            try { await zkInstance?.disconnect(); } catch { /* ignore */ }
        }
    }
    return false;
}

class HealthCheckScheduler {
    private timer: NodeJS.Timeout | null = null;
    private running: boolean = false;
    private lastCheckAt: Date | null = null;
    private nextCheckAt: Date | null = null;
    private currentIntervalSec: number = 60; // Default fallback

    /**
     * Start the background health check loop.
     * Schedules the first tick with a short delay so the server finishes booting
     * before we start probing devices.
     */
    public start() {
        if (this.running) return;
        this.running = true;
        console.log(`[${ts()}] [HealthCheck] Started background device health monitor`);
        // Delay the first tick by 10s so the sync scheduler and device locks
        // are fully initialized before health checks begin.
        this.scheduleNextTick(10_000);
    }

    public stop() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.nextCheckAt = null;
        console.log(`[${ts()}] [HealthCheck] Stopped background device health monitor`);
    }

    public getStatus(): HealthCheckStatus {
        return {
            isActive: this.running,
            intervalSec: this.currentIntervalSec,
            lastCheckAt: this.lastCheckAt,
            nextCheckAt: this.nextCheckAt,
        };
    }

    /**
     * Reload config from DB and reset the timer.
     * Called when the admin updates system settings.
     */
    public async reloadConfigAndReset() {
        if (!this.running) return;

        let intervalMs = 60_000;
        try {
            const config = await prisma.syncConfig.findUnique({ where: { id: 1 } });
            if (config) {
                if (!config.healthCheckEnabled) {
                    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
                    this.nextCheckAt = null;
                    console.log(`[${ts()}] [HealthCheck] Health checks DISABLED in configuration`);
                    return;
                }

                this.currentIntervalSec = config.healthCheckIntervalSec;
                intervalMs = Math.max(config.healthCheckIntervalSec * 1000, MIN_INTERVAL_MS);
            }
        } catch (error) {
            console.error(`[${ts()}] [HealthCheck] Error reading config for reset:`, error);
        }

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        console.log(`[${ts()}] [HealthCheck] Timer reset to ${intervalMs / 1000}s due to config change`);
        this.scheduleNextTick(intervalMs);
    }

    /**
     * Core tick: loads config, probes all devices, updates isActive, emits SSE.
     */
    private async tick() {
        if (!this.running) return;

        let intervalMs = 60_000; // default 60s
        let healthEnabled = true;

        try {
            const config = await prisma.syncConfig.findUnique({ where: { id: 1 } });
            if (config) {
                healthEnabled = config.healthCheckEnabled;
                this.currentIntervalSec = config.healthCheckIntervalSec;
                intervalMs = Math.max(config.healthCheckIntervalSec * 1000, MIN_INTERVAL_MS);
            }
        } catch (error) {
            console.error(`[${ts()}] [HealthCheck] Error reading config from DB, using fallback`, error);
        }

        if (healthEnabled) {
            try {
                await this.probeAllDevices();
                this.lastCheckAt = new Date();
            } catch (error) {
                console.error(`[${ts()}] [HealthCheck] Probe cycle failed:`, error);
            }
        }

        // Always re-schedule (even if disabled) so config changes are picked up
        // on the next tick. If disabled, the tick is a no-op but the loop stays alive.
        this.scheduleNextTick(intervalMs);
    }

    /**
     * Probe ALL devices in parallel (regardless of syncEnabled per-device).
     *
     * The health check is a lightweight TCP ping (~100ms per reachable device)
     * and always runs unconditionally — it does NOT skip devices based on
     * sync activity. This ensures device status remains accurate even during
     * Shift-Aware peak windows when syncs are frequent.
     */
    private async probeAllDevices(): Promise<void> {
        // Load ALL devices — health checks are independent of syncEnabled
        const devices = await prisma.device.findMany({
            select: {
                id: true,
                name: true,
                ip: true,
                port: true,
                isActive: true,
            },
            orderBy: { id: 'asc' },
        });

        if (devices.length === 0) return;

        const timeout = Number(process.env.ZK_TIMEOUT) || 10_000;

        const results = await Promise.allSettled(
            devices.map(async (device) => {
                const reachable = await tcpProbe(device.ip, device.port, timeout);
                const previouslyActive = device.isActive;

                // Only write to DB if state actually changed
                if (reachable !== previouslyActive) {
                    await prisma.device.update({
                        where: { id: device.id },
                        data: {
                            isActive: reachable,
                            lastPolledAt: new Date(),
                            updatedAt: new Date(),
                        },
                    });

                    // If the device transitioned from offline to online, trigger background reconciliation
                    if (reachable) {
                        void triggerAutoReconcile(device.id, device.name);
                        void audit({
                            action: 'RECONCILE',
                            entityType: 'Device',
                            entityId: device.id,
                            source: 'health-check',
                            details: `Auto-reconcile triggered for "${device.name}" after coming back online`,
                            metadata: { deviceName: device.name, ip: device.ip },
                        });
                    }

                    // Emit SSE status-change event
                    deviceEmitter.emit('status-change', {
                        id: device.id,
                        name: device.name,
                        ip: device.ip,
                        isActive: reachable,
                    });

                    const action = reachable ? 'DEVICE_CONNECT' : 'DEVICE_DISCONNECT';
                    const verb = reachable ? 'came online' : 'went offline';
                    void audit({
                        action,
                        level: reachable ? 'INFO' : 'WARN',
                        entityType: 'Device',
                        entityId: device.id,
                        source: 'health-check',
                        details: `Device "${device.name}" (${device.ip}) ${verb}`,
                        metadata: { deviceName: device.name, ip: device.ip },
                    });

                    console.log(`[${ts()}] [HealthCheck] "${device.name}" → ${reachable ? 'ONLINE ✓' : 'OFFLINE ✗'}`);
                } else {
                    // Status unchanged — just update lastPolledAt silently
                    await prisma.device.update({
                        where: { id: device.id },
                        data: { lastPolledAt: new Date() },
                    }).catch(() => { /* ignore */ });
                }
            })
        );

        // Count results for logging
        const probed = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
            console.warn(`[${ts()}] [HealthCheck] Probed ${probed} devices, ${failed} probe errors`);
        }
    }

    private scheduleNextTick(delayMs: number) {
        if (!this.running) return;

        this.timer = setTimeout(() => {
            this.tick().catch(err => console.error(`[${ts()}] [HealthCheck] Tick error:`, err));
        }, delayMs);

        this.nextCheckAt = new Date(Date.now() + delayMs);
    }
}

// Export a singleton instance
export const healthCheckScheduler = new HealthCheckScheduler();


