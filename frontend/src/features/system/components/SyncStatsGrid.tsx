'use client';

import { Activity, Clock, HeartPulse, Play, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

import { SyncStatus } from '../types';

interface SyncStatsGridProps {
    status: SyncStatus;
    syncing: boolean;
    syncingTime: boolean;
    clearingLogs: boolean;
    onManualSync: () => void;
    onManualTimeSync: () => void;
    onManualClearLogs: () => void;
}

function formatInterval(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60 > 0 ? `${sec % 60}s` : ''}`.trim();
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
}

export function SyncStatsGrid({
    status, syncing, syncingTime, clearingLogs,
    onManualSync, onManualTimeSync, onManualClearLogs,
}: SyncStatsGridProps) {
    return (
        <div className="flex flex-col lg:flex-row gap-5 items-stretch">
            {/* ── Stats Cards ───────────────────────────────────── */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Current Interval */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 hover:shadow-md hover:bg-white hover:border-slate-300 transition-all duration-300 flex flex-col justify-between min-h-[105px]">
                    <div className="text-[10px] text-slate-700 font-extrabold uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <div className="w-5 h-5 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                            <Activity className="h-3 w-3" />
                        </div>
                        Interval
                    </div>
                    <div className="flex items-baseline gap-2 mt-auto">
                        <span className="text-xl font-black text-slate-800 tracking-tight leading-none">
                            {formatInterval(status.intervalSec)}
                        </span>
                        {status.shiftAwareMode ? (
                            status.currentMode === 'PEAK' ? (
                                <Badge className="text-[9px] px-1.5 py-0 h-4.5 font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shrink-0">
                                    PEAK
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4.5 font-bold shrink-0">
                                    OFF-PEAK
                                </Badge>
                            )
                        ) : (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4.5 font-bold text-slate-700 border-slate-300 shrink-0">
                                DEFAULT
                            </Badge>
                        )}
                    </div>
                    {status.shiftAwareMode && (
                        <div className="text-[9px] text-blue-600 font-bold mt-1.5">Shift-Aware Active</div>
                    )}
                </div>

                {/* Last Synchronized */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 hover:shadow-md hover:bg-white hover:border-slate-300 transition-all duration-300 flex flex-col justify-between min-h-[105px]">
                    <div className="text-[10px] text-slate-700 font-extrabold uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <div className="w-5 h-5 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
                            <Clock className="h-3 w-3" />
                        </div>
                        Last Sync
                    </div>
                    <div className="text-sm font-black text-slate-800 tracking-tight leading-normal mt-auto">
                        {status.lastSyncAt
                            ? format(new Date(status.lastSyncAt), 'MMM d, HH:mm:ss')
                            : 'Never'
                        }
                    </div>
                </div>

                {/* Health Monitor */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 hover:shadow-md hover:bg-white hover:border-slate-300 transition-all duration-300 flex flex-col justify-between min-h-[105px]">
                    <div className="text-[10px] text-slate-700 font-extrabold uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                            <HeartPulse className="h-3 w-3" />
                        </div>
                        Health Monitor
                    </div>
                    <div className="mt-auto">
                        {status.healthCheck?.isActive ? (
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                <span className="text-sm font-black text-slate-800 leading-none">Active</span>
                                <span className="text-[10px] text-slate-700 font-bold shrink-0">({formatInterval(status.healthCheck.intervalSec)})</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <div className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
                                <span className="text-sm font-bold text-slate-700 leading-none">Disabled</span>
                            </div>
                        )}
                        <div className="text-[10px] text-slate-700 font-semibold mt-1">
                            {status.healthCheck?.isActive
                                ? `Last: ${status.healthCheck.lastCheckAt ? format(new Date(status.healthCheck.lastCheckAt), 'HH:mm:ss') : 'Pending...'}`
                                : 'Offline'
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Action Buttons ─────────────────────────────────── */}
            <div className="flex flex-col sm:grid sm:grid-cols-3 lg:flex lg:flex-col gap-2.5 w-full lg:w-48 shrink-0">
                <Button
                    onClick={onManualSync}
                    disabled={syncing || syncingTime || !status.globalSyncEnabled}
                    className="h-10 text-xs font-black shadow-sm"
                >
                    {syncing ? (
                        <><Timer className="h-4 w-4 mr-2 animate-spin shrink-0" /> Syncing...</>
                    ) : (
                        <><Play className="h-4 w-4 mr-2 shrink-0" /> Sync Data Now</>
                    )}
                </Button>
                <Button
                    onClick={onManualTimeSync}
                    disabled={syncingTime || syncing || clearingLogs || !status.globalSyncEnabled}
                    variant="outline"
                    className="h-10 text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
                >
                    {syncingTime ? (
                        <><Timer className="h-4 w-4 mr-2 animate-spin shrink-0" /> Aligning...</>
                    ) : (
                        <><Clock className="h-4 w-4 mr-2 shrink-0" /> Sync Time Now</>
                    )}
                </Button>
                <Button
                    onClick={onManualClearLogs}
                    disabled={clearingLogs || syncing || syncingTime}
                    variant="outline"
                    className="h-10 text-xs font-bold border-red-200 text-red-650 hover:bg-red-50 hover:border-red-300 shadow-sm transition-colors duration-200"
                >
                    {clearingLogs ? (
                        <><Timer className="h-4 w-4 mr-2 animate-spin shrink-0" /> Clearing...</>
                    ) : (
                        <><Trash2 className="h-4 w-4 mr-2 shrink-0" /> Clear Logs</>
                    )}
                </Button>
                {!status.globalSyncEnabled && (
                    <p className="text-[10px] text-slate-600 text-center font-bold mt-1 lg:text-left">
                        Enable global sync first
                    </p>
                )}
            </div>
        </div>
    );
}
