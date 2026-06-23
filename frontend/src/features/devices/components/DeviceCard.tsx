import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Wifi, WifiOff, Server, MapPin, ListTodo, Clock, Check, AlertCircle, Loader2, Activity, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { Device } from './DeviceConfigureModal'

interface DeviceCardProps {
    device: Device;
    testResult?: { success: boolean; message: string; info?: any };
    isTesting: boolean;
    isToggling: boolean;
    isReconciling: boolean;
    onToggleSync: (device: Device) => void;
    onTest: (device: Device) => void;
    onConfirmReconcile: (device: Device) => void;
    onOpenEdit: (device: Device) => void;
    onDeleteClick: (device: Device) => void;
}

export function DeviceCard({
    device,
    testResult,
    isTesting,
    isToggling,
    isReconciling,
    onToggleSync,
    onTest,
    onConfirmReconcile,
    onOpenEdit,
    onDeleteClick
}: DeviceCardProps) {
    return (
        <Card className="bg-card border-border overflow-hidden">
            {/* Card Header */}
            <div className="flex items-start justify-between p-5 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${device.isActive ? 'bg-green-500/15' : 'bg-secondary/50'
                        }`}>
                        {device.isActive
                            ? <Wifi className="w-5 h-5 text-green-500" />
                            : <WifiOff className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">{device.name}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <Badge
                                variant="outline"
                                className={`text-[10px] ${device.isActive
                                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                    : 'bg-secondary/50 text-muted-foreground border-border'
                                    }`}
                            >
                                {device.isActive ? '● Online' : `○ Offline${device.lastPolledAt ? ` (${formatDistanceToNow(new Date(device.lastPolledAt))} ago)` : ''}`}
                            </Badge>
                            <Badge
                                variant="outline"
                                className={`text-[10px] ${device.syncEnabled
                                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    : 'bg-secondary/50 text-muted-foreground border-border'
                                    }`}
                            >
                                {device.syncEnabled ? '⟳ Sync On' : '⏸ Sync Off'}
                            </Badge>
                        </div>
                    </div>
                </div>
                {/* Sync On/Off Toggle */}
                <button
                    onClick={() => onToggleSync(device)}
                    disabled={isToggling}
                    title={device.syncEnabled ? 'Disable sync for this device' : 'Enable sync for this device'}
                    className={`relative flex items-center shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${device.syncEnabled
                            ? 'bg-primary'
                            : 'bg-secondary border border-border'
                        } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ${device.syncEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                </button>
            </div>

            {/* Device Info */}
            <div className="px-5 pb-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Server className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono font-medium text-foreground">
                        {device.ip}:{device.port}
                    </span>
                </div>
                {device.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{device.location}</span>
                    </div>
                )}
            </div>

            {/* Device Health Dashboard (Beautified Metrics) */}
            <div className="px-5 pb-4">
                <div className="bg-secondary/20 rounded-xl p-1.5 grid grid-cols-2 gap-1.5 border border-border mt-1">
                    
                    {/* Pending Sync */}
                    <div className="bg-card rounded-lg p-2.5 shadow-sm border border-border/40 flex flex-col justify-between group hover:border-border transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                <ListTodo className="w-3 h-3" /> Queue
                            </span>
                            {device.pendingTasks && device.pendingTasks > 0 ? (
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-border" />
                            )}
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className={`text-lg font-bold tracking-tight leading-none ${device.pendingTasks && device.pendingTasks > 0 ? 'text-orange-600' : 'text-foreground'}`}>
                                {device.pendingTasks || 0}
                            </span>
                            <span className="text-[9px] font-medium text-muted-foreground uppercase">Tasks</span>
                        </div>
                    </div>

                    {/* Last Sync */}
                    <div className="bg-card rounded-lg p-2.5 shadow-sm border border-border/40 flex flex-col justify-between group hover:border-border transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                <Clock className="w-3 h-3" /> Sync
                            </span>
                            {device.lastSyncedAt && (
                                <div className={`w-1.5 h-1.5 rounded-full ${device.lastSyncStatus === 'SUCCESS' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 'bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.6)]'}`} title={device.lastSyncStatus === 'SUCCESS' ? 'Success' : device.lastSyncError || 'Failed'} />
                            )}
                        </div>
                        {device.lastSyncedAt ? (
                            <div className="mt-0.5">
                                <span className="text-xs font-bold text-foreground tracking-tight truncate leading-none block" title={format(new Date(device.lastSyncedAt), 'MMM d, p')}>
                                    {formatDistanceToNow(new Date(device.lastSyncedAt), { addSuffix: true }).replace('about ', '')}
                                </span>
                            </div>
                        ) : (
                            <div className="mt-0.5">
                                <span className="text-xs font-bold text-muted-foreground tracking-tight leading-none block">Never</span>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Test Result */}
            {testResult && (
                <div className={`mx-5 mb-4 px-3 py-2.5 rounded-xl text-xs font-medium border ${testResult.success
                    ? 'bg-green-500/10 border-green-500/20 text-green-600'
                    : isTesting
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                        : 'bg-red-500/10 border-red-500/20 text-red-600'
                    }`}>
                    <div className="flex items-center gap-2">
                        {testResult.success
                            ? <Check className="w-3.5 h-3.5 shrink-0" />
                            : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                        <span>{testResult.message}</span>
                    </div>
                    {testResult.success && testResult.info && (
                        <div className="mt-1.5 pl-5 text-[10px] space-y-0.5 text-muted-foreground">
                            <p>Enrolled users: <span className="font-bold text-foreground">{testResult.info.userCount}</span></p>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="px-5 pb-5 flex flex-col gap-2">
                {/* Top Row: Test & Reconcile */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTest(device)}
                        disabled={isTesting || isToggling || isReconciling}
                        className="flex-1 gap-1.5 border-border text-xs"
                    >
                        {isTesting
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing...</>
                            : <><Activity className="w-3.5 h-3.5" /> Test</>}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onConfirmReconcile(device)}
                        disabled={isTesting || isToggling || isReconciling || !device.isActive}
                        title={!device.isActive ? "Device must be online to reconcile" : ""}
                        className="flex-1 gap-1.5 border-border text-xs text-primary hover:bg-primary/10 border-primary/20"
                    >
                        {isReconciling
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Queuing...</>
                            : <><RefreshCw className="w-3.5 h-3.5" /> Reconcile</>}
                    </Button>
                </div>

                <div className="flex gap-2 w-full">
                    {/* Edit */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenEdit(device)}
                        className="flex-1 gap-1.5 border-border text-sm"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        Configure
                    </Button>

                    {/* Delete */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteClick(device)}
                        className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 text-sm px-3 shrink-0"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>

            </div>
        </Card>
    );
}
