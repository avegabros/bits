'use client';

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { CalendarDays } from 'lucide-react';
import type { WeekDay } from '../hooks/useDashboardData';

export interface WeeklyAttendanceChartProps {
    weeklyData: WeekDay[];
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
            <p className="font-black text-slate-700 mb-1">{label}</p>
            {payload.map((p: any) => (
                <div key={p.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
                    <span className="text-slate-600 capitalize">{p.name}</span>
                    <span className="ml-auto font-black text-slate-800">{p.value}</span>
                </div>
            ))}
        </div>
    );
}

export function WeeklyAttendanceChart({ weeklyData }: WeeklyAttendanceChartProps) {
    const todayName = dayNames[new Date().getDay()];

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-[260px] lg:min-h-0 lg:flex-1">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
                <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-red-500" /> Weekly Attendance
                </h2>
                <span className="text-xs text-slate-500 font-bold">This Week</span>
            </div>
            <div className="flex-1 min-h-0 p-3">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} barGap={2} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 700, fill: 'var(--color-chart-axis-primary)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-chart-axis-secondary)' }} axisLine={false} tickLine={false} width={32} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)', radius: 4 }} />
                        <Bar dataKey="present" fill="var(--color-chart-success)" radius={[4, 4, 0, 0]} name="On Time">
                            {weeklyData.map((entry, i) => <Cell key={i} opacity={entry.day === todayName ? 1 : 0.7} />)}
                        </Bar>
                        <Bar dataKey="late" fill="var(--color-chart-warning)" radius={[4, 4, 0, 0]} name="Late">
                            {weeklyData.map((entry, i) => <Cell key={i} opacity={entry.day === todayName ? 1 : 0.7} />)}
                        </Bar>
                        <Bar dataKey="absent" fill="var(--color-chart-danger)" radius={[4, 4, 0, 0]} name="Absent">
                            {weeklyData.map((entry, i) => <Cell key={i} opacity={entry.day === todayName ? 1 : 0.7} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
