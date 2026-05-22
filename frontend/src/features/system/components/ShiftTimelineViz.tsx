'use client';

import { useEffect, useState } from 'react';
import { Clock, Zap, Moon, Info } from 'lucide-react';

interface ShiftData {
    id: number;
    name: string;
    startTime: string;
    endTime: string;
    workDays: string;
}

interface PeakWindow {
    shiftName: string;
    type: 'clock-in' | 'clock-out';
    startMin: number;
    endMin: number;
}

function parseTimeStr(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function formatMinutes(min: number): string {
    const normalized = ((min % 1440) + 1440) % 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function getCurrentMinutesPHT(): number {
    const phtStr = new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Manila',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
    });
    return parseTimeStr(phtStr);
}

function getCurrentDayPHT(): string {
    return new Date().toLocaleDateString('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
    });
}

interface ShiftTimelineVizProps {
    bufferMinutes: number;
    enabled: boolean;
}

export function ShiftTimelineViz({ bufferMinutes, enabled }: ShiftTimelineVizProps) {
    const [shifts, setShifts] = useState<ShiftData[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMin, setCurrentMin] = useState(getCurrentMinutesPHT());

    useEffect(() => {
        const fetchShifts = async () => {
            try {
                const res = await fetch('/api/shifts', { credentials: 'include' });
                const data = await res.json();
                if (data.success) {
                    setShifts(data.shifts || data.data || []);
                }
            } catch (err) {
                console.error('Failed to fetch shifts for timeline:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchShifts();
    }, []);

    // Update current time every minute
    useEffect(() => {
        const interval = setInterval(() => setCurrentMin(getCurrentMinutesPHT()), 60_000);
        return () => clearInterval(interval);
    }, []);

    if (!enabled) return null;

    if (loading) {
        return (
            <div className="animate-pulse space-y-3 pt-4">
                <div className="h-4 bg-slate-200 rounded w-48" />
                <div className="h-12 bg-slate-200 rounded-lg" />
            </div>
        );
    }

    const currentDay = getCurrentDayPHT();

    // Build peak windows for today's active shifts
    const peakWindows: PeakWindow[] = [];
    for (const shift of shifts) {
        try {
            const workDays: string[] = JSON.parse(shift.workDays);
            if (!workDays.includes(currentDay)) continue;

            const startMin = parseTimeStr(shift.startTime);
            const endMin = parseTimeStr(shift.endTime);

            peakWindows.push({
                shiftName: shift.name,
                type: 'clock-in',
                startMin: ((startMin - bufferMinutes) % 1440 + 1440) % 1440,
                endMin: ((startMin + bufferMinutes) % 1440 + 1440) % 1440,
            });
            peakWindows.push({
                shiftName: shift.name,
                type: 'clock-out',
                startMin: ((endMin - bufferMinutes) % 1440 + 1440) % 1440,
                endMin: ((endMin + bufferMinutes) % 1440 + 1440) % 1440,
            });
        } catch {
            continue;
        }
    }

    const totalMinutes = 1440;
    const hourMarkers = [0, 3, 6, 9, 12, 15, 18, 21];

    const minToPercent = (min: number) => ((min % totalMinutes) / totalMinutes) * 100;
    const currentPercent = minToPercent(currentMin);

    // Check if we're in peak right now
    const isInPeak = peakWindows.some(w => {
        const s = w.startMin;
        const e = w.endMin;
        if (s <= e) return currentMin >= s && currentMin <= e;
        return currentMin >= s || currentMin <= e;
    });

    return (
        <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Today&apos;s Peak Windows ({currentDay})
                    </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
                    {isInPeak ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                            <Zap className="w-3 h-3" /> Currently Peak
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-slate-400">
                            <Moon className="w-3 h-3" /> Currently Off-Peak
                        </span>
                    )}
                </div>
            </div>

            {/* Timeline Bar */}
            <div className="relative h-10 bg-slate-100 rounded-lg border border-slate-200">
                {/* Inner clip layer: contains peaks + hour grid */}
                <div className="absolute inset-0 rounded-lg overflow-hidden">
                    {/* Off-peak base (the gray background) */}

                    {/* Peak windows */}
                    {peakWindows.map((w, i) => {
                        const left = minToPercent(w.startMin);
                        let width: number;
                        if (w.startMin <= w.endMin) {
                            width = minToPercent(w.endMin) - left;
                        } else {
                            // Cross-midnight
                            width = (100 - left) + minToPercent(w.endMin);
                        }

                        const isClockIn = w.type === 'clock-in';
                        const bgColor = isClockIn
                            ? 'bg-emerald-400/40 border-emerald-500/30'
                            : 'bg-blue-400/40 border-blue-500/30';

                        return (
                            <div
                                key={i}
                                className={`absolute top-0 h-full ${bgColor} border-l border-r`}
                                style={{ left: `${left}%`, width: `${Math.min(width, 100)}%` }}
                                title={`${w.shiftName} — ${isClockIn ? 'Clock-In Rush' : 'Clock-Out Rush'} (${formatMinutes(w.startMin)} – ${formatMinutes(w.endMin)})`}
                            >
                                <div className="h-full flex items-center justify-center">
                                    {width > 5 && (
                                        <span className={`text-[9px] font-black uppercase tracking-wider ${isClockIn ? 'text-emerald-700' : 'text-blue-700'}`}>
                                            {isClockIn ? 'IN' : 'OUT'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Hour markers */}
                    {hourMarkers.map(h => (
                        <div
                            key={h}
                            className="absolute top-0 h-full border-l border-slate-200/60"
                            style={{ left: `${(h / 24) * 100}%` }}
                        />
                    ))}
                </div>

                {/* Current time indicator - needle lives outside the clip layer */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{ left: `${currentPercent}%` }}
                >
                    <div className="absolute -top-1.5 -left-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white shadow-sm" />
                </div>
            </div>

            {/* Hour labels */}
            <div className="relative h-4 -mt-1">
                {hourMarkers.map(h => (
                    <span
                        key={h}
                        className="absolute text-[10px] text-slate-500 font-mono font-bold -translate-x-1/2"
                        style={{ left: `${(h / 24) * 100}%` }}
                    >
                        {h.toString().padStart(2, '0')}
                    </span>
                ))}
                <span
                    className="absolute text-[10px] text-slate-500 font-mono font-bold"
                    style={{ right: 0 }}
                >
                    24
                </span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-slate-500 font-semibold">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2 rounded-sm bg-emerald-400/50 border border-emerald-500/30" />
                    Clock-In Rush
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2 rounded-sm bg-blue-400/50 border border-blue-500/30" />
                    Clock-Out Rush
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-2 rounded-sm bg-slate-100 border border-slate-200" />
                    Off-Peak
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-0.5 h-3 bg-red-500 rounded" />
                    Now
                </div>
            </div>

            {peakWindows.length === 0 && (
                <div className="flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-100">
                    <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                        No active shifts found for <strong>{currentDay}</strong>. The system will use the default sync interval all day.
                    </p>
                </div>
            )}
        </div>
    );
}
