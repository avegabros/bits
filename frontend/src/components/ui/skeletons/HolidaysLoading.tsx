import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

/** Matches: Header + Add button → 2-col layout: calendar (lg:col-span-2) + upcoming list sidebar */
export default function HolidaysLoading() {
  return (
    <div className="space-y-6 motion-reduce:animate-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* 2-column grid: calendar + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar — lg:col-span-2 */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Calendar nav */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <Skeleton className="w-7 h-7 rounded-lg" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="w-7 h-7 rounded-lg" />
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="px-2 py-2.5 flex justify-center">
                <Skeleton className="h-2.5 w-6" />
              </div>
            ))}
          </div>

          {/* Calendar grid — 6 rows × 7 cols */}
          <div className="grid grid-cols-7">
            {[...Array(42)].map((_, i) => (
              <div key={i} className="min-h-[72px] p-2 border-b border-r border-slate-100/70">
                <Skeleton className="h-4 w-5 mb-2" />
                {/* ~15% of cells get a "holiday" chip */}
                {[3, 9, 17, 24, 32].includes(i) && (
                  <Skeleton className="h-4 w-full rounded-md" />
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 px-6 py-3 border-t border-slate-100 bg-slate-50/50">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>

        {/* Upcoming holidays sidebar */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="divide-y divide-slate-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
