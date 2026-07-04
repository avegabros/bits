'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Database } from 'lucide-react';
import { useState, useEffect } from 'react';

interface DatabaseBackupConfigSectionProps {
    dbBackupEnabled: boolean;
    dbBackupCron: string;
    dbBackupRetention: number;
    dbBackupCompress: boolean;
    onChange: (patch: Record<string, unknown>) => void;
}

function parseCron(cron: string) {
    const parts = (cron || '0 0 * * *').trim().split(/\s+/);
    if (parts.length !== 5) {
        return { frequency: 'daily', dayOfWeek: '0', timeOfDay: '00:00' };
    }
    const [min, hour, dom, month, dow] = parts;

    if (min === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
        return { frequency: 'hourly', dayOfWeek: '0', timeOfDay: '00:00' };
    }
    if (min === '0' && hour === '*/6' && dom === '*' && month === '*' && dow === '*') {
        return { frequency: '6hours', dayOfWeek: '0', timeOfDay: '00:00' };
    }
    if (min === '0' && hour === '*/12' && dom === '*' && month === '*' && dow === '*') {
        return { frequency: '12hours', dayOfWeek: '0', timeOfDay: '00:00' };
    }
    
    // Weekly: min hour * * dow
    if (dow !== '*' && dom === '*' && month === '*') {
        const hStr = hour.includes(',') || hour.includes('/') || hour === '*' ? '0' : hour;
        const mStr = min.includes(',') || min.includes('/') || min === '*' ? '0' : min;
        const time = `${hStr.padStart(2, '0')}:${mStr.padStart(2, '0')}`;
        return { frequency: 'weekly', dayOfWeek: dow, timeOfDay: time };
    }

    // Daily: min hour * * *
    const hStr = hour.includes(',') || hour.includes('/') || hour === '*' ? '0' : hour;
    const mStr = min.includes(',') || min.includes('/') || min === '*' ? '0' : min;
    const time = `${hStr.padStart(2, '0')}:${mStr.padStart(2, '0')}`;
    return { frequency: 'daily', dayOfWeek: '0', timeOfDay: time };
}

function formatToCron(frequency: string, dayOfWeek: string, timeOfDay: string): string {
    if (frequency === 'hourly') return '0 * * * *';
    if (frequency === '6hours') return '0 */6 * * *';
    if (frequency === '12hours') return '0 */12 * * *';

    const [h, m] = (timeOfDay || '00:00').split(':');
    const hourNum = parseInt(h, 10) || 0;
    const minNum = parseInt(m, 10) || 0;

    if (frequency === 'weekly') {
        return `${minNum} ${hourNum} * * ${dayOfWeek}`;
    }
    
    // Default: daily
    return `${minNum} ${hourNum} * * *`;
}

function getFriendlyTime(timeStr: string): string {
    if (!timeStr) return '12:00 AM';
    const [h, m] = timeStr.split(':');
    const hourNum = parseInt(h, 10) || 0;
    const minNum = parseInt(m, 10) || 0;
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
    const displayMin = minNum.toString().padStart(2, '0');
    return `${displayHour}:${displayMin} ${ampm}`;
}

export function DatabaseBackupConfigSection({
    dbBackupEnabled,
    dbBackupCron,
    dbBackupRetention,
    dbBackupCompress,
    onChange,
}: DatabaseBackupConfigSectionProps) {
    const { frequency: initialFreq, dayOfWeek: initialDow, timeOfDay: initialTime } = parseCron(dbBackupCron);

    const [frequency, setFrequency] = useState(initialFreq);
    const [dayOfWeek, setDayOfWeek] = useState(initialDow);
    const [timeOfDay, setTimeOfDay] = useState(initialTime);

    // Sync from props
    useEffect(() => {
        const parsed = parseCron(dbBackupCron);
        setFrequency(parsed.frequency);
        setDayOfWeek(parsed.dayOfWeek);
        setTimeOfDay(parsed.timeOfDay);
    }, [dbBackupCron]);

    const updateCron = (freq: string, dow: string, time: string) => {
        const nextCron = formatToCron(freq, dow, time);
        onChange({ dbBackupCron: nextCron });
    };

    const handleFrequencyChange = (newFreq: string) => {
        setFrequency(newFreq);
        updateCron(newFreq, dayOfWeek, timeOfDay);
    };

    const handleDayOfWeekChange = (newDow: string) => {
        setDayOfWeek(newDow);
        updateCron(frequency, newDow, timeOfDay);
    };

    const handleTimeOfDayChange = (newTime: string) => {
        setTimeOfDay(newTime);
        updateCron(frequency, dayOfWeek, newTime);
    };

    const getExplanation = () => {
        if (frequency === 'hourly') return 'Runs automatically every hour';
        if (frequency === '6hours') return 'Runs automatically every 6 hours';
        if (frequency === '12hours') return 'Runs automatically every 12 hours';
        if (frequency === 'daily') return `Runs automatically every day at ${getFriendlyTime(timeOfDay)}`;
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[parseInt(dayOfWeek)] || 'Sunday';
        return `Runs automatically every ${dayName} at ${getFriendlyTime(timeOfDay)}`;
    };

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100">
                        <Database className="h-3 w-3 text-emerald-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Database Backups</h3>
                </div>
                <Switch
                    id="dbBackupEnabled"
                    checked={dbBackupEnabled}
                    onCheckedChange={(c: boolean) => onChange({ dbBackupEnabled: c })}
                />
            </div>

            {/* Body */}
            <div className="px-4 py-4 flex-1">
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    Automatically backup the system PostgreSQL database. Backups are stored in the server volume and compressed to save disk space.
                </p>

                {dbBackupEnabled && (
                    <div className="space-y-4">
                        {/* Backup Interval Selection */}
                        <div className="space-y-1.5">
                            <Label htmlFor="backupFreq" className="text-xs font-semibold text-slate-600">Backup Schedule</Label>
                            <select
                                id="backupFreq"
                                className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                value={frequency}
                                onChange={(e) => handleFrequencyChange(e.target.value)}
                            >
                                <option value="hourly">Every Hour</option>
                                <option value="6hours">Every 6 Hours</option>
                                <option value="12hours">Every 12 Hours</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                            </select>
                        </div>

                        {/* Weekly Day Selection */}
                        {frequency === 'weekly' && (
                            <div className="space-y-1.5">
                                <Label htmlFor="backupDow" className="text-xs font-semibold text-slate-600">Day of Week</Label>
                                <select
                                    id="backupDow"
                                    className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    value={dayOfWeek}
                                    onChange={(e) => handleDayOfWeekChange(e.target.value)}
                                >
                                    <option value="0">Sunday</option>
                                    <option value="1">Monday</option>
                                    <option value="2">Tuesday</option>
                                    <option value="3">Wednesday</option>
                                    <option value="4">Thursday</option>
                                    <option value="5">Friday</option>
                                    <option value="6">Saturday</option>
                                </select>
                            </div>
                        )}

                        {/* Daily / Weekly Time Input */}
                        {(frequency === 'daily' || frequency === 'weekly') && (
                            <div className="space-y-1.5">
                                <Label htmlFor="backupTime" className="text-xs font-semibold text-slate-600">Time of Day</Label>
                                <Input
                                    id="backupTime"
                                    type="time"
                                    value={timeOfDay}
                                    onChange={(e) => handleTimeOfDayChange(e.target.value)}
                                    className="text-xs h-9 w-full bg-background"
                                />
                            </div>
                        )}

                        {/* Friendly summary */}
                        <p className="text-[11px] text-emerald-600 font-semibold bg-emerald-50/50 border border-emerald-100/50 rounded px-2.5 py-1.5 flex items-center gap-1.5 transition-all duration-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            {getExplanation()}
                        </p>

                        {/* Retention Policy */}
                        <div className="space-y-1.5">
                            <Label htmlFor="backupRetention" className="text-xs font-semibold text-slate-600">Retention Limit</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="backupRetention"
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={dbBackupRetention}
                                    onChange={(e) => {
                                        const raw = parseInt(e.target.value) || 7;
                                        onChange({ dbBackupRetention: Math.min(12, Math.max(1, raw)) });
                                    }}
                                    className="w-20 text-xs h-9"
                                />
                                <span className="text-xs text-slate-500">backups kept (Max: 12)</span>
                            </div>
                        </div>

                        {/* Compression Toggle */}
                        <div className="flex items-center justify-between pt-1">
                            <Label htmlFor="dbBackupCompress" className="text-xs font-semibold text-slate-600">Gzip Compression</Label>
                            <Switch
                                id="dbBackupCompress"
                                checked={dbBackupCompress}
                                onCheckedChange={(c: boolean) => onChange({ dbBackupCompress: c })}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
