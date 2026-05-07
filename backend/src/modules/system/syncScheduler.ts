import { prisma } from '../../shared/lib/prisma';
import { syncZkData, SyncZkDataResult } from '../devices/zk';
import { audit } from '../../shared/lib/auditLogger';
import { isCurrentlyInPeakWindow } from '../shifts/shiftUtils';
import { processAttendanceLogs } from '../attendance/attendance.service';

/** Returns a formatted timestamp string for console logging (e.g. "11:15:30") */
function ts(): string {
    return new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
}

export interface SyncSchedulerStatus {
    isActive: boolean;
    intervalSec: number;
    lastSyncAt: Date | null;
    nextSyncAt: Date | null;
    shiftAwareMode: boolean;
    configUpdatedAt: Date | null;
    currentMode: 'PEAK' | 'OFF-PEAK' | 'DEFAULT';
}

class SyncScheduler {
    private timer: NodeJS.Timeout | null = null;
    private recoveryTimer: NodeJS.Timeout | null = null;
    private running: boolean = false;
    private lastSyncAt: Date | null = null;
    private nextSyncAt: Date | null = null;
    private currentIntervalSec: number = 30; // Default fallback
    private shiftAwareMode: boolean = false;
    private configUpdatedAt: Date | null = null;
    private currentMode: 'PEAK' | 'OFF-PEAK' | 'DEFAULT' = 'DEFAULT';

    /**
     * Start the background scheduler loop.
     * It immediately schedules the first tick, which loads the config and executes sync.
     */
    public start() {
        if (this.running) return;
        this.running = true;
        console.log(`[${ts()}] [SyncScheduler] Started background service`);
        
        // Schedule next sync tick immediately
        this.scheduleNextTick(0);

        // Schedule orphan safety-net immediately, and then every 5 minutes
        this.runOrphanRecovery().catch(err => console.error(`[${ts()}] [SyncScheduler] initial orphan recovery error:`, err));
        this.recoveryTimer = setInterval(() => {
            this.runOrphanRecovery().catch(err => console.error(`[${ts()}] [SyncScheduler] Orphan recovery error:`, err));
        }, 5 * 60 * 1000);
    }

    /**
     * Stop the background scheduler loop.
     * In-flight syncs will finish, but no new ticks will be scheduled.
     */
    public stop() {
        this.running = false;
        
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        
        if (this.recoveryTimer) {
            clearInterval(this.recoveryTimer);
            this.recoveryTimer = null;
        }
        
        this.nextSyncAt = null;
        console.log(`[${ts()}] [SyncScheduler] Stopped background service`);
    }

    /**
     * Get the current status of the scheduler for the Admin dashboard.
     */
    public getStatus(): SyncSchedulerStatus {
        return {
            isActive: this.running,
            intervalSec: this.currentIntervalSec,
            lastSyncAt: this.lastSyncAt,
            nextSyncAt: this.nextSyncAt,
            shiftAwareMode: this.shiftAwareMode,
            configUpdatedAt: this.configUpdatedAt,
            currentMode: this.currentMode,
        };
    }

    /**
     * Force an immediate sync (called by "Sync Now" button).
     * Does not interrupt the background schedule loop unless the background loop
     * overlaps with this, in which case the device locks (tryAcquireDeviceLock)
     * handle concurrency gracefully.
     */
    public async triggerNow(): Promise<{ success: boolean; pushed: number; result?: SyncZkDataResult }> {
        console.log(`[${ts()}] [SyncScheduler] Manual sync triggered`);
        try {
            const result = await syncZkData();
            this.lastSyncAt = new Date();
            
            // Note: triggerNow is typically called by the API which writes its own
            // audit log. However, returning the full result allows the API controller
            // to log the structured details.
            return { success: result.success, pushed: result.newLogs, result };
        } catch (error) {
            console.error(`[${ts()}] [SyncScheduler] Manual sync failed:`, error);
            return { success: false, pushed: 0 };
        }
    }

    /**
     * Safety net: detects device logs that were successfully imported but failed processing,
     * and forces a retry. This guarantees logs aren't lost if the primary sync cycle is interrupted.
     */
    private async runOrphanRecovery() {
        if (!this.running) return;
        try {
            // Find if there are any orphaned logs older than 5 minutes
            const cutoff = new Date(Date.now() - 5 * 60 * 1000);
            const orphanedCount = await prisma.attendanceLog.count({
                where: {
                    processedAt: null,
                    timestamp: { lte: cutoff }
                }
            });

            if (orphanedCount > 0) {
                console.warn(`[${ts()}] [SyncScheduler] Safety Net: Found ${orphanedCount} orphaned logs older than 5 minutes. Triggering recovery...`);
                await processAttendanceLogs();
            }
        } catch (err) {
            console.error(`[${ts()}] [SyncScheduler] Orphan recovery check failed:`, err);
        }
    }

    /**
     * Core loop: loads config, figures out interval, decides whether to sync,
     * performs sync if enabled, and then re-schedules itself.
     */
    public async reloadConfigAndReset() {
        if (!this.running) return;

        let intervalMs = 30000;
        try {
            const config = await prisma.syncConfig.findUnique({ where: { id: 1 } });
            if (config) {
                this.shiftAwareMode = config.shiftAwareSyncEnabled;
                this.configUpdatedAt = config.updatedAt;
                this.currentIntervalSec = config.defaultIntervalSec;
                intervalMs = Math.max(config.defaultIntervalSec * 1000, 5000);
            }
        } catch (error) {
            console.error(`[${ts()}] [SyncScheduler] Error reading config for reset:`, error);
        }

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        console.log(`[${ts()}] [SyncScheduler] Timer reset manually to ${intervalMs / 1000}s countdown due to config change`);
        this.scheduleNextTick(intervalMs);
    }

    private async tick() {
        // If we were stopped while waiting, abort
        if (!this.running) return;

        let intervalMs = 30000; // default 30s
        let globalEnabled = true;

        try {
            // Read config from DB for every tick to pick up changes instantly
            const config = await prisma.syncConfig.findUnique({ where: { id: 1 } });
            if (config) {
                globalEnabled = config.globalSyncEnabled;
                this.shiftAwareMode = config.shiftAwareSyncEnabled;
                this.configUpdatedAt = config.updatedAt;

                if (this.shiftAwareMode) {
                    // Shift-Aware Sync Logic
                    const activeShifts = await prisma.shift.findMany({ 
                        where: { isActive: true },
                        select: { startTime: true, endTime: true, workDays: true }
                    });

                    const isPeak = isCurrentlyInPeakWindow(activeShifts, config.shiftBufferMinutes);
                    if (isPeak) {
                        this.currentMode = 'PEAK';
                        this.currentIntervalSec = config.highFreqIntervalSec;
                    } else {
                        this.currentMode = 'OFF-PEAK';
                        this.currentIntervalSec = config.lowFreqIntervalSec;
                    }
                } else {
                    // Standard Logic
                    this.currentMode = 'DEFAULT';
                    this.currentIntervalSec = config.defaultIntervalSec;
                }
                
                intervalMs = Math.max(this.currentIntervalSec * 1000, 5000); // 5 sec minimum guard
            }
        } catch (error) {
            console.error(`[${ts()}] [SyncScheduler] Error reading config from DB, using fallback interval`, error);
        }

        // Only perform sync if globally enabled
        if (globalEnabled) {
            console.log(`[${ts()}] [SyncScheduler] Tick — syncing (interval: ${this.currentIntervalSec}s)`);
            try {
                const startTime = Date.now();
                // Call the actual ZKTeco sync function from zkServices
                const result = await syncZkData();
                this.lastSyncAt = new Date();
                const durationMs = Date.now() - startTime;

                console.log(`[${ts()}] [SyncScheduler] Sync finished — ${result.status} (${result.newLogs} logs, ${durationMs}ms)`);
                
                // Individual device logs are now handled in zkServices.ts
            } catch (error) {
                console.error(`[${ts()}] [SyncScheduler] Background sync failed:`, error);
            }
        } else {
            // Optional: log occasionally if skipped 
            // console.debug(`[${ts()}] [SyncScheduler] Skipped tick - globalSyncEnabled is false`);
        }

        // Schedule next execution
        console.log(`[${ts()}] [SyncScheduler] Next tick in ${intervalMs / 1000}s`);
        this.scheduleNextTick(intervalMs);
    }

    private scheduleNextTick(delayMs: number) {
        if (!this.running) return;
        
        this.timer = setTimeout(() => {
            this.tick().catch(err => console.error(`[${ts()}] [SyncScheduler] Tick error:`, err));
        }, delayMs);

        this.nextSyncAt = new Date(Date.now() + delayMs);
    }
}

// Export a singleton instance
export const syncScheduler = new SyncScheduler();


