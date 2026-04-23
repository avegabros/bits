'use client';

import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { SyncStatusCard } from './SyncStatusCard';
import { SyncConfigForm } from './SyncConfigForm';
import { DeviceSyncTable } from './DeviceSyncTable';
import {
    useDeviceStream,
    DeviceConnectedPayload,
    DeviceStatusPayload,
    DeviceSyncResultPayload
} from '@/features/devices/hooks/useDeviceStream';

import { SyncStatus, Device } from '../types';

/**
 * Client component that orchestrates the System dashboard.
 * Opens ONE shared SSE connection via useDeviceStream and passes
 * state + callbacks to child components as props.
 */
export function SystemDashboard() {
    // ── Sync Status state (for SyncStatusCard) ───────────────────────────
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);

    const fetchSyncStatus = useCallback(async () => {
        try {
            const res = await axios.get('/api/system/sync-status', { withCredentials: true });
            if (res.data.success) {
                setSyncStatus(res.data.status);
            }
        } catch (error) {
            console.error('Failed to fetch sync status', error);
        } finally {
            setStatusLoading(false);
        }
    }, []);

    // ── Device list state (for DeviceSyncTable) ──────────────────────────
    const [devices, setDevices] = useState<Device[]>([]);
    const [devicesLoading, setDevicesLoading] = useState(true);

    const fetchDevices = useCallback(async () => {
        try {
            const res = await axios.get('/api/devices', { withCredentials: true });
            if (res.data.success) {
                setDevices(res.data.devices);
            }
        } catch (error) {
            console.error('Failed to fetch devices', error);
        } finally {
            setDevicesLoading(false);
        }
    }, []);

    // ── Initial data load ────────────────────────────────────────────────
    useEffect(() => {
        fetchSyncStatus();
        fetchDevices();

        // Safety-net poll: 60s, not 10s, since SSE handles real-time
        const interval = setInterval(fetchSyncStatus, 60_000);
        return () => clearInterval(interval);
    }, [fetchSyncStatus, fetchDevices]);

    // ── SSE callbacks (one connection for the whole page) ────────────────
    const handleConnected = useCallback((payload: DeviceConnectedPayload) => {
        setDevices(payload.devices as Device[]);
        setDevicesLoading(false);
    }, []);

    const handleStatusChange = useCallback((payload: DeviceStatusPayload) => {
        setDevices(prev =>
            prev.map(d => d.id === payload.id ? { ...d, isActive: payload.isActive } : d)
        );
    }, []);

    const handleConfigUpdate = useCallback(() => {
        // Config was saved → re-fetch sync status so the dashboard shows new interval instantly
        fetchSyncStatus();
    }, [fetchSyncStatus]);

    const handleSyncResult = useCallback((payload: DeviceSyncResultPayload) => {
        setDevices(prev =>
            prev.map(d => d.id === payload.id ? {
                ...d,
                lastSyncStatus: payload.lastSyncStatus,
                lastSyncError: payload.lastSyncError,
                lastSyncedAt: payload.lastSyncedAt ?? d.lastSyncedAt,
                lastPolledAt: payload.lastPolledAt ?? d.lastPolledAt,
            } : d)
        );
    }, []);

    // ── Single SSE subscription ──────────────────────────────────────────
    useDeviceStream({
        onConnected: handleConnected,
        onStatusChange: handleStatusChange,
        onConfigUpdate: handleConfigUpdate,
        onSyncResult: handleSyncResult,
    });

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] lg:overflow-y-auto pb-32 pt-4 px-4 lg:px-8">
            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="shrink-0 border-l-4 border-slate-900 pl-4">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    System Configuration
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Monitor background sync activity, adjust polling intervals, and manage device connectivity.
                </p>
            </div>

            {/* ── Section 1: Sync Engine Status ─────────────────────────── */}
            <SyncStatusCard
                status={syncStatus}
                loading={statusLoading}
                onStatusRefresh={fetchSyncStatus}
            />

            {/* ── Section 2–4: Configuration ────────────────────────────── */}
            <SyncConfigForm />

            {/* ── Section 5: Device Table ───────────────────────────────── */}
            <DeviceSyncTable
                devices={devices}
                loading={devicesLoading}
                onDevicesChange={setDevices}
            />
        </div>
    );
}
