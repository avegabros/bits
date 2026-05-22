import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

/** Matches: Header → 2-col grid (ProfileCard, PasswordCard) + 1-col sidebar (AccountStatusSidebar) */
export default function SettingsLoading() {
  return (
    <div className="space-y-6 motion-reduce:animate-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content (Profile + Password Cards) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card Skeleton */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-start justify-between mb-8">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-3.5 w-64" />
              </div>
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>

            <div className="flex flex-col sm:flex-row gap-8 items-start mb-8">
              <Skeleton className="w-24 h-24 rounded-full shrink-0" />
              <div className="flex-1 w-full space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-16" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Password Card Skeleton */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
             <div className="flex items-start justify-between mb-8">
              <div className="space-y-2">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-3.5 w-64" />
              </div>
            </div>
            <div className="space-y-5 max-w-md">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <Skeleton className="h-10 w-32 rounded-xl mt-4" />
            </div>
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
            <Skeleton className="w-24 h-24 rounded-full mb-4" />
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-5 w-20 rounded-full mb-6" />
            
            <div className="w-full space-y-4 pt-6 border-t border-slate-100 text-left">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
