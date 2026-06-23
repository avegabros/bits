import React from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Check, Loader2, AlertTriangle } from 'lucide-react'
import { Device } from './DeviceConfigureModal'

interface DeviceReconcileModalProps {
    reconcileTarget: Device | null;
    reconcilingId: number | null;
    onClose: () => void;
    onReconcile: () => void;
}

export function DeviceReconcileModal({
    reconcileTarget,
    reconcilingId,
    onClose,
    onReconcile
}: DeviceReconcileModalProps) {
    if (!reconcileTarget) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-100 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center px-6 pt-8 pb-6 border-b border-border bg-secondary/20">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 ring-8 ring-primary/5">
                        <RefreshCw className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Confirm Device Reconcile</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        You are about to reconcile <strong className="text-foreground">{reconcileTarget.name}</strong>.
                    </p>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-secondary/40 border border-border rounded-xl p-4 text-sm text-foreground space-y-2 text-left">
                        <p><strong>This action will dynamically queue:</strong></p>
                        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                            <li>Push tasks for missing employees</li>
                            <li>Delete tasks for ghost users</li>
                            <li>Fingerprint pull tasks to resync missing templates from other terminals</li>
                        </ul>
                    </div>
                    
                    <div className="bg-amber-500/5 border border-amber-500/20 text-amber-800 dark:text-amber-400 rounded-xl p-3.5 text-xs space-y-1 text-left leading-relaxed">
                        <p className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Important Setup Tip:
                        </p>
                        <p className="text-muted-foreground">
                            Ensure the physical ZKTeco device has been cleared of any old or test user accounts before reconciliating. This prevents silent identity mismatches if old IDs overlap with active employees.
                        </p>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        All tasks run asynchronously in the background. Operations are fail-safe and retry automatically if the connection is interrupted.
                    </p>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1 border-border">
                        Cancel
                    </Button>
                    <Button
                        onClick={onReconcile}
                        disabled={reconcilingId === reconcileTarget.id}
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    >
                        {reconcilingId === reconcileTarget.id 
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Queueing...</>
                            : <><Check className="w-4 h-4" /> Start Reconcile</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}
