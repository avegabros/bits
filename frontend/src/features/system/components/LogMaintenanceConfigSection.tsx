'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { HardDrive } from 'lucide-react';

interface LogMaintenanceConfigSectionProps {
    logBufferMaintenanceEnabled: boolean;
    logBufferMaintenanceSchedule: 'daily' | 'weekly' | 'monthly';
    logBufferMaintenanceHour: number;
    limits: Record<string, number> | null;
    onChange: (patch: Record<string, unknown>) => void;
}

export function LogMaintenanceConfigSection({
    logBufferMaintenanceEnabled,
    logBufferMaintenanceSchedule,
    logBufferMaintenanceHour,
    limits,
    onChange,
}: LogMaintenanceConfigSectionProps) {
    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-100">
                        <HardDrive className="h-3 w-3 text-purple-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Log Maintenance</h3>
                </div>
                <Switch
                    id="logBufferMaintenance"
                    checked={logBufferMaintenanceEnabled}
                    onCheckedChange={(c: boolean) => onChange({ logBufferMaintenanceEnabled: c })}
                />
            </div>

            {/* Body */}
            <div className="px-4 py-4 flex-1">
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    ZKTeco devices have limited memory. This clears old logs from device memory during off-hours to prevent capacity issues and reduce sync bandwidth.
                </p>

                {logBufferMaintenanceEnabled && (
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="maintenanceSchedule" className="text-xs font-semibold text-slate-600">Schedule</Label>
                            <select
                                id="maintenanceSchedule"
                                className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                value={logBufferMaintenanceSchedule}
                                onChange={(e) => onChange({ logBufferMaintenanceSchedule: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly (Sundays)</option>
                                <option value="monthly">Monthly (1st)</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="maintenanceHour" className="text-xs font-semibold text-slate-600">Time (PHT)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="maintenanceHour"
                                    type="number"
                                    min={limits?.MAINTENANCE_HOUR_MIN ?? 0}
                                    max={limits?.MAINTENANCE_HOUR_MAX ?? 23}
                                    value={logBufferMaintenanceHour}
                                    onChange={(e) => {
                                        const raw = parseInt(e.target.value) || 0;
                                        const min = limits?.MAINTENANCE_HOUR_MIN ?? 0;
                                        const max = limits?.MAINTENANCE_HOUR_MAX ?? 23;
                                        const clamped = Math.min(max, Math.max(min, raw));
                                        onChange({ logBufferMaintenanceHour: clamped });
                                    }}
                                    className="w-16 text-center"
                            />
                            <span className="text-xs text-slate-500">:00</span>
                        </div>
                        <p className="text-xs text-slate-500">
                            {logBufferMaintenanceHour === 0 ? 'Midnight' : logBufferMaintenanceHour <= 11 ? `${logBufferMaintenanceHour}:00 AM` : logBufferMaintenanceHour === 12 ? '12:00 PM' : `${logBufferMaintenanceHour - 12}:00 PM`} PHT
                        </p>
                    </div>
                    </div>
                )}
            </div>
        </div>
    );
}
