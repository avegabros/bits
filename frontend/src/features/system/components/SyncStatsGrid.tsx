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
        <div className="flex flex-col lg:flex-row gap-4">
            {/* ── Stats ─────────────────────────────────────────── */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Current Interval */}
                <div className="bg-slate-50 rounded-lg px-3 py-2.5 transition-shadow hover:shadow-sm hover:bg-white border border-transparent hover:border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                        <Activity className="h-3 w-3" /> Interval
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-800 tracking-tight">
                            {formatInterval(status.intervalSec)}
                        </span>
                        {status.shiftAwareMode && status.currentMode === 'PEAK' && (
                            <Badge className="text-[9px] px-1.5 py-0 h-4 font-black bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                                PEAK
                            </Badge>
                        )}
                        {status.shiftAwareMode && status.currentMode === 'OFF-PEAK' && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-black border">
                                OFF-PEAK
                            </Badge>
                        )}
                        {!status.shiftAwareMode && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-bold text-slate-400 border-slate-200">
                                DEFAULT
                            </Badge>
                        )}
                    </div>
                    {status.shiftAwareMode && (
                        <div className="text-[10px] text-blue-500 font-bold mt-0.5">Shift-Aware Active</div>
                    )}
                </div>

                {/* Last Synchronized */}
                <div className="bg-slate-50 rounded-lg px-3 py-2.5 transition-shadow hover:shadow-sm hover:bg-white border border-transparent hover:border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                        <Clock className="h-3 w-3" /> Last Sync
                    </div>
                    <div className="text-sm font-bold text-slate-700">
                        {status.lastSyncAt
                            ? format(new Date(status.lastSyncAt), 'MMM d, HH:mm:ss')
                            : 'Never'
                        }
                    </div>
                </div>

                {/* Health Monitor */}
                <div className="bg-slate-50 rounded-lg px-3 py-2.5 transition-shadow hover:shadow-sm hover:bg-white border border-transparent hover:border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mb-1">
                        <HeartPulse className="h-3 w-3" /> Health Monitor
                    </div>
                    {status.healthCheck?.isActive ? (
                        <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-sm font-bold text-slate-700">Active</span>
                            <span className="text-[10px] text-slate-400 font-semibold">({formatInterval(status.healthCheck.intervalSec)})</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-slate-300" />
                            <span className="text-sm font-bold text-slate-400">Disabled</span>
                        </div>
                    )}
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {status.healthCheck?.isActive
                            ? `Last: ${status.healthCheck.lastCheckAt ? format(new Date(status.healthCheck.lastCheckAt), 'HH:mm:ss') : 'Pending...'}`
                            : 'Offline'
                        }
                    </div>
                </div>
            </div>

            {/* ── Action Buttons ─────────────────────────────────── */}
            <div className="flex flex-col sm:grid sm:grid-cols-3 lg:flex lg:flex-col gap-2 lg:w-44 shrink-0 w-full lg:w-auto">
                <Button
                    onClick={onManualSync}
                    disabled={syncing || syncingTime || !status.globalSyncEnabled}
                    size="sm"
                    className="flex-1 lg:flex-none text-xs font-bold h-8"
                >
                    {syncing ? (
                        <><Timer className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Syncing...</>
                    ) : (
                        <><Play className="h-3.5 w-3.5 mr-1.5" /> Sync Data Now</>
                    )}
                </Button>
                <Button
                    onClick={onManualTimeSync}
                    disabled={syncingTime || syncing || clearingLogs || !status.globalSyncEnabled}
                    variant="outline"
                    size="sm"
                    className="flex-1 lg:flex-none text-xs font-bold h-8"
                >
                    {syncingTime ? (
                        <><Timer className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Aligning...</>
                    ) : (
                        <><Clock className="h-3.5 w-3.5 mr-1.5" /> Sync Time Now</>
                    )}
                </Button>
                <Button
                    onClick={onManualClearLogs}
                    disabled={clearingLogs || syncing || syncingTime}
                    variant="outline"
                    size="sm"
                    className="flex-1 lg:flex-none text-xs font-bold h-8 border-red-200 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors duration-200"
                >
                    {clearingLogs ? (
                        <><Timer className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Clearing...</>
                    ) : (
                        <><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear Logs</>
                    )}
                </Button>
                {!status.globalSyncEnabled && (
                    <p className="text-[10px] text-slate-400 text-center font-medium mt-1 lg:text-left">
                        Enable global sync first
                    </p>
                )}
            </div>
        </div>
    );
}
