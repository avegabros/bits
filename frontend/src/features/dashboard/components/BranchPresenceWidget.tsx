'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { BranchData } from '../hooks/useDashboardData';

export interface BranchPresenceWidgetProps {
    role: 'admin' | 'hr';
    branchPresence: BranchData[];
}

export function BranchPresenceWidget({ role, branchPresence }: BranchPresenceWidgetProps) {
    const router = useRouter();
    const basePath = role === 'admin' ? '' : '/hr';

    return (
        <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-500" /> Branch Presence
                </h2>
            </div>
            <div className="p-2">
                {branchPresence.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 gap-1.5">
                        <MapPin className="w-6 h-6 text-slate-200" />
                        <p className="text-slate-400 text-sm font-semibold">No branches configured</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {branchPresence.map(branch => (
                            <div
                                key={branch.name}
                                onClick={() => router.push(`${basePath}/attendance?branch=${encodeURIComponent(branch.name)}`)}
                                className={`rounded-lg border p-2 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ${branch.percentage >= 80 ? 'border-emerald-100 bg-emerald-50/30' : branch.percentage >= 50 ? 'border-amber-100 bg-amber-50/30' : 'border-rose-100 bg-rose-50/30'}`}
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${branch.percentage >= 80 ? 'bg-emerald-100' : branch.percentage >= 50 ? 'bg-amber-100' : 'bg-rose-100'}`}>
                                    <MapPin className={`w-3.5 h-3.5 ${branch.percentage >= 80 ? 'text-emerald-600' : branch.percentage >= 50 ? 'text-amber-500' : 'text-rose-500'}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 truncate leading-tight">{branch.name}</p>
                                    <p className="text-[10px] text-slate-500 font-mono">{branch.percentage}% present</p>
                                </div>
                                {branch.percentage >= 80 ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : branch.percentage >= 50 ? <ArrowDownRight className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
