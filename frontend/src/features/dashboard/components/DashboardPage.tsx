'use client';

import React from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardStatCards } from './DashboardStatCards';
import { WeeklyAttendanceChart } from './WeeklyAttendanceChart';
import { LiveActivityFeed } from './LiveActivityFeed';
import { BranchPresenceWidget } from './BranchPresenceWidget';
import { DeviceStatusWidget } from './DeviceStatusWidget';

export interface DashboardPageProps {
    role: 'admin' | 'hr';
}

import DashboardLoading from '@/components/ui/DashboardLoading';

export function DashboardPage({ role }: DashboardPageProps) {
    const { state, loading } = useDashboardData(role);

    if (loading) return <DashboardLoading />;

    return (
        <div className="flex flex-col gap-2.5 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-lg lg:text-xl font-black text-slate-900 tracking-tight">
                        {role === 'admin' ? 'System Overview' : 'HR Overview'}
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
            </div>

            {/* KPI Stats */}
            <DashboardStatCards
                role={role}
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

                    {/* Devices (Admin) or Branch Presence (HR) */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm shrink-0">
                        {role === 'hr' ? (
                            <BranchPresenceWidget role={role} branchPresence={state.branchPresence} />
                        ) : (
                            <DeviceStatusWidget
                                devices={state.devices}
                                globalSyncEnabled={state.globalSyncEnabled}
                            />
                        )}
                    </div>
                </div>

                {/* Right 1/3 */}
                <div className="flex flex-col gap-2.5 min-h-0">
                    <LiveActivityFeed
                        role={role}
                        activity={state.activity}
                        activityScrollRef={state.activityScrollRef}
                    />

                    {/* HR also sees a compact device widget */}
                    {role === 'hr' && (
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm shrink-0">
                            <DeviceStatusWidget
                                devices={state.devices}
                                globalSyncEnabled={state.globalSyncEnabled}
                                compact
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
