import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

/** Matches: Header + export → company tabs → filter bar → employee table (with avatar column) */
export default function EmployeesLoading() {
  return (
    <div className="space-y-5 motion-reduce:animate-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* Company tabs */}
      <div className="flex gap-2 border-b border-slate-100 pb-0 overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className={`h-8 rounded-t-lg rounded-b-none ${i === 0 ? 'w-28' : 'w-24'}`} />
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-9 w-36 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-9 rounded-xl ml-auto" />
      </div>

      {/* Employee table — note: has avatar column */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['w-12', 'w-8', 'w-40', 'w-24', 'w-32', 'w-24', 'w-20', 'w-24'].map((w, i) => (
                  <th key={i} className="px-4 py-4">
                    <Skeleton className={`h-3 ${w}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...Array(7)].map((_, r) => (
                <tr key={r}>
                  <td className="px-4 py-3"><Skeleton className="h-3.5 w-10" /></td>
                  {/* Avatar */}
                  <td className="px-4 py-3"><Skeleton className="w-8 h-8 rounded-full" /></td>
                  {/* Name + email */}
                  <td className="px-4 py-3">
                    <Skeleton className="h-3.5 w-32 mb-1.5" />
                    <Skeleton className="h-2.5 w-24" />
                  </td>
                  <td className="px-4 py-3"><Skeleton className="h-3.5 w-20" /></td>
                  {/* Shift */}
                  <td className="px-4 py-3">
                    <Skeleton className="h-3.5 w-24 mb-1.5" />
                    <Skeleton className="h-2.5 w-16" />
                  </td>
                  <td className="px-4 py-3"><Skeleton className="h-3.5 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="w-7 h-7 rounded-lg" />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
