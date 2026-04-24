'use client';

import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Server } from 'lucide-react';
import { useSyncActions } from '../hooks/useSyncActions';
import { SyncStatsGrid } from './SyncStatsGrid';
import { SyncResultModal } from './SyncResultModal';
import { ClearLogsDialog } from './ClearLogsDialog';
import { SyncConfirmDialog, SyncActionType } from './SyncConfirmDialog';
import { useState } from 'react';

import { SyncStatus } from '../types';

interface SyncStatusCardProps {
    status: SyncStatus | null;
    loading: boolean;
    /** Called after actions that change status (toggle, manual sync) so the parent can re-fetch */
    onStatusRefresh: () => void;
}

function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse bg-slate-200 rounded-lg ${className ?? ''}`} />;
}

export function SyncStatusCard({ status, loading, onStatusRefresh }: SyncStatusCardProps) {
    const [showClearLogsModal, setShowClearLogsModal] = useState(false);
    const [syncActionType, setSyncActionType] = useState<SyncActionType>(null);
    const {
        syncing, syncingTime, clearingLogs, toggling,
        syncResult, showResultModal, setShowResultModal,
        handleToggle, handleManualSync, handleManualTimeSync, handleManualClearLogs,
    } = useSyncActions({ onStatusRefresh });

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-40" />
                    <div className="ml-auto flex gap-2">
                        <Skeleton className="h-8 w-24 rounded-lg" />
                        <Skeleton className="h-8 w-24 rounded-lg" />
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-6 mt-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
            </div>
        );
    }

    if (!status) {
        return (
            <div className="bg-white rounded-xl border border-red-100 shadow-sm px-5 py-4">
                <p className="text-sm text-red-600 font-semibold">Failed to load sync status.</p>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
                {/* ── Header Row ───────────────────────────────────── */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-300 ${
                            status.globalSyncEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}>
                            <Server className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-800 tracking-tight">Sync Engine</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Background device synchronization service</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge
                            variant={status.globalSyncEnabled ? 'default' : 'destructive'}
                            className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 ${
                                status.globalSyncEnabled
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1.5'
                                    : ''
                            }`}
                        >
                            {status.globalSyncEnabled && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            )}
                            {status.globalSyncEnabled ? 'ACTIVE' : 'DISABLED'}
                        </Badge>
                        <Switch
                            checked={status.globalSyncEnabled}
                            onCheckedChange={handleToggle}
                            disabled={toggling}
                            className={toggling ? 'opacity-50 cursor-not-allowed' : ''}
                            aria-label="Toggle Global Sync"
                        />
                    </div>
                </div>

                {/* ── Stats + Actions ──────────────────────────────── */}
                <div className="px-5 py-3">
                    <SyncStatsGrid
                        status={status}
                        syncing={syncing}
                        syncingTime={syncingTime}
                        clearingLogs={clearingLogs}
                        onManualSync={() => setSyncActionType('data')}
                        onManualTimeSync={() => setSyncActionType('time')}
                        onManualClearLogs={() => setShowClearLogsModal(true)}
                    />
                </div>
            </div>

            <SyncConfirmDialog
                type={syncActionType}
                onOpenChange={(open) => !open && setSyncActionType(null)}
                onConfirm={() => {
                    if (syncActionType === 'data') handleManualSync();
                    else if (syncActionType === 'time') handleManualTimeSync();
                }}
                loading={syncActionType === 'data' ? syncing : syncingTime}
            />

            <ClearLogsDialog
                open={showClearLogsModal}
                onOpenChange={setShowClearLogsModal}
                onConfirm={handleManualClearLogs}
                clearingLogs={clearingLogs}
            />

            <SyncResultModal
                open={showResultModal}
                onOpenChange={setShowResultModal}
                syncResult={syncResult}
                onRetry={handleManualSync}
            />
        </>
    );
}
