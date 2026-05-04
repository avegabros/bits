'use client';

import React from 'react';
import { useManagerDashboardData } from '../hooks/useManagerDashboardData';
import { DashboardStatCards } from '@/features/dashboard/components/DashboardStatCards';
import { WeeklyAttendanceChart } from '@/features/dashboard/components/WeeklyAttendanceChart';
import { LiveActivityFeed } from '@/features/dashboard/components/LiveActivityFeed';

function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse bg-slate-200 rounded-lg ${className ?? ''}`} />;
}

export function ManagerDashboardPage() {
    const { state, loading } = useManagerDashboardData();

    if (loading) return (
        <div className="flex flex-col gap-3 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)]">
            <div className="h-7 w-44 animate-pulse bg-slate-200 rounded-lg" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[68px] rounded-xl" />)}
            </div>
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0">
                <div className="lg:col-span-2 space-y-3">
                    <Skeleton className="h-56 lg:h-48 rounded-xl" />
                </div>
                <Skeleton className="h-64 lg:h-auto rounded-xl" />
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-2.5 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-lg lg:text-xl font-black text-slate-900 tracking-tight">
                        Department Overview
                    </h1>
                    <p className="text-slate-500 text-xs font-semibold">
                        {new Date().toLocaleDateString('en-PH', {
                            timeZone: 'Asia/Manila',
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {state.myDepartments && state.myDepartments.length > 0 && (
                        <select
                            value={state.departmentFilter === null ? '' : state.departmentFilter}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'company') state.setDepartmentFilter('company');
                                else if (val === '') state.setDepartmentFilter(null);
                                else state.setDepartmentFilter(Number(val));
                            }}
                            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-purple-500 focus:border-purple-500 block w-full px-4 py-2 outline-none font-bold shadow-sm transition-all hover:border-purple-300 cursor-pointer"
                        >
                            <option value="company">Company Wide</option>
                            <option value="">All Assigned Departments</option>
                            {state.myDepartments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* KPI Stats */}
            <DashboardStatCards
                role="manager"
                totalEmployees={state.totalEmployees}
                totalPresent={state.totalPresent}
                totalLate={state.totalLate}
                totalAbsent={state.totalAbsent}
            />

            {/* Main content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-2.5 min-h-0">
                {/* Left 2/3 */}
                <div className="lg:col-span-2 flex flex-col gap-2.5 min-h-0">
                    <WeeklyAttendanceChart weeklyData={state.weeklyData} />
                </div>

                {/* Right 1/3 */}
                <div className="flex flex-col gap-2.5 min-h-0">
                    <LiveActivityFeed
                        role="manager"
                        activity={state.activity}
                        activityScrollRef={state.activityScrollRef}
                    />
                </div>
            </div>
        </div>
    );
}
