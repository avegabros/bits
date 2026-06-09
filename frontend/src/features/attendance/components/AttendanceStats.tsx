import React from 'react';
import { Timer, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface AttendanceStatsProps {
  stats: {
    onTime: number;
    late: number;
    absent: number;
    restDay?: number;
    incomplete: number;
    total: number;
    avgHours: string;
    totalOT: string;
    totalUT: string;
  };
  variant?: 'generic' | 'admin';
}

export function AttendanceStats({ stats, variant = 'generic' }: AttendanceStatsProps) {
  const statCards = [
    { label: 'Avg Hours', value: `${stats.avgHours}h`, icon: Timer, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Overtime', value: `${stats.totalOT}h`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Undertime', value: `${stats.totalUT}h`, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10' },
  ];

  return (
    <>
      {/* Missing Checkout Alert */}
      {stats.incomplete > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 bg-amber-50 border border-amber-200 px-4 sm:px-5 py-3 rounded-2xl shadow-sm">
          <div className="bg-amber-500/10 p-2 rounded-xl shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Missing Checkout</p>
            <p className="text-xl font-black text-amber-700">{stats.incomplete}</p>
          </div>
          <p className="text-[10px] text-amber-600 font-medium sm:ml-auto">
            {stats.incomplete} employee{stats.incomplete !== 1 ? 's' : ''} forgot to check out
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card rounded-2xl border border-border p-3 sm:p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                  <p className={`text-xl sm:text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
                </div>
                <div className={`${s.bg} p-2 rounded-lg shrink-0`}>
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini Stats Bar - Hidden in Admin variant (moved to table card) */}
      {variant !== 'admin' && (
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-3 sm:gap-4 bg-white px-4 sm:px-5 py-3 rounded-2xl border border-slate-100 shadow-sm w-full sm:w-fit">
          <div className="text-center">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">On Time</p>
            <p className="text-xl font-black text-emerald-500">{stats.onTime}</p>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-100" />
          <div className="text-center">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Late</p>
            <p className="text-xl font-black text-yellow-500">{stats.late}</p>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-100" />
          <div className="text-center">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Absent</p>
            <p className="text-xl font-black text-red-500">{stats.absent}</p>
          </div>
          {stats.restDay !== undefined && stats.restDay > 0 && (
            <>
              <div className="hidden sm:block w-px h-8 bg-slate-100" />
              <div className="text-center">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Rest Day</p>
                <p className="text-xl font-black text-slate-400">{stats.restDay}</p>
              </div>
            </>
          )}
          {stats.incomplete > 0 && (
            <>
              <div className="hidden sm:block w-px h-8 bg-slate-100" />
              <div className="text-center">
                <p className="text-[9px] font-black uppercase tracking-wider text-amber-500">Missing</p>
                <p className="text-xl font-black text-amber-600">{stats.incomplete}</p>
              </div>
            </>
          )}
          <div className="hidden sm:block w-px h-8 bg-slate-100" />
          <div className="text-center">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total</p>
            <p className="text-xl font-black text-slate-700">{stats.total}</p>
          </div>
        </div>
      )}
    </>
  );
}
