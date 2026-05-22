import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

/** Generic table loading skeleton — used for low-traffic admin pages
 *  (Devices, System, Logs, User Accounts, Adjustments).
 *  High-traffic pages have their own page-specific skeletons.
 */
export default function TableLoading({ title = true }: { title?: boolean }) {
  return (
    <div className="space-y-5 motion-reduce:animate-none animate-in fade-in duration-200">
      {/* Page Header */}
      {title && (
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </div>
          <Skeleton className="h-10 w-32 rounded-xl self-start sm:self-center" />
        </div>
      )}

      {/* Filter row */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-60 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <Skeleton.Table rows={7} cols={6} />
      </div>
    </div>
  );
}
