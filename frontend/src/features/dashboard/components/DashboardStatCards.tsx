'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, Timer, UserX, CalendarDays } from 'lucide-react';

export interface DashboardStatCardsProps {
    role: 'admin' | 'hr';
    totalEmployees: number;
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalHoliday?: number;
    holidayName?: string | null;
}

export function DashboardStatCards({ role, totalEmployees, totalPresent, totalLate, totalAbsent, totalHoliday = 0, holidayName }: DashboardStatCardsProps) {
    const router = useRouter();
    const basePath = role === 'admin' ? '' : '/hr';

    const stats = [
        { label: 'Employees', value: totalEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', accent: 'border-blue-100', path: `${basePath}/employees` },
        { label: 'On Time', value: totalPresent, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', accent: 'border-emerald-100', path: `${basePath}/attendance?status=Present` },
        { label: 'Late', value: totalLate, icon: Timer, color: 'text-amber-600', bg: 'bg-amber-50', accent: 'border-amber-100', path: `${basePath}/attendance?status=Late` },
        // Show Holiday card instead of Absent when it's a holiday
        ...(totalHoliday > 0
            ? [{ label: '🎉 Holiday', value: totalHoliday, icon: CalendarDays, color: 'text-indigo-600', bg: 'bg-indigo-50', accent: 'border-indigo-100', path: `${basePath}/attendance?status=Holiday` }]
            : [{ label: 'Absent', value: totalAbsent, icon: UserX, color: 'text-rose-600', bg: 'bg-rose-50', accent: 'border-rose-100', path: `${basePath}/attendance?status=Absent` }]
        ),
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
            {stats.map(s => (
                <div key={s.label} onClick={() => router.push(s.path)} className={`bg-white rounded-xl border ${s.accent} shadow-sm px-3 lg:px-4 py-2.5 lg:py-3 flex items-center gap-2.5 cursor-pointer hover:shadow-md transition-all active:scale-95`}>
                    <div className={`w-8 h-8 lg:w-9 lg:h-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                        <s.icon className={`w-4 h-4 lg:w-[18px] lg:h-[18px] ${s.color}`} />
                    </div>
                    <div>
                        <p className="text-xl lg:text-2xl font-black text-slate-900 leading-none">{s.value}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{s.label}</p>
                    </div>
                </div>
            ))}
            {/* Holiday name banner */}
            {holidayName && (
                <div className="col-span-2 lg:col-span-4 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-indigo-500 shrink-0" />
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Today is {holidayName}</p>
                </div>
            )}
        </div>
    );
}
