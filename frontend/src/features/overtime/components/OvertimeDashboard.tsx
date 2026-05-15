'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, History } from 'lucide-react';
import { OvertimeListPage } from './OvertimeListPage';

interface OvertimeDashboardProps {
  role: 'admin' | 'hr' | 'manager';
}

export function OvertimeDashboard({ role }: OvertimeDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canReview = role === 'manager';
  const initialTab = (searchParams.get('tab') === 'history' || !canReview) ? 'history' : 'pending';
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>(initialTab);

  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'APPROVED' | 'REJECTED' | 'DELETED'>('ALL');

  const handleTabChange = (tab: 'pending' | 'history') => {
    setActiveTab(tab);
    router.push(`?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'history' || !canReview) {
      setActiveTab('history');
    } else {
      setActiveTab('pending');
    }
  }, [searchParams]);

  return (
    <div className="space-y-[24px] max-w-full bg-[#F5F5F5] min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end bg-white px-[20px] py-[24px] border-b border-[#E0E0E0]">
        <div className="space-y-[8px]">
          <h1 className="text-[28px] font-bold text-[#212121] tracking-tight leading-none flex items-center gap-3">
            Overtime Requests
          </h1>
          <p className="text-[#757575] text-[14px] font-medium">
            Manage employee overtime requests and history.
          </p>
        </div>

        <div className="flex items-center gap-[8px] mt-[16px] md:mt-0">
          {canReview && (
            <button
              onClick={() => handleTabChange('pending')}
              className={`h-[36px] px-[16px] rounded-[6px] text-[14px] font-medium transition-all duration-200 flex items-center gap-[8px] border ${
                activeTab === 'pending'
                  ? 'bg-[#10B981] text-white border-[#10B981]' // Emerald color
                  : 'bg-transparent text-[#10B981] border-[#10B981] hover:bg-[#10B981]/5'
              }`}
            >
              <Clock size={16} />
              Pending Review
            </button>
          )}
          <button
            onClick={() => handleTabChange('history')}
            className={`h-[36px] px-[16px] rounded-[6px] text-[14px] font-medium transition-all duration-200 flex items-center gap-[8px] border ${
              activeTab === 'history'
                ? 'bg-[#616161] text-white border-[#616161]'
                : 'bg-transparent text-[#616161] border-[#E0E0E0] hover:bg-[#F5F5F5]'
            }`}
          >
            <History size={16} />
            Request History
          </button>
        </div>
      </div>

      <div className="px-[20px]">
        {activeTab === 'pending' && <OvertimeListPage role={role} statusFilter="PENDING" />}
        {activeTab === 'history' && (
          <div className="space-y-6">
             <div className="mb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Approved & Rejected Requests</h2>
                  <div className="flex items-center gap-2 mt-4 md:mt-0">
                     <button onClick={() => setHistoryFilter('ALL')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${historyFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>All History</button>
                     <button onClick={() => setHistoryFilter('APPROVED')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${historyFilter === 'APPROVED' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>Approved</button>
                     <button onClick={() => setHistoryFilter('REJECTED')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${historyFilter === 'REJECTED' ? 'bg-red-500 text-white shadow-sm shadow-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>Rejected</button>
                     <button onClick={() => setHistoryFilter('DELETED')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${historyFilter === 'DELETED' ? 'bg-slate-500 text-white shadow-sm shadow-slate-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Deleted</button>
                  </div>
                </div>
                <OvertimeListPage role={role} statusFilter={historyFilter === 'ALL' ? undefined : historyFilter} hidePending={true} />
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
