import { Request, Response } from 'express';
import { prisma } from '../../shared/lib/prisma';
import { syncScheduler } from './syncScheduler';
import { timeSyncScheduler } from './timeSyncScheduler';
import { healthCheckScheduler } from './healthCheckScheduler';
import { logBufferMaintenanceScheduler } from './logBufferMaintenanceScheduler';
import { backupScheduler } from './backupScheduler';
import { audit } from '../../shared/lib/auditLogger';
import { auditUpdate } from '../../shared/lib/auditHelpers';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import deviceEmitter from '../../shared/events/deviceEmitter';
import { SYNC_LIMITS, USER_LIMITS } from './system.constants';

const updateSyncConfigSchema = z.object({
    defaultIntervalSec: z.number()
        .min(SYNC_LIMITS.DEFAULT_INTERVAL_MIN_SEC, `Interval must be at least ${SYNC_LIMITS.DEFAULT_INTERVAL_MIN_SEC}s`)
        .max(SYNC_LIMITS.DEFAULT_INTERVAL_MAX_SEC, `Interval cannot exceed 24 hours (${SYNC_LIMITS.DEFAULT_INTERVAL_MAX_SEC}s)`)
        .optional(),
    highFreqIntervalSec: z.number()
        .min(SYNC_LIMITS.HIGH_FREQ_INTERVAL_MIN_SEC, `Interval must be at least ${SYNC_LIMITS.HIGH_FREQ_INTERVAL_MIN_SEC}s`)
        .max(SYNC_LIMITS.HIGH_FREQ_INTERVAL_MAX_SEC, `Interval cannot exceed 24 hours (${SYNC_LIMITS.HIGH_FREQ_INTERVAL_MAX_SEC}s)`)
        .optional(),
    lowFreqIntervalSec: z.number()
        .min(SYNC_LIMITS.LOW_FREQ_INTERVAL_MIN_SEC, `Low frequency interval must be at least ${SYNC_LIMITS.LOW_FREQ_INTERVAL_MIN_SEC}s`)
        .max(SYNC_LIMITS.LOW_FREQ_INTERVAL_MAX_SEC, `Low frequency interval cannot exceed 24 hours (${SYNC_LIMITS.LOW_FREQ_INTERVAL_MAX_SEC}s)`)
        .optional(),
    shiftAwareSyncEnabled: z.boolean().optional(),
    shiftBufferMinutes: z.number()
        .min(SYNC_LIMITS.SHIFT_BUFFER_MIN)
        .max(SYNC_LIMITS.SHIFT_BUFFER_MAX, `Shift buffer cannot exceed ${SYNC_LIMITS.SHIFT_BUFFER_MAX} min`)
        .optional(),
    autoTimeSyncEnabled: z.boolean().optional(),
    timeSyncIntervalSec: z.number()
        .min(SYNC_LIMITS.TIME_SYNC_INTERVAL_MIN_SEC, `Time sync interval must be at least ${SYNC_LIMITS.TIME_SYNC_INTERVAL_MIN_SEC}s`)
        .max(SYNC_LIMITS.TIME_SYNC_INTERVAL_MAX_SEC, `Time sync interval cannot exceed 24 hours (${SYNC_LIMITS.TIME_SYNC_INTERVAL_MAX_SEC}s)`)
        .optional(),
    healthCheckEnabled: z.boolean().optional(),
    healthCheckIntervalSec: z.number()
        .min(SYNC_LIMITS.HEALTH_CHECK_INTERVAL_MIN_SEC, `Health check interval must be at least ${SYNC_LIMITS.HEALTH_CHECK_INTERVAL_MIN_SEC}s`)
        .max(SYNC_LIMITS.HEALTH_CHECK_INTERVAL_MAX_SEC, `Health check interval cannot exceed 24 hours (${SYNC_LIMITS.HEALTH_CHECK_INTERVAL_MAX_SEC}s)`)
        .optional(),
    globalMinCheckoutMinutes: z.number()
        .min(SYNC_LIMITS.MIN_CHECKOUT_MIN, `Global Minimum Checkout must be at least ${SYNC_LIMITS.MIN_CHECKOUT_MIN} minutes`)
        .max(SYNC_LIMITS.MIN_CHECKOUT_MAX_MIN, `Global Minimum Checkout cannot exceed 12 hours (${SYNC_LIMITS.MIN_CHECKOUT_MAX_MIN} minutes)`)
        .optional(),
    minShiftGapMinutes: z.number()
        .min(SYNC_LIMITS.MIN_SHIFT_GAP_MIN, `Minimum Shift Gap must be at least ${SYNC_LIMITS.MIN_SHIFT_GAP_MIN} minutes`)
        .max(SYNC_LIMITS.MIN_SHIFT_GAP_MAX_MIN, `Minimum Shift Gap cannot exceed ${SYNC_LIMITS.MIN_SHIFT_GAP_MAX_MIN} minutes`)
        .optional(),
    logBufferMaintenanceEnabled: z.boolean().optional(),
    logBufferMaintenanceSchedule: z.enum(['daily', 'weekly', 'monthly']).optional(),
    logBufferMaintenanceHour: z.number().int().min(SYNC_LIMITS.MAINTENANCE_HOUR_MIN).max(SYNC_LIMITS.MAINTENANCE_HOUR_MAX, `Hour must be ${SYNC_LIMITS.MAINTENANCE_HOUR_MIN}-${SYNC_LIMITS.MAINTENANCE_HOUR_MAX}`).optional(),
    dbBackupEnabled: z.boolean().optional(),
    dbBackupCron: z.string().refine(val => {
        try {
            return require('node-cron').validate(val);
        } catch {
            return false;
        }
    }, { message: "Invalid cron expression" }).optional(),
    dbBackupRetention: z.number().int().min(1).max(12).optional(),
    dbBackupCompress: z.boolean().optional(),
});

// ─── GET /api/system/validation-limits ──────────────────────────────────────────
export const getValidationLimits = (_req: Request, res: Response) => {
    res.json({ success: true, limits: { ...SYNC_LIMITS, ...USER_LIMITS } });
};

// ─── GET /api/system/sync-status ──────────────────────────────────────────────
export const getSyncStatus = async (req: Request, res: Response) => {
    try {
        const config = await prisma.syncConfig.findUnique({ where: { id: 1 } });
        if (!config) {
            return res.status(404).json({ success: false, message: 'Sync config not found' });
        }

        const schedulerStatus = syncScheduler.getStatus();
        const healthStatus = healthCheckScheduler.getStatus();

        res.json({
            success: true,
            status: {
                ...schedulerStatus,
                globalSyncEnabled: config.globalSyncEnabled,
                healthCheck: healthStatus,
            }
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error fetching sync status:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch sync status', error: errMsg });
    }
};

// ─── GET /api/system/sync-config ──────────────────────────────────────────────
export const getSyncConfig = async (req: Request, res: Response) => {
    try {
        const config = await prisma.syncConfig.findUnique({
            where: { id: 1 },
            select: {
                defaultIntervalSec: true,
                highFreqIntervalSec: true,
                lowFreqIntervalSec: true,
                shiftAwareSyncEnabled: true,
                shiftBufferMinutes: true,
                autoTimeSyncEnabled: true,
                timeSyncIntervalSec: true,
                globalMinCheckoutMinutes: true,
                minShiftGapMinutes: true,
                healthCheckEnabled: true,
                healthCheckIntervalSec: true,
                logBufferMaintenanceEnabled: true,
                logBufferMaintenanceSchedule: true,
                logBufferMaintenanceHour: true,
                dbBackupEnabled: true,
                dbBackupCron: true,
                dbBackupRetention: true,
                dbBackupCompress: true,
                lastBackupAt: true,
                lastBackupStatus: true,
                lastBackupError: true,
            }
        });
        if (!config) {
            return res.status(404).json({ success: false, message: 'Sync config not found' });
        }
        res.json({ success: true, config });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error fetching sync config:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch sync config', error: errMsg });
    }
};

// ─── PUT /api/system/sync-config ──────────────────────────────────────────────
export const updateSyncConfig = async (req: Request, res: Response) => {
    try {
        const parsed = updateSyncConfigSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation failed', 
                errors: parsed.error.issues 
            });
        }

        const data = parsed.data;

        // Read current config for before/after comparison
        const previousConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
        if (!previousConfig) {
            return res.status(404).json({ success: false, message: 'Sync config not found' });
        }

        let warningMessage: string | null = null;
        if ((data.defaultIntervalSec !== undefined && data.defaultIntervalSec < 30) ||
            (data.highFreqIntervalSec !== undefined && data.highFreqIntervalSec < 30)) {
            warningMessage = "Intervals under 30s may cause high server load and device connection instability.";
        }

        const config = await prisma.syncConfig.update({
            where: { id: 1 },
            data: { ...data }
        });

        // Build human-readable change summaries
        const changes: { field: string; oldValue: string; newValue: string }[] = [];
        const trackableFields: Array<{ key: keyof typeof data; label: string; suffix?: string }> = [
            { key: 'defaultIntervalSec', label: 'Sync interval', suffix: 's' },
            { key: 'highFreqIntervalSec', label: 'Peak interval', suffix: 's' },
            { key: 'lowFreqIntervalSec', label: 'Off-peak interval', suffix: 's' },
            { key: 'shiftBufferMinutes', label: 'Shift buffer', suffix: ' min' },
            { key: 'shiftAwareSyncEnabled', label: 'Shift-aware sync' },
            { key: 'autoTimeSyncEnabled', label: 'Automated time sync' },
            { key: 'timeSyncIntervalSec', label: 'Time sync interval', suffix: 's' },
            { key: 'globalMinCheckoutMinutes', label: 'Global Minimum Checkout', suffix: ' mins'},
            { key: 'minShiftGapMinutes', label: 'Minimum Shift Gap', suffix: ' mins'},
            { key: 'healthCheckEnabled', label: 'Health check' },
            { key: 'healthCheckIntervalSec', label: 'Health check interval', suffix: 's' },
            { key: 'logBufferMaintenanceEnabled', label: 'Log buffer maintenance' },
            { key: 'logBufferMaintenanceSchedule', label: 'Log buffer maintenance schedule' },
            { key: 'logBufferMaintenanceHour', label: 'Log buffer maintenance hour' },
            { key: 'dbBackupEnabled', label: 'Database backups' },
            { key: 'dbBackupCron', label: 'Database backup cron' },
            { key: 'dbBackupRetention', label: 'Database backup retention' },
            { key: 'dbBackupCompress', label: 'Database backup compression' },
        ];

        for (const field of trackableFields) {
            const newVal = data[field.key];
            if (newVal === undefined) continue;
            const oldVal = previousConfig[field.key];
            if (oldVal !== newVal) {
                let formattedOldVal = typeof oldVal === 'boolean' ? (oldVal ? 'Enabled' : 'Disabled') : String(oldVal) + (field.suffix ?? '');
                let formattedNewVal = typeof newVal === 'boolean' ? (newVal ? 'Enabled' : 'Disabled') : String(newVal) + (field.suffix ?? '');
                changes.push({ field: field.label, oldValue: formattedOldVal, newValue: formattedNewVal });
            }
        }

        // Only log if something actually changed
        if (changes.length > 0) {
            void auditUpdate({
                entityType: 'System',
                entityId: 1,
                performedBy: req.user?.employeeId,
                source: 'admin-panel',
                level: warningMessage ? 'WARN' : 'INFO',
                details: `System configuration updated${warningMessage ? ' (with warnings)' : ''}`,
                correlationId: req.correlationId
            }, changes);
        }

        // Restart the scheduler countdown immediately so the new interval applies right now
        // instead of waiting for the old interval to finish its long sleep.
        syncScheduler.reloadConfigAndReset().catch(err => console.error('[System] Error resetting scheduler timer:', err));
        timeSyncScheduler.reloadConfigAndReset().catch(err => console.error('[System] Error resetting time sync scheduler timer:', err));
        healthCheckScheduler.reloadConfigAndReset().catch(err => console.error('[System] Error resetting health check scheduler timer:', err));
        logBufferMaintenanceScheduler.reloadConfigAndReset().catch(err => console.error('[System] Error resetting log buffer maintenance scheduler:', err));
        backupScheduler.reloadConfigAndReset().catch(err => console.error('[System] Error resetting database backup scheduler:', err));

        deviceEmitter.emit('config-update');

        res.json({ 
            success: true, 
            message: 'Sync configuration updated successfully', 
            warning: warningMessage,
            config 
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error updating sync config:', error);
        res.status(500).json({ success: false, message: 'Failed to update sync config', error: errMsg });
    }
};

// ─── POST /api/system/sync-toggle ─────────────────────────────────────────────
const toggleSyncSchema = z.object({
    enabled: z.boolean(),
});

export const toggleGlobalSync = async (req: Request, res: Response) => {
    try {
        const parsed = toggleSyncSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, message: 'Missing or invalid "enabled" field' });
        }
        const { enabled } = parsed.data;

        const config = await prisma.syncConfig.update({
            where: { id: 1 },
            data: { globalSyncEnabled: enabled }
        });

        const state = enabled ? 'enabled' : 'disabled';
        console.log(`[System] Global sync has been ${state}`);

        void auditUpdate({
            entityType: 'System',
            entityId: 1,
            performedBy: req.user?.employeeId,
            source: 'admin-panel',
            details: `Global sync was ${state}`,
            correlationId: req.correlationId
        }, [
            { field: 'Global Sync', oldValue: enabled ? 'Disabled' : 'Enabled', newValue: enabled ? 'Enabled' : 'Disabled' }
        ]);

        res.json({ success: true, message: `Global sync has been ${state}`, config });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error toggling global sync:', error);
        res.status(500).json({ success: false, message: 'Failed to toggle global sync', error: errMsg });
    }
};

// ─── POST /api/system/sync-now ────────────────────────────────────────────────
export const triggerManualSync = async (req: Request, res: Response) => {
    try {
        console.log(`[System] Manual sync triggered by user ${req.user?.employeeId || 'unknown'}`);
        
        // This runs the sync and waits for it to finish.
        // It relies on the internal tryAcquireDeviceLock inside syncZkData to avoid conflicts
        // with the background scheduler.
        const result = await syncScheduler.triggerNow();
        const syncResult = result.result;

        const level = syncResult?.status === 'SUCCESS' ? 'INFO' : (syncResult?.status === 'PARTIAL' ? 'WARN' : 'ERROR');

        void audit({
            action: 'MANUAL_SYNC',
            entityType: 'System',
            source: 'admin-panel',
            level,
            performedBy: req.user?.employeeId,
            details: syncResult?.message || (result.success ? 'Manual sync completed successfully' : 'Manual sync failed'),
            metadata: syncResult ? { 
                snapshot: {
                    'Sync Status': syncResult.status,
                    'Total Devices': String(syncResult.totalDevices),
                    'Successful Devices': String(syncResult.successfulDevices),
                    'New Logs Count': String(syncResult.newLogs),
                }
            } : undefined,
            correlationId: req.correlationId
        });

        if (result.success) {
            res.json({ success: true, message: 'Manual sync completed', data: syncResult });
        } else {
            res.status(200).json({ success: false, message: 'Manual sync completed with failures', data: syncResult });
        }
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error triggering manual sync:', error);
        res.status(500).json({ success: false, message: 'Failed to trigger manual sync', error: errMsg });
    }
};

// ─── POST /api/system/time-sync-now ──────────────────────────────────────────
export const triggerManualTimeSync = async (req: Request, res: Response) => {
    try {
        console.log(`[System] Manual time sync triggered by user ${req.user?.employeeId || 'unknown'}`);
        
        const result = await timeSyncScheduler.triggerNow();
        const syncResult = result.result;
        
        const level = syncResult?.status === 'SUCCESS' ? 'INFO' : (syncResult?.status === 'PARTIAL' ? 'WARN' : 'ERROR');

        void audit({
            action: 'MANUAL_SYNC',
            entityType: 'System',
            source: 'admin-panel',
            level,
            performedBy: req.user?.employeeId,
            details: syncResult?.message || (result.success ? 'Manual device clock sync completed' : 'Manual device clock sync failed'),
            metadata: syncResult ? {
                snapshot: {
                    'Target': 'time_sync',
                    'Sync Status': syncResult.status,
                    'Total Devices': String(syncResult.totalDevices),
                    'Successful Devices': String(syncResult.successfulDevices)
                }
            } : { snapshot: { 'Target': 'time_sync', 'Message': result.message } },
            correlationId: req.correlationId
        });

        if (result.success) {
            res.json({ success: true, message: result.message, data: syncResult });
        } else {
            res.status(200).json({ success: false, message: result.message, data: syncResult });
        }
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error triggering manual time sync:', error);
        res.status(500).json({ success: false, message: 'Failed to trigger manual time sync', error: errMsg });
    }
};

// ─── GET /api/system/logs ─────────────────────────────────────────────────────
export const getSystemLogs = async (req: Request, res: Response) => {
    try {
        const logs = await prisma.auditLog.findMany({
            where: { entityType: 'System' },
            orderBy: { timestamp: 'desc' },
            take: 50
        });
        res.json({ success: true, logs });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error fetching system logs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch logs', error: errMsg });
    }
};

// ─── POST /api/system/clear-device-logs ──────────────────────────────────────
/**
 * Manually trigger an immediate device log buffer clear on all active devices.
 * Useful when a device is approaching capacity before the scheduled window.
 */
export const triggerManualLogBufferClear = async (req: Request, res: Response) => {
    try {
        console.log(`[System] Manual log buffer clear triggered by user ${req.user?.employeeId || 'unknown'}`);

        const result = await logBufferMaintenanceScheduler.triggerNow();

        void audit({
            action: 'DEVICE_LOG_BUFFER_CLEAR',
            entityType: 'System',
            source: 'admin-panel',
            level: result.success ? 'INFO' : 'ERROR',
            performedBy: req.user?.employeeId,
            details: result.success
                ? `Manual log buffer clear completed: ${result.message}`
                : `Manual log buffer clear failed: ${result.message}`,
            correlationId: req.correlationId
        });

        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(500).json({ success: false, message: result.message });
        }
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error triggering manual log buffer clear:', error);
        res.status(500).json({ success: false, message: 'Failed to trigger log buffer clear', error: errMsg });
    }
};

// ─── GET /api/system/backups ───────────────────────────────────────────────────
export const getBackupsList = async (req: Request, res: Response) => {
    try {
        const backupDir = path.resolve(process.cwd(), process.env.BACKUP_PATH || 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('backup_') && (f.endsWith('.sql.gz') || f.endsWith('.sql')))
            .map(f => {
                const filePath = path.join(backupDir, f);
                const stats = fs.statSync(filePath);
                return {
                    filename: f,
                    size: stats.size,
                    createdAt: stats.birthtime || stats.mtime
                };
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Newest first

        // Query database size
        const [{ size }] = await prisma.$queryRawUnsafe<{ size: string }[]>(
            `SELECT pg_database_size(current_database())::text as size`
        );

        res.json({
            success: true,
            backups: files,
            dbSize: parseInt(size, 10)
        });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error fetching backups list:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch backups list', error: errMsg });
    }
};

// ─── GET /api/system/backups/download/:filename ────────────────────────────────
export const downloadBackup = async (req: Request, res: Response) => {
    try {
        const filename = req.params.filename as string;
        // Prevent directory traversal
        const safeRegex = /^backup_[a-zA-Z0-9-]+\.sql(?:\.gz)?$/;
        if (!safeRegex.test(filename)) {
            return res.status(400).json({ success: false, message: 'Invalid filename' });
        }

        const backupDir = path.resolve(process.cwd(), process.env.BACKUP_PATH || 'backups');
        const filePath = path.join(backupDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'Backup file not found' });
        }

        res.download(filePath, filename);
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error downloading backup:', error);
        res.status(500).json({ success: false, message: 'Failed to download backup', error: errMsg });
    }
};

// ─── POST /api/system/backups/trigger ──────────────────────────────────────────
export const triggerManualBackup = async (req: Request, res: Response) => {
    try {
        console.log(`[System] Manual database backup triggered by user ${req.user?.employeeId || 'unknown'}`);
        const result = await backupScheduler.triggerNow(req.user?.employeeId);

        if (result.success) {
            res.json({ success: true, message: result.message, filename: result.filename });
        } else {
            res.status(500).json({ success: false, message: result.message });
        }
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[System] Error triggering manual database backup:', error);
        res.status(500).json({ success: false, message: 'Failed to trigger database backup', error: errMsg });
    }
};
