import React from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'
import { Device } from './DeviceConfigureModal'

interface DeviceDeleteConfirmModalProps {
    device: Device | null;
    deleting: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function DeviceDeleteConfirmModal({
    device,
    deleting,
    onClose,
    onConfirm
}: DeviceDeleteConfirmModalProps) {
    if (!device) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-100 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center px-6 pt-8 pb-6 border-b border-border bg-red-500/5">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4 ring-8 ring-red-500/5">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Delete Device?</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                        You are about to remove <strong className="text-foreground">{device.name}</strong> from the system database.
                    </p>
                </div>
                <div className="p-6 space-y-4 text-left">
                    <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-4 text-sm text-foreground space-y-3">
                        <p className="font-bold text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" /> Important Consequences:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-xs text-muted-foreground leading-relaxed">
                            <li>
                                <strong className="text-foreground">Database Records Deleted:</strong> All fingerprint enrollment metadata, RFID cards, sync queues, and exclusions associated with this device will be permanently cascade-deleted from the database.
                            </li>
                            <li>
                                <strong className="text-foreground">Physical Fingerprints Kept:</strong> The actual templates and users stored in the physical ZKTeco machine’s hardware memory <strong className="text-red-500 font-semibold">will not be deleted</strong>.
                            </li>
                            <li>
                                <strong className="text-foreground">History Preserved:</strong> Historical attendance logs from this device will be kept, but their device reference will be set to empty/null.
                            </li>
                            <li>
                                <strong className="text-foreground">Sync Risks:</strong> If this is your only device, the database will lose all backup fingerprint records, making future syncs impossible unless you re-enroll employees.
                            </li>
                        </ul>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                        This action cannot be automatically undone. Are you sure you want to proceed?
                    </p>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1 border-border" disabled={deleting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
                    >
                        {deleting 
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                            : <><Trash2 className="w-4 h-4" /> Yes, Delete Device</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}
