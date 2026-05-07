'use client';

import React from 'react';
import { Fingerprint, RadioTower, CheckCircle2, XCircle } from 'lucide-react';
import type { DeviceWithStatus } from '../hooks/useDashboardData';

export interface DeviceStatusWidgetProps {
    devices: DeviceWithStatus[];
    globalSyncEnabled: boolean;
    /** When true, show all devices (admin left panel). When false, show max 4 (HR right panel). */
    compact?: boolean;
}

export function DeviceStatusWidget({ devices, globalSyncEnabled, compact = false }: DeviceStatusWidgetProps) {
    const onlineDevices = devices.filter(d => d.online).length;
    const offlineDevices = devices.filter(d => !d.online).length;
    const displayDevices = compact ? devices.slice(0, 4) : devices;

    return (
        <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                    <RadioTower className="w-3.5 h-3.5 text-red-500" /> Devices
                    {!globalSyncEnabled && (
                        <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black border border-red-200">
                            SYNC PAUSED
                        </span>
                    )}
                </h2>
                <div className="flex gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{onlineDevices} on
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{offlineDevices} off
                    </span>
                </div>
            </div>
            <div className="p-2">
                {devices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 gap-1.5">
                        <Fingerprint className="w-6 h-6 text-slate-200" />
                        <p className="text-slate-400 text-sm font-semibold">No devices configured</p>
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? '' : 'lg:grid-cols-3'} gap-2`}>
                        {displayDevices.map(dev => (
                            <div
                                key={dev.id}
                                className={`rounded-lg border p-2 flex items-center gap-2 ${dev.online ? 'border-emerald-100 bg-emerald-50/30' : 'border-rose-100 bg-rose-50/30'}`}
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${dev.online ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                    <Fingerprint className={`w-3.5 h-3.5 ${dev.online ? 'text-emerald-600' : 'text-rose-500'}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 truncate leading-tight">{dev.name}</p>
                                    <p className="text-[10px] text-slate-500 font-mono">{dev.ip}:{dev.port}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {!dev.syncEnabled && (
                                        <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full leading-none" title="Sync disabled">
                                            Sync Off
                                        </span>
                                    )}
                                    {dev.online ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
