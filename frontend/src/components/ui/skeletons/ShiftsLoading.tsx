import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

/** Matches: Header + New Shift button → 3 stat cards → search/filter bar → shifts table */
export default function ShiftsLoading() {
  return (
    <div className="space-y-6 motion-reduce:animate-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-10 w-28 rounded-xl self-start lg:self-center" />
      </div>

      {/* Stat cards — ShiftStatsCards renders 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
              </div>
              <Skeleton className="w-9 h-9 rounded-xl" />
            </div>
            <Skeleton className="h-2.5 w-32" />
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col md:flex-row items-center bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <Skeleton className="h-9 w-full md:w-64 rounded-xl" />
        <div className="flex items-center gap-2 ml-auto">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className={`h-8 ${i === 0 ? 'w-12' : 'w-16'} rounded-xl`} />
          ))}
        </div>
      </div>

      {/* Shifts table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <Skeleton.Table rows={6} cols={6} />
      </div>

      {/* Pagination placeholder */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-1">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
