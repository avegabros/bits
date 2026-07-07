'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Clock, Layers, Moon, AlertCircle } from 'lucide-react';

interface AttendanceRulesSectionProps {
    globalMinCheckoutMinutes: number;
    minShiftGapMinutes: number;
    nightShiftBufferMinutes: number;
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
    minShiftGapMinutes,
    nightShiftBufferMinutes,
    limits,
    onChange,
}: AttendanceRulesSectionProps) {
    const minLimit = limits?.MIN_CHECKOUT_MIN ?? 15;
    const maxLimit = limits?.MIN_CHECKOUT_MAX_MIN ?? 720;
    const isMinError = globalMinCheckoutMinutes < minLimit;
    const isMaxError = globalMinCheckoutMinutes > maxLimit;
    const isError = isMinError || isMaxError;

    const gapMinLimit = limits?.MIN_SHIFT_GAP_MIN ?? 15;
    const gapMaxLimit = limits?.MIN_SHIFT_GAP_MAX_MIN ?? 240;
    const isGapMinError = minShiftGapMinutes < gapMinLimit;
    const isGapMaxError = minShiftGapMinutes > gapMaxLimit;
    const isGapError = isGapMinError || isGapMaxError;

    const bufferMin = limits?.SHIFT_BUFFER_MIN ?? 0;
    const bufferMax = limits?.SHIFT_BUFFER_MAX ?? 120;
    const isNightBufferMinError = nightShiftBufferMinutes < bufferMin;
    const isNightBufferMaxError = nightShiftBufferMinutes > bufferMax;
    const isNightBufferError = isNightBufferMinError || isNightBufferMaxError;

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-100">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-rose-50 border border-rose-100">
                    <ShieldCheck className="h-4 w-4 text-rose-600" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Attendance Rules</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Define constraints and grace windows for biometric pairing logic</p>
                </div>
            </div>

            {/* Grid Container */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Rule 1: Minimum Checkout Gap */}
                <div className={`p-4 rounded-xl border transition-all duration-200 ${isError ? 'bg-red-50/30 border-red-100 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:shadow-sm'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100">
                            <Clock className="h-4 w-4 text-emerald-600" />
                        </div>
                        <Label htmlFor="globalMinCheckoutMinutes" className="text-sm font-semibold text-slate-800 cursor-pointer">
                            Checkout Gap
                        </Label>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4 min-h-[64px]">
                        Prevents accidental double-taps. An employee must wait at least this long after check-in before a tap counts as check-out.
                    </p>
                    <div className="space-y-2">
                        <div className="relative flex items-center max-w-[150px]">
                            <Input
                                id="globalMinCheckoutMinutes"
                                type="number"
                                value={globalMinCheckoutMinutes}
                                onChange={(e) => {
                                    const raw = parseInt(e.target.value);
                                    onChange({ globalMinCheckoutMinutes: isNaN(raw) ? 0 : raw });
                                }}
                                className={`font-mono pr-12 text-center h-9 ${isError ? 'border-red-300 focus-visible:ring-red-200' : 'border-slate-200'}`}
                            />
                            <span className="absolute right-3 text-xs text-slate-400 font-medium pointer-events-none select-none">
                                min
                            </span>
                        </div>
                        {isMinError && (
                            <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" /> Must be at least {minLimit}m.
                            </p>
                        )}
                        {isMaxError && (
                            <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" /> Max: {formatMinutesHuman(maxLimit)}.
                            </p>
                        )}
                        {!isError && (
                            <p className="text-[11px] text-slate-500">
                                Currently: <strong className="text-slate-700 font-semibold">{formatMinutesHuman(globalMinCheckoutMinutes)}</strong> (Max: {formatMinutesHuman(maxLimit)})
                            </p>
                        )}
                    </div>
                </div>

                {/* Rule 2: Minimum Shift Gap */}
                <div className={`p-4 rounded-xl border transition-all duration-200 ${isGapError ? 'bg-red-50/30 border-red-100 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:shadow-sm'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100">
                            <Layers className="h-4 w-4 text-indigo-600" />
                        </div>
                        <Label htmlFor="minShiftGapMinutes" className="text-sm font-semibold text-slate-800 cursor-pointer">
                            Shift Gap
                        </Label>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4 min-h-[64px]">
                        Prevents cross-shift issues. If an employee has multiple shifts, they must check out this many minutes before their next shift.
                    </p>
                    <div className="space-y-2">
                        <div className="relative flex items-center max-w-[150px]">
                            <Input
                                id="minShiftGapMinutes"
                                type="number"
                                value={minShiftGapMinutes}
                                onChange={(e) => {
                                    const raw = parseInt(e.target.value);
                                    onChange({ minShiftGapMinutes: isNaN(raw) ? 0 : raw });
                                }}
                                className={`font-mono pr-12 text-center h-9 ${isGapError ? 'border-red-300 focus-visible:ring-red-200' : 'border-slate-200'}`}
                            />
                            <span className="absolute right-3 text-xs text-slate-400 font-medium pointer-events-none select-none">
                                min
                            </span>
                        </div>
                        {isGapMinError && (
                            <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" /> Must be at least {gapMinLimit}m.
                            </p>
                        )}
                        {isGapMaxError && (
                            <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" /> Max: {formatMinutesHuman(gapMaxLimit)}.
                            </p>
                        )}
                        {!isGapError && (
                            <p className="text-[11px] text-slate-500">
                                Currently: <strong className="text-slate-700 font-semibold">{formatMinutesHuman(minShiftGapMinutes)}</strong> (Max: {formatMinutesHuman(gapMaxLimit)})
                            </p>
                        )}
                    </div>
                </div>

                {/* Rule 3: Night Shift & Overnight OT Buffer */}
                <div className={`p-4 rounded-xl border transition-all duration-200 ${isNightBufferError ? 'bg-red-50/30 border-red-100 shadow-sm' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:shadow-sm'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 border border-violet-100">
                            <Moon className="h-4 w-4 text-violet-600" />
                        </div>
                        <Label htmlFor="nightShiftBufferMinutes" className="text-sm font-semibold text-slate-800 cursor-pointer">
                            Night & Overnight OT Buffer
                        </Label>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4 min-h-[64px]">
                        Defines the window before/after the scheduled end of a night shift or approved overnight overtime to match the next-day checkout.
                    </p>
                    <div className="space-y-2">
                        <div className="relative flex items-center max-w-[150px]">
                            <Input
                                id="nightShiftBufferMinutes"
                                type="number"
                                value={nightShiftBufferMinutes}
                                onChange={(e) => {
                                    const raw = parseInt(e.target.value);
                                    onChange({ nightShiftBufferMinutes: isNaN(raw) ? 0 : raw });
                                }}
                                className={`font-mono pr-12 text-center h-9 ${isNightBufferError ? 'border-red-300 focus-visible:ring-red-200' : 'border-slate-200'}`}
                            />
                            <span className="absolute right-3 text-xs text-slate-400 font-medium pointer-events-none select-none">
                                min
                            </span>
                        </div>
                        {isNightBufferMinError && (
                            <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" /> Must be at least {bufferMin}m.
                            </p>
                        )}
                        {isNightBufferMaxError && (
                            <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" /> Max: {formatMinutesHuman(bufferMax)}.
                            </p>
                        )}
                        {!isNightBufferError && (
                            <p className="text-[11px] text-slate-500">
                                Currently: <strong className="text-slate-700 font-semibold">{formatMinutesHuman(nightShiftBufferMinutes)}</strong> (Max: {formatMinutesHuman(bufferMax)})
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
