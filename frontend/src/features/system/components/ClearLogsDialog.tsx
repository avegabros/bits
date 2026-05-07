'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AlertOctagon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClearLogsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    clearingLogs: boolean;
}

export function ClearLogsDialog({ open, onOpenChange, onConfirm, clearingLogs }: ClearLogsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertOctagon className="h-5 w-5" />
                        Clear Device Logs Manually?
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                        Are you sure you want to <strong>clear the log buffers</strong> on all active ZKTeco devices right now?
                    </DialogDescription>
                    <div className="text-sm space-y-3 pt-2 text-slate-500">
                        <ul className="list-disc pl-5 space-y-1">
                            <li>This will permanently delete attendance records stored on the hardware devices itself.</li>
                            <li>Make sure a <strong>Sync Data</strong> operation has successfully transferred all recent logs to the server first.</li>
                            <li>To prevent data loss, this is normally automated to run during off-hours.</li>
                        </ul>
                    </div>
                </DialogHeader>
                <DialogFooter className="mt-4 border-t border-slate-100 pt-4">
                    <Button variant="outline" disabled={clearingLogs} onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault();
                            onConfirm();
                            onOpenChange(false);
                        }}
                        disabled={clearingLogs}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {clearingLogs ? 'Clearing...' : 'Yes, Clear Logs'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
