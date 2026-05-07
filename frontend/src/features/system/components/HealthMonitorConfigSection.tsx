'use client';

import { Switch } from '@/components/ui/switch';
import { DurationInput } from './DurationInput';
import { HeartPulse } from 'lucide-react';

interface HealthMonitorConfigSectionProps {
    healthCheckEnabled: boolean;
    healthCheckIntervalSec: number;
    limits: Record<string, number> | null;
    onChange: (patch: Record<string, unknown>) => void;
}

export function HealthMonitorConfigSection({
    healthCheckEnabled,
    healthCheckIntervalSec,
    limits,
    onChange,
}: HealthMonitorConfigSectionProps) {
    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100">
                        <HeartPulse className="h-3 w-3 text-emerald-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Health Monitor</h3>
                </div>
                <Switch
                    id="healthCheck"
                    checked={healthCheckEnabled}
                    onCheckedChange={(c: boolean) => onChange({ healthCheckEnabled: c })}
                />
            </div>

            {/* Body */}
            <div className="px-4 py-4 flex-1">
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    Lightweight TCP pings to verify device connectivity — independent of data sync. Does not transfer data or acquire device locks. Ensures accurate online/offline status even when sync is off.
                </p>

                {healthCheckEnabled && (
                    <DurationInput
                        label="Ping Interval"
                        description="How often to check device connectivity (min 15s, recommended: 30–60s)."
                        totalSeconds={healthCheckIntervalSec}
                        minTotalSeconds={limits?.HEALTH_CHECK_INTERVAL_MIN_SEC}
                        maxTotalSeconds={limits?.HEALTH_CHECK_INTERVAL_MAX_SEC}
                        onChange={(sec) => onChange({ healthCheckIntervalSec: sec })}
                    />
                )}
            </div>
        </div>
    );
}
