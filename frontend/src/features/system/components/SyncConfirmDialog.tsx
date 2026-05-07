'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Play, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SyncActionType = 'data' | 'time' | null;

interface SyncConfirmDialogProps {
    type: SyncActionType;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    loading: boolean;
}

export function SyncConfirmDialog({ type, onOpenChange, onConfirm, loading }: SyncConfirmDialogProps) {
    const isData = type === 'data';
    const Icon = isData ? Play : Clock;

    return (
        <Dialog open={type !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-800">
                        <Icon className={`h-5 w-5 ${isData ? 'text-blue-600' : 'text-amber-600'}`} />
                        {isData ? 'Trigger Manual Data Sync?' : 'Trigger Manual Time Sync?'}
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                        {isData ? (
                            <>Are you sure you want to forcibly pull attendance logs from all devices right now?</>
                        ) : (
                            <>Are you sure you want to align all device clocks with the server time right now?</>
                        )}
                    </DialogDescription>
                    <div className="text-sm space-y-3 pt-2 text-slate-500">
                        <ul className="list-disc pl-5 space-y-1">
                            {isData ? (
                                <>
                                    <li>This operation will traverse every active ZKTeco device to check for new records.</li>
                                    <li>If you have many devices, this may temporarily increase network load.</li>
                                </>
                            ) : (
                                <>
                                    <li>This operation ensures punches remain chronologically accurate.</li>
                                    <li>It will overwrite the current HH:MM:SS on the hardware devices to strictly match this server.</li>
                                </>
                            )}
                        </ul>
                    </div>
                </DialogHeader>
                <DialogFooter className="mt-4 border-t border-slate-100 pt-4">
                    <Button variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault();
                            onConfirm();
                            onOpenChange(false);
                        }}
                        disabled={loading}
                        className={isData ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
                    >
                        {loading 
                            ? (isData ? 'Syncing Data...' : 'Aligning Clocks...') 
                            : (isData ? 'Yes, Sync Data' : 'Yes, Sync Time')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
