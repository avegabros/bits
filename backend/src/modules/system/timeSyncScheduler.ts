import { prisma } from '../../shared/lib/prisma';
import { syncAllDeviceClocks, SyncZkTimeResult } from '../devices/zk';
import { audit } from '../../shared/lib/auditLogger';

/** Returns a formatted timestamp string for console logging (e.g. "11:15:30") */
function ts(): string {
    return new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
}

class TimeSyncScheduler {
    private timer: NodeJS.Timeout | null = null;
    private running: boolean = false;
    private currentIntervalSec: number = 3600; // Default 1 hour fallback

    public start() {
        if (this.running) return;
        this.running = true;
        console.log(`[${ts()}] [TimeSyncScheduler] Started background clock-sync service`);
        this.scheduleNextTick(0);
    }

    public stop() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        console.log(`[${ts()}] [TimeSyncScheduler] Stopped background clock-sync service`);
    }

    public async reloadConfigAndReset() {
        if (!this.running) return;

        let intervalMs = 3600000;
        try {
            const config = await prisma.syncConfig.findUnique({ where: { id: 1 } });
            if (config) {
                // Feature explicitly disabled? 
                if (!config.autoTimeSyncEnabled) {
                    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
                    console.log(`[${ts()}] [TimeSyncScheduler] Auto time-sync is DISABLED in configuration`);
                    return; // Stays stopped until tick is triggered by Start or manual restart
                }
                
                this.currentIntervalSec = config.timeSyncIntervalSec;
                intervalMs = Math.max(config.timeSyncIntervalSec * 1000, 60000); // 1 min minimum guard
            }
        } catch (error) {
            console.error(`[${ts()}] [TimeSyncScheduler] Error reading config for reset:`, error);
        }

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        console.log(`[${ts()}] [TimeSyncScheduler] Timer reset manually to ${intervalMs / 1000}s countdown due to config change`);
        this.scheduleNextTick(intervalMs);
    }

    public async triggerNow(): Promise<{ success: boolean; message: string; result?: SyncZkTimeResult }> {
        console.log(`[${ts()}] [TimeSyncScheduler] Manual clock-sync triggered`);
        try {
            // syncAllDeviceClocks internally catches specific device errors and continues
            const result = await syncAllDeviceClocks();
            return { success: result.success, message: result.message, result };
        } catch (error) {
            console.error(`[${ts()}] [TimeSyncScheduler] Manual clock-sync failed:`, error);
            return { success: false, message: 'Failed to execute manual clock sync' };
        }
    }

    private async tick() {
        if (!this.running) return;

        let intervalMs = 3600000; // default 1 hour
        let autoEnabled = true;

        try {
            const config = await prisma.syncConfig.findUnique({ where: { id: 1 } });
            if (config) {
                autoEnabled = config.autoTimeSyncEnabled;
                this.currentIntervalSec = config.timeSyncIntervalSec;
                intervalMs = Math.max(config.timeSyncIntervalSec * 1000, 60000); // 1 min guard
            }
        } catch (error) {
            console.error(`[${ts()}] [TimeSyncScheduler] Error reading config from DB:`, error);
        }

        if (autoEnabled) {
            console.log(`[${ts()}] [TimeSyncScheduler] Tick — aligning all device clocks to server time`);
            try {
                // This updates ZK clocks cleanly, handled in zkServices
                await syncAllDeviceClocks();
            } catch (error) {
                console.error(`[${ts()}] [TimeSyncScheduler] Background clock-sync failed:`, error);
            }
            console.log(`[${ts()}] [TimeSyncScheduler] Next clock-sync in ${intervalMs / 1000}s`);
            this.scheduleNextTick(intervalMs);
        } else {
            console.log(`[${ts()}] [TimeSyncScheduler] Tick aborted — automated time sync is disabled.`);
            // When autoEnabled is false, the loop essentially halts until manually kickstarted or reloaded.
        }
    }

    private scheduleNextTick(delayMs: number) {
        if (!this.running) return;
        
        this.timer = setTimeout(() => {
            this.tick().catch(err => console.error(`[${ts()}] [TimeSyncScheduler] Tick error:`, err));
        }, delayMs);
    }
}

export const timeSyncScheduler = new TimeSyncScheduler();


