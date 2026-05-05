'use client';

import { Play, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { SyncResultData } from '../hooks/useSyncActions';

interface SyncResultModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    syncResult: SyncResultData | null;
    onRetry: () => void;
}

export function SyncResultModal({ open, onOpenChange, syncResult, onRetry }: SyncResultModalProps) {
    const isPartial = syncResult?.status === 'PARTIAL';
    const isSuccess = syncResult?.status === 'SUCCESS';
    const isTime = syncResult?.type === 'time';
    const prefix = isTime ? 'Time Sync' : 'Sync';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${isSuccess ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-red-600'}`}>
                        {isSuccess ? (
                            <><CheckCircle2 className="h-5 w-5" /> {prefix} Successful</>
                        ) : isPartial ? (
                            <><AlertTriangle className="h-5 w-5" /> {prefix} Partially Completed</>
                        ) : (
                            <><XCircle className="h-5 w-5" /> {prefix} Failed</>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {syncResult?.message}
                    </DialogDescription>
                </DialogHeader>

                {syncResult && syncResult.failedDevices.length > 0 && (
                    <div className="space-y-3 py-2">
                        <p className="text-sm font-medium">Failed Devices:</p>
                        <div className="space-y-2 max-h-[200px] overflow-auto">
                            {syncResult.failedDevices.map((device) => (
                                <div key={device.id} className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-3">
                                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-red-800">{device.name}</p>
                                        <p className="text-xs text-red-600 break-words">{device.error}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {syncResult && (syncResult.status === 'PARTIAL' || syncResult.status === 'SUCCESS') && (
                    <div className="py-2">
                        <p className="text-sm text-muted-foreground">
                            {syncResult.successfulDevices} of {syncResult.totalDevices} device(s) {isTime ? 'synchronized time' : 'synced'} successfully
                            {!isTime && syncResult.newLogs !== undefined && ` (${syncResult.newLogs} new logs)`}.
                        </p>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button onClick={() => { onOpenChange(false); onRetry(); }}>
                        <Play className="h-4 w-4 mr-2" /> Retry Sync
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
