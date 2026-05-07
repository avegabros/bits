'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShieldCheck } from 'lucide-react';

interface AttendanceRulesSectionProps {
    globalMinCheckoutMinutes: number;
    limits: Record<string, number> | null;
    onChange: (patch: Record<string, unknown>) => void;
}

function formatMinutesHuman(mins: number): string {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

export function AttendanceRulesSection({
    globalMinCheckoutMinutes,
    limits,
    onChange,
}: AttendanceRulesSectionProps) {
    const minLimit = limits?.MIN_CHECKOUT_MIN ?? 15;
    const maxLimit = limits?.MIN_CHECKOUT_MAX_MIN ?? 720;
    const isMinError = globalMinCheckoutMinutes < minLimit;
    const isMaxError = globalMinCheckoutMinutes > maxLimit;
    const isError = isMinError || isMaxError;

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-rose-100">
                    <ShieldCheck className="h-3 w-3 text-rose-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Attendance Rules</h3>
            </div>

            {/* Body */}
            <div className="px-4 py-4 flex-1 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                    Prevents accidental double-taps from being treated as a check-out. An employee must wait at least this long after check-in before a tap counts as check-out.
                </p>

                <div className="space-y-1.5">
                    <Label htmlFor="globalMinCheckoutMinutes" className={`text-xs font-semibold ${isError ? 'text-red-600' : 'text-slate-600'}`}>
                        Minimum Checkout Gap
                    </Label>
                    <div className="flex items-center gap-2">
                        <Input
                            id="globalMinCheckoutMinutes"
                            type="number"
                            value={globalMinCheckoutMinutes}
                            onChange={(e) => {
                                const raw = parseInt(e.target.value);
                                onChange({ globalMinCheckoutMinutes: isNaN(raw) ? 0 : raw });
                            }}
                            className={`w-20 text-center font-mono ${isError ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                        />
                        <span className="text-xs text-slate-400 font-semibold">minutes</span>
                    </div>
                    {isMinError && (
                        <p className="text-xs text-red-500 font-semibold">
                            Must be at least {minLimit} minutes.
                        </p>
                    )}
                    {isMaxError && (
                        <p className="text-xs text-red-500 font-semibold">
                            Cannot exceed {maxLimit} minutes ({formatMinutesHuman(maxLimit)}).
                        </p>
                    )}
                    {!isError && (
                        <p className="text-xs text-slate-500">
                            Currently: <strong className="text-slate-700 font-semibold">{formatMinutesHuman(globalMinCheckoutMinutes)}</strong> • Max: {formatMinutesHuman(maxLimit)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
