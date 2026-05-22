import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] animate-in fade-in duration-300">
      <div className="space-y-1">
        <Skeleton className="h-7 w-44 rounded-lg" />
        <Skeleton className="h-4 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-xl" />
        ))}
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0">
        <div className="lg:col-span-2 space-y-3">
          <Skeleton className="h-56 lg:h-48 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 lg:h-auto rounded-xl" />
      </div>
    </div>
  );
}
