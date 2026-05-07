import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '../../shared/lib/prisma';
import { clearAllDeviceLogBuffers } from '../devices/zk';
import { audit } from '../../shared/lib/auditLogger';

type MaintenanceSchedule = 'daily' | 'weekly' | 'monthly';

export interface LogBufferMaintenanceStatus {
    isActive: boolean;
    enabled: boolean;
    schedule: MaintenanceSchedule;
    hourPHT: number;
    lastRunAt: Date | null;
    nextRunDescription: string;
}

/** Returns a formatted timestamp string for console logging (e.g. "11:15:30") */
function ts(): string {
    return new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
}

/**
 * Converts a schedule + hour into a node-cron expression.
 * All times are in PHT (Asia/Manila).
 *   - daily:   runs every day at the configured hour (e.g. "0 3 * * *")
 *   - weekly:  runs every Sunday at the configured hour (e.g. "0 3 * * 0")
 *   - monthly: runs on the 1st of every month at the configured hour (e.g. "0 3 1 * *")
 */
function buildCronExpression(schedule: MaintenanceSchedule, hour: number): string {
    const h = Math.min(Math.max(hour, 0), 23);
    switch (schedule) {
        case 'daily':   return `0 ${h} * * *`;
        case 'monthly': return `0 ${h} 1 * *`;
        case 'weekly':
        default:        return `0 ${h} * * 0`;
    }
}

class LogBufferMaintenanceScheduler {
    private cronTask: ScheduledTask | null = null;
    private running: boolean = false;
    private enabled: boolean = true;
    private schedule: MaintenanceSchedule = 'weekly';
    private hourPHT: number = 3;
    private lastRunAt: Date | null = null;

    /** Start the scheduler. Loads the current config immediately from the DB. */
    public async start(): Promise<void> {
        if (this.running) return;
        this.running = true;
        console.log(`[${ts()}] [LogBufferMaintenance] Starting scheduled device log buffer cleaner...`);
        await this.reloadConfigAndReset();
    }

    public stop(): void {
        this.running = false;
        this.stopCronTask();
        console.log(`[${ts()}] [LogBufferMaintenance] Stopped.`);
    }

    /** Called by system.controller after an admin updates SyncConfig. */
    public async reloadConfigAndReset(): Promise<void> {
        this.stopCronTask();

        if (!this.running) return;

        try {
            const config = await prisma.syncConfig.findUnique({ where: { id: 1 } });
            if (config) {
                this.enabled = config.logBufferMaintenanceEnabled;
                this.schedule = (config.logBufferMaintenanceSchedule as MaintenanceSchedule) ?? 'weekly';
                this.hourPHT = config.logBufferMaintenanceHour ?? 3;
            }
        } catch (err) {
            console.error(`[${ts()}] [LogBufferMaintenance] Error reading config:`, err);
        }

        if (!this.enabled) {
            console.log(`[${ts()}] [LogBufferMaintenance] Feature disabled — no cron task scheduled.`);
            return;
        }

        const expression = buildCronExpression(this.schedule, this.hourPHT);
        console.log(
            `[${ts()}] [LogBufferMaintenance] Scheduled — expression: "${expression}" ` +
            `(${this.schedule} at ${this.hourPHT}:00 PHT)`
        );

        this.cronTask = cron.schedule(expression, () => {
            this.run().catch(err =>
                console.error(`[${ts()}] [LogBufferMaintenance] Unexpected error during maintenance run:`, err)
            );
        }, { timezone: 'Asia/Manila' });
    }

    /**
     * Manually trigger a log-buffer clear.
     * Can be called from the admin UI via POST /api/system/clear-device-logs.
     */
    public async triggerNow(): Promise<{ success: boolean; message: string }> {
        console.log(`[${ts()}] [LogBufferMaintenance] Manual trigger invoked.`);
        return this.run();
    }

    public getStatus(): LogBufferMaintenanceStatus {
        const expression = buildCronExpression(this.schedule, this.hourPHT);
        const scheduleLabels: Record<MaintenanceSchedule, string> = {
            daily:   `Daily at ${this.hourPHT}:00 PHT`,
            weekly:  `Every Sunday at ${this.hourPHT}:00 PHT`,
            monthly: `1st of every month at ${this.hourPHT}:00 PHT`,
        };
        return {
            isActive: this.running && this.enabled,
            enabled: this.enabled,
            schedule: this.schedule,
            hourPHT: this.hourPHT,
            lastRunAt: this.lastRunAt,
            nextRunDescription: this.enabled
                ? scheduleLabels[this.schedule] ?? expression
                : 'Disabled',
        };
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private stopCronTask(): void {
        if (this.cronTask) {
            this.cronTask.stop();
            this.cronTask = null;
        }
    }

    private async run(): Promise<{ success: boolean; message: string }> {
        console.log(`[${ts()}] [LogBufferMaintenance] Running device log buffer maintenance...`);

        try {
            const result = await clearAllDeviceLogBuffers();

            this.lastRunAt = new Date();

            void audit({
                action: 'DEVICE_LOG_BUFFER_CLEAR',
                entityType: 'System',
                source: 'cron',
                level: result.failedDevices.length > 0 ? 'WARN' : 'INFO',
                details: `Log buffer maintenance complete — cleared ${result.clearedDevices} device(s), ${result.failedDevices.length} failed`,
                metadata: {
                    clearedDevices: result.clearedDevices,
                    failedDevices: result.failedDevices,
                    schedule: this.schedule,
                    hourPHT: this.hourPHT,
                },
            });

            const message =
                `Cleared ${result.clearedDevices} device(s).` +
                (result.failedDevices.length > 0
                    ? ` Failed: ${result.failedDevices.map((d: { name: string }) => d.name).join(', ')}`
                    : '');

            console.log(`[${ts()}] [LogBufferMaintenance] ✓ ${message}`);
            return { success: true, message };

        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`[${ts()}] [LogBufferMaintenance] ✗ Maintenance failed:`, errMsg);

            void audit({
                action: 'DEVICE_LOG_BUFFER_CLEAR',
                entityType: 'System',
                source: 'cron',
                level: 'ERROR',
                details: `Log buffer maintenance failed: ${errMsg}`,
            });

            return { success: false, message: errMsg };
        }
    }
}

export const logBufferMaintenanceScheduler = new LogBufferMaintenanceScheduler();


