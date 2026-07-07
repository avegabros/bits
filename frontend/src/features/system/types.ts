// ── System Feature Types ────────────────────────────────────

export interface HealthCheckStatus {
    isActive: boolean;
    intervalSec: number;
    lastCheckAt: string | null;
    nextCheckAt: string | null;
}

export interface SyncStatus {
    isActive: boolean;
    intervalSec: number;
    lastSyncAt: string | null;
    nextSyncAt: string | null;
    shiftAwareMode: boolean;
    configUpdatedAt: string | null;
    globalSyncEnabled: boolean;
    currentMode?: 'PEAK' | 'OFF-PEAK' | 'DEFAULT';
    healthCheck?: HealthCheckStatus;
}

export interface SyncConfig {
    defaultIntervalSec: number;
    highFreqIntervalSec: number;
    lowFreqIntervalSec: number;
    shiftAwareSyncEnabled: boolean;
    shiftBufferMinutes: number;
    nightShiftBufferMinutes: number;
    autoTimeSyncEnabled: boolean;
    timeSyncIntervalSec: number;
    globalMinCheckoutMinutes: number;
    minShiftGapMinutes: number;
    healthCheckEnabled: boolean;
    healthCheckIntervalSec: number;
    logBufferMaintenanceEnabled: boolean;
    logBufferMaintenanceSchedule: 'daily' | 'weekly' | 'monthly';
    logBufferMaintenanceHour: number;
    dbBackupEnabled: boolean;
    dbBackupCron: string;
    dbBackupRetention: number;
    dbBackupCompress: boolean;
    lastBackupAt: string | null;
    lastBackupStatus: string | null;
    lastBackupError: string | null;
}

export interface Device {
    id: number;
    name: string;
    ip: string;
    isActive: boolean;
    syncEnabled: boolean;
    lastSyncedAt: string | null;
    lastPolledAt: string | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
}
