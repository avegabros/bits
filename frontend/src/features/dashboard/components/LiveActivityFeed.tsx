'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, Clock, LogIn, LogOut, Trash2 } from 'lucide-react';
import type { LiveRecord } from '../hooks/useDashboardData';

export interface LiveActivityFeedProps {
    role: 'admin' | 'hr';
    activity: LiveRecord[];
    activityScrollRef: React.RefObject<HTMLDivElement | null>;
}

function getInitials(name: string) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

export function LiveActivityFeed({ role, activity, activityScrollRef }: LiveActivityFeedProps) {
    const router = useRouter();
    const basePath = role === 'admin' ? '' : '/hr';

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-[280px] lg:min-h-0 lg:flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
                <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-red-500" /> Activity
                </h2>
                <button
                    onClick={() => router.push(`${basePath}/attendance`)}
                    className="flex items-center gap-0.5 text-xs font-black text-red-600 hover:text-red-700 uppercase tracking-wider transition-colors"
                >
                    All <ArrowRight className="w-3 h-3" />
                </button>
            </div>
            <div ref={activityScrollRef} className="flex-1 overflow-y-auto min-h-0">
                {activity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-8 lg:py-0">
                        <div className="relative w-16 h-16">
                            <div className="absolute inset-0 bg-slate-100 rounded-full" />
                            <div className="absolute inset-2 bg-slate-50 rounded-full flex items-center justify-center">
                                <Clock className="w-6 h-6 text-slate-300" />
                            </div>
                            <div className="absolute -right-1 -top-1 w-5 h-5 bg-red-50 rounded-full flex items-center justify-center border-2 border-white">
                                <Activity className="w-2.5 h-2.5 text-red-400" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-500 font-bold text-sm">No activity yet today</p>
                            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">Check-ins will appear here as employees scan</p>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {activity.map(a => (
                            <div key={a.id} className="flex items-center gap-3 px-3 lg:px-4 py-2.5 hover:bg-slate-50/70 transition-colors">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a.eventType === 'check-in' ? 'bg-linear-to-br from-emerald-400 to-emerald-600' : a.eventType === 'delete' ? 'bg-linear-to-br from-red-400 to-red-600' : 'bg-linear-to-br from-slate-300 to-slate-500'}`}>
                                    <span className="text-white text-[10px] font-black">{getInitials(a.employee)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-xs leading-tight truncate">{a.employee || '—'}</p>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                        {a.department || '—'}
                                        {a.branch && a.branch !== '—' ? <span className="text-slate-300"> · </span> : ''}
                                        {a.branch && a.branch !== '—' ? <span className="text-slate-400">{a.branch}</span> : ''}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right hidden sm:block">
                                    <div className="flex items-center gap-1 justify-end">
                                        {a.eventType === 'check-in' ? <LogIn className="w-3.5 h-3.5 text-emerald-500" /> : a.eventType === 'delete' ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <LogOut className="w-3.5 h-3.5 text-slate-400" />}
                                        <span className="text-[10px] font-mono text-slate-600">{a.time}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 shrink-0">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${a.eventType === 'check-in' ? 'bg-blue-50 text-blue-700' : a.eventType === 'delete' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}`}>
                                        {a.eventType === 'check-in' ? 'Check-in' : a.eventType === 'delete' ? 'Deleted' : 'Check-out'}
                                    </span>
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${a.status === 'on-time' ? 'bg-emerald-50 text-emerald-700' : a.status === 'late' ? 'bg-amber-50 text-amber-700' : a.status === 'undertime' ? 'bg-orange-50 text-orange-700' : a.status === 'deleted' ? 'bg-red-50 text-red-700' : 'bg-rose-50 text-rose-700'}`}>
                                        {a.status === 'on-time' ? 'On Time' : a.status === 'late' ? 'Late' : a.status === 'undertime' ? 'Undertime' : a.status === 'deleted' ? 'Record Deleted' : 'Absent'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
