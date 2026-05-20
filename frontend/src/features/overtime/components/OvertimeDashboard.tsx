'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, History, UserPlus, Monitor, ArrowLeft } from 'lucide-react';
import { OvertimeListPage } from './OvertimeListPage';
import { AssignOvertimeModal } from './AssignOvertimeModal';
import { OTMonitoringTab } from './OTMonitoringTab';

interface OvertimeDashboardProps {
  role: 'admin' | 'hr' | 'manager';
}

export function OvertimeDashboard({ role }: OvertimeDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canReview = role === 'manager' || role === 'admin';
  const resolveTab = (param: string | null, canReview: boolean): 'pending' | 'history' | 'monitoring' => {
    if (!canReview) return 'history';
    if (param === 'history' || param === 'monitoring' || param === 'pending') return param;
    return 'pending';
  };
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'monitoring'>(resolveTab(searchParams.get('tab'), canReview));

  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'APPROVED' | 'REJECTED' | 'DELETED'>('ALL');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabChange = (tab: 'pending' | 'history' | 'monitoring') => {
    setActiveTab(tab);
    router.push(`?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    setActiveTab(resolveTab(tabParam, canReview));
  }, [searchParams, canReview]);

  const basePath = role === 'hr' ? '/hr' : role === 'manager' ? '/manager' : '';

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 lg:gap-8 min-h-screen p-4 md:p-6 lg:p-8">
      {/* Back Navigation */}
      <Link
        href={`${basePath}/attendance`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors group self-start"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Attendance
      </Link>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-600/10 via-rose-500/5 to-transparent border border-red-500/10 rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm overflow-hidden relative">
        {/* Abstract background mesh effect */}
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-red-500/10 p-3.5 rounded-2xl border border-red-500/20 shrink-0">
            <Clock className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Overtime Requests
            </h1>
            <p className="text-slate-500 font-medium mt-1 text-sm">
              Manage employee overtime requests, live sessions, and historical records.
            </p>
          </div>
        </div>

        {/* Action Button: Assign Overtime (Only for admin/manager) */}
        {canReview && (
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="relative z-10 h-11 px-5 rounded-2xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-sm shadow-red-500/20 hover:shadow-md hover:shadow-red-500/30 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <UserPlus size={16} />
            Assign Overtime
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/60 shadow-sm self-start gap-1">
        {canReview && (
          <button
            onClick={() => handleTabChange('pending')}
            className={`h-10 px-5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-red-600 text-white shadow-sm shadow-red-600/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock size={16} />
            Pending Review
          </button>
        )}
        <button
          onClick={() => handleTabChange('monitoring')}
          className={`h-10 px-5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
            activeTab === 'monitoring'
              ? 'bg-red-600 text-white shadow-sm shadow-red-600/10'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Monitor size={16} />
          Live Monitoring
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={`h-10 px-5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-red-600 text-white shadow-sm shadow-red-600/10'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History size={16} />
          Request History
        </button>
      </div>

      {/* Main Content Area */}
      <div>
        {activeTab === 'pending' && <OvertimeListPage role={role} statusFilter="PENDING" refreshKey={refreshKey} />}
        {activeTab === 'history' && (
          <div className="space-y-6">
             <div className="mb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Approved & Rejected Requests
                  </h2>
                  <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
                     <button 
                       onClick={() => setHistoryFilter('ALL')} 
                       className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                         historyFilter === 'ALL' 
                           ? 'bg-white text-slate-800 shadow-sm' 
                           : 'text-slate-600 hover:text-slate-900'
                       }`}
                     >
                       All History
                     </button>
                     <button 
                       onClick={() => setHistoryFilter('APPROVED')} 
                       className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                         historyFilter === 'APPROVED' 
                           ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/10' 
                           : 'text-emerald-600 hover:text-emerald-700'
                       }`}
                     >
                       Approved
                     </button>
                     <button 
                       onClick={() => setHistoryFilter('REJECTED')} 
                       className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                         historyFilter === 'REJECTED' 
                           ? 'bg-red-500 text-white shadow-sm shadow-red-500/10' 
                           : 'text-red-600 hover:text-red-700'
                       }`}
                     >
                       Rejected
                     </button>
                     <button 
                       onClick={() => setHistoryFilter('DELETED')} 
                       className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                         historyFilter === 'DELETED' 
                           ? 'bg-slate-500 text-white shadow-sm shadow-slate-500/10' 
                           : 'text-slate-600 hover:text-slate-700'
                       }`}
                     >
                       Deleted
                     </button>
                  </div>
                </div>
                <OvertimeListPage role={role} statusFilter={historyFilter === 'ALL' ? undefined : historyFilter} hidePending={true} refreshKey={refreshKey} />
             </div>
          </div>
        )}
        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <div className="mb-4">
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 mb-6">
                Live Overtime Sessions
              </h2>
              <OTMonitoringTab role={role} />
            </div>
          </div>
        )}
      </div>

      {isAssignModalOpen && (
        <AssignOvertimeModal
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setRefreshKey(k => k + 1);
          }}
          role={role}
        />
      )}
    </div>
  );
}
