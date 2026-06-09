'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileCheck, History } from 'lucide-react';
import { AdjustmentListPage } from './AdjustmentListPage';
import { AdjustmentAuditLogsDashboard } from './AdjustmentAuditLogsDashboard';

interface AdjustmentsDashboardProps {
  role: 'admin' | 'hr' | 'manager';
}

export function AdjustmentsDashboard({ role }: AdjustmentsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'pending';
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>(initialTab);

  // Sync state to URL when tab changes manually
  const handleTabChange = (tab: 'pending' | 'history') => {
    setActiveTab(tab);
    // Remove entityId if switching tabs to avoid stale filters
    router.push(`?tab=${tab}`, { scroll: false });
  };

  // Sync state from URL when URL changes (e.g., from "View Audit Detail" link)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'history') {
      setActiveTab('history');
    } else {
      setActiveTab('pending');
    }
  }, [searchParams]);

  return (
    <div className="space-y-[16px] sm:space-y-[24px] max-w-full bg-[#F5F5F5] min-h-screen">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end bg-white px-[16px] sm:px-[20px] py-[16px] sm:py-[24px] border-b border-[#E0E0E0]">
        <div className="space-y-[6px] sm:space-y-[8px]">
          <h1 className="text-[24px] sm:text-[28px] font-bold text-[#212121] tracking-tight leading-none">
            Adjustments
          </h1>
          <p className="text-[#757575] text-[13px] sm:text-[14px] font-medium">
            Manage attendance adjustments and track modification history.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-[8px] mt-[16px] md:mt-0 w-full sm:w-auto">
          <button
            onClick={() => handleTabChange('pending')}
            className={`h-[36px] px-[16px] rounded-[6px] text-[13px] sm:text-[14px] font-medium transition-all duration-200 flex items-center justify-center gap-[8px] border w-full sm:w-auto ${
              activeTab === 'pending'
                ? 'bg-[#D0021B] text-white border-[#D0021B]'
                : 'bg-transparent text-[#D0021B] border-[#D0021B] hover:bg-[#D0021B]/5'
            }`}
          >
            <FileCheck size={16} />
            Pending Review
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`h-[36px] px-[16px] rounded-[6px] text-[13px] sm:text-[14px] font-medium transition-all duration-200 flex items-center justify-center gap-[8px] border w-full sm:w-auto ${
              activeTab === 'history'
                ? 'bg-[#616161] text-white border-[#616161]'
                : 'bg-transparent text-[#616161] border-[#E0E0E0] hover:bg-[#F5F5F5]'
            }`}
          >
            <History size={16} />
            History / Audit Trail
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="px-[12px] sm:px-[20px]">
        {activeTab === 'pending' && <AdjustmentListPage role={role} />}
        {activeTab === 'history' && <AdjustmentAuditLogsDashboard />}
      </div>
    </div>
  );
}
