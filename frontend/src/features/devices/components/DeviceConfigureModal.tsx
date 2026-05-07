import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioTower, X, AlertCircle, Loader2, Check, ChevronRight } from 'lucide-react'

export interface Device {
    id: number
    name: string
    ip: string
    port: number
    location: string | null
    isActive: boolean
    syncEnabled: boolean
    lastPolledAt?: string | null
    lastSyncedAt?: string | null
    lastSyncStatus?: string | null
    lastSyncError?: string | null
    lastReconciledAt?: string | null
    pendingTasks?: number
    createdAt: string
    updatedAt: string
}

export interface FormState {
    name: string
    ip: string
    port: string
    location: string
}

interface DeviceConfigureModalProps {
    isOpen: boolean;
    editingDevice: Device | null;
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    formError: string | null;
    saving: boolean;
    onClose: () => void;
    onSave: () => void;
}

export function DeviceConfigureModal({
    isOpen,
    editingDevice,
    form,
    setForm,
    formError,
    saving,
    onClose,
    onSave
}: DeviceConfigureModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-secondary/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <RadioTower className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground">{editingDevice ? 'Configure Device' : 'Add New Device'}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">ZKTeco biometric device settings</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-4">
                    {formError && (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {formError}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Device Name *</label>
                        <Input
                            placeholder="e.g. Main Entrance Scanner"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="bg-secondary/40 border-border"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">IP Address *</label>
                            <Input
                                placeholder="192.168.1.201"
                                value={form.ip}
                                onChange={e => setForm(f => ({ ...f, ip: e.target.value }))}
                                className="bg-secondary/40 border-border font-mono"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Port</label>
                            <Input
                                placeholder="4370"
                                value={form.port}
                                onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
                                className="bg-secondary/40 border-border font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Location / Description</label>
                        <Input
                            placeholder="e.g. Main Lobby, Ground Floor"
                            value={form.location}
                            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                            className="bg-secondary/40 border-border"
                        />
                    </div>

                    <div className="bg-secondary/30 border border-border rounded-xl p-3 text-xs text-muted-foreground flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                        <span>After saving, use <strong className="text-foreground">Test Connection</strong> to verify the device is reachable and confirm configuration.</span>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1 border-border">
                        Cancel
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={saving}
                        className="flex-1 bg-primary hover:bg-primary/90 gap-2"
                    >
                        {saving
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                            : <><Check className="w-4 h-4" /> {editingDevice ? 'Save Changes' : 'Add Device'}</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}
