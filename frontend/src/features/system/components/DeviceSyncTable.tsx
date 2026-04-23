'use client';

import axios from 'axios';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { MonitorSmartphone, CloudOff, Wifi } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useState } from 'react';

interface Device {
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

interface DeviceSyncTableProps {
    devices: Device[];
    loading: boolean;
    onDevicesChange: React.Dispatch<React.SetStateAction<Device[]>>;
}

function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse bg-slate-200 rounded-lg ${className ?? ''}`} />;
}

export function DeviceSyncTable({ devices, loading, onDevicesChange }: DeviceSyncTableProps) {
    const { toast } = useToast();

    const [togglingId, setTogglingId] = useState<number | null>(null);

    const toggleDeviceSync = async (id: number, currentEnabled: boolean) => {
        if (togglingId !== null) return;
        setTogglingId(id);
        try {
            const res = await axios.patch(`/api/devices/${id}/toggle`, {}, { withCredentials: true });
            if (res.data.success) {
                onDevicesChange(prev => prev.map(d => d.id === id ? { ...d, syncEnabled: !currentEnabled } : d));
                toast({
                    title: `Device Sync ${!currentEnabled ? 'Enabled' : 'Disabled'}`,
                    description: `Cron sync will now ${!currentEnabled ? 'include' : 'skip'} this device.`,
                });
            }
        } catch (error: any) {
             toast({
                title: 'Toggle Failed',
                description: error.response?.data?.message || 'Failed to update device',
                variant: 'destructive',
            });
        } finally {
            setTogglingId(null);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="px-5 py-3 border-b border-slate-100">
                    <Skeleton className="h-5 w-52" />
                </div>
                <div className="p-5 space-y-3">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-100">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100">
                    <MonitorSmartphone className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                        Connected Devices
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold">
                        Per-device connection status and sync overrides
                    </p>
                </div>
                <div className="ml-auto">
                    <Badge variant="outline" className="text-[10px] font-bold text-slate-500 border-slate-200">
                        {devices.length} device{devices.length !== 1 ? 's' : ''}
                    </Badge>
                </div>
            </div>

            {/* Table */}
            <div
              className="overflow-x-auto scrollbar-table"
              tabIndex={0}
              role="region"
              aria-label="Device sync status table — scroll horizontally"
            >
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Device</th>
                            <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">IP Address</th>
                            <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Attendance Log</th>
                            <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Server Poll</th>
                            <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Include in Sync</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {devices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-10">
                                    <MonitorSmartphone className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                    <p className="text-sm text-slate-400 font-semibold">No devices found</p>
                                    <p className="text-xs text-slate-300 mt-0.5">Add devices from the Devices page to see them here.</p>
                                </td>
                            </tr>
                        ) : (
                            devices.map((device) => (
                                <tr key={device.id} className={`hover:bg-slate-50/50 transition-colors ${
                                    !device.isActive && device.syncEnabled
                                        ? 'bg-amber-50/40 hover:bg-amber-50/60'
                                        : ''
                                }`}>
                                    <td className="px-5 py-3">
                                        <span className="text-sm font-bold text-slate-800">{device.name}</span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="text-xs text-slate-500 font-mono">{device.ip}</span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex flex-col gap-1 items-start">
                                            {device.isActive ? (
                                                <Badge variant="outline" className="text-[10px] font-bold border-emerald-200 bg-emerald-50 text-emerald-700 gap-1 px-2 py-0.5">
                                                    <Wifi className="h-2.5 w-2.5" /> Online
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] font-bold border-red-200 bg-red-50 text-red-700 gap-1 px-2 py-0.5">
                                                    <CloudOff className="h-2.5 w-2.5" /> Offline
                                                </Badge>
                                            )}
                                            {device.lastSyncStatus === 'FAILED' && (
                                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-bold" title={device.lastSyncError || 'Sync failed'}>
                                                    Sync Failed
                                                </Badge>
                                            )}
                                            {!device.isActive && device.syncEnabled && (
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold border-amber-300 bg-amber-50 text-amber-700">
                                                    Unreachable
                                                </Badge>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="text-xs text-slate-500 font-medium">
                                            {device.lastSyncedAt ? format(new Date(device.lastSyncedAt), 'MMM d, HH:mm') : '—'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="text-xs text-slate-500 font-medium">
                                            {device.lastPolledAt ? format(new Date(device.lastPolledAt), 'MMM d, HH:mm') : '—'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <Switch
                                            checked={device.syncEnabled}
                                            onCheckedChange={() => toggleDeviceSync(device.id, device.syncEnabled)}
                                            disabled={togglingId === device.id}
                                            aria-label={`Toggle sync for ${device.name}`}
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
