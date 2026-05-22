import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded-lg ${className ?? ''}`}
      {...props}
    />
  );
}

Skeleton.Table = function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-sm min-w-[640px]">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-4">
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-4">
                  <Skeleton className={`h-4 ${c === 0 ? 'w-20' : c === 1 ? 'w-28' : 'w-24'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


Skeleton.Card = function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 ${className ?? ''}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
};

Skeleton.StatCard = function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={`bg-white rounded-[1.5rem] p-5 border border-slate-200 shadow-sm ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
           <Skeleton className="w-10 h-10 rounded-xl" />
           <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
      <Skeleton className="h-8 w-20 mt-2" />
    </div>
  );
};

Skeleton.Form = function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24 ml-1" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
};

Skeleton.List = function SkeletonList({ items = 3 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
         <div key={i} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                </div>
            </div>
            <Skeleton className="w-20 h-8 rounded-full" />
         </div>
      ))}
    </div>
  );
};

Skeleton.TableRow = function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, c) => (
        <td key={c} className="px-4 py-4">
          <Skeleton className={`h-4 ${c === 0 ? 'w-24' : 'w-32'}`} />
        </td>
      ))}
    </tr>
  );
};
