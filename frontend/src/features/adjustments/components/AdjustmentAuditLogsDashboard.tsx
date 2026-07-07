'use client'

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, ChevronUp, ChevronDown, Loader2, Filter, Trash2 } from 'lucide-react';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { DataTablePagination } from '@/components/ui/DataTablePagination';
import { useAdjustmentLogs } from '../hooks/useAdjustmentLogs';
import { fieldLabels, GroupedAuditLog } from '../utils/adjustment-log-types';
import { AdjustmentAuditLogsMobileCards } from './AdjustmentAuditLogsMobileCards';

/* ── Helpers ── */
function formatValue(field: string, value: string | null): string {
  if (!value) return 'None';
  if (field === 'status') {
    const lower = value.toLowerCase();
    if (lower === 'present') return 'On Time';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  // ISO date string → formatted 12-hour time
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return value;
  }
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function getChangeColor(field: string, newValue: string | null): string {
  if (!newValue) return 'text-emerald-600';
  if (field === 'status') {
    const lower = newValue.toLowerCase();
    return lower === 'late' ? 'text-amber-500' : 'text-emerald-600';
  }
  if (field === 'checkInTime') {
    try {
      const d = new Date(newValue);
      if (!isNaN(d.getTime())) {
        // Convert to PHT and check if after 8:30 AM
        const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
        const mins = pht.getUTCHours() * 60 + pht.getUTCMinutes();
        return mins > 8 * 60 + 30 ? 'text-amber-500' : 'text-emerald-600';
      }
    } catch { }
  }
  return 'text-emerald-600';
}

export function AdjustmentAuditLogsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityIdParam = parseInt(searchParams.get('entityId') || '') || null;

  const {
    groupedLogs, loading, totalCount, totalPages, currentPage,
    searchQuery, branchFilter, branches, itemsPerPage,
    setCurrentPage, setSearchQuery, setBranchFilter
  } = useAdjustmentLogs({ initialEntityId: entityIdParam });

  const clearEntityFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('entityId');
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dragScrollRef = useHorizontalDragScroll();

  const { sortedData: sortedGroupedLogs, sortKey, sortOrder, handleSort } = useTableSort({
    initialData: groupedLogs
  });
  const sortKeyStr = sortKey as string | null;



  interface CustomSelectProps {
    value: string
    options: string[]
    onChange: (value: string) => void
    id: string
    placeholder?: string
  }

  const CustomSelect = ({ value, options, onChange, placeholder, id }: CustomSelectProps) => (
    <div className="relative w-full md:w-[200px]">
      <button
        id={id}
        onClick={(e) => {
          e.stopPropagation();
          setOpenDropdown(openDropdown === id ? null : id);
        }}
        className={`w-full h-[40px] px-[12px] flex items-center justify-between bg-white border ${openDropdown === id ? 'border-[#D0021B] ring-4 ring-[#D0021B]/5' : 'border-[#E0E0E0]'} rounded-[6px] text-[14px] text-[#212121] transition-all`}
      >
        <span className={!value || value === 'All Branches' ? 'text-[#9E9E9E]' : 'text-[#212121]'}>
          {value || placeholder || 'Select...'}
        </span>
        <ChevronDown className={`w-[16px] h-[16px] text-[#9E9E9E] transition-transform ${openDropdown === id ? 'rotate-180 text-[#D0021B]' : ''}`} />
      </button>

      {openDropdown === id && (
        <div className="absolute top-full left-0 right-0 mt-[4px] py-[4px] bg-white border border-[#E0E0E0] rounded-[6px] shadow-lg z-50 max-h-[240px] overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpenDropdown(null);
              }}
              className={`w-full px-[12px] py-[8px] text-left text-[13px] hover:bg-gray-50 transition-colors ${value === opt ? 'text-[#D0021B] font-medium bg-[#D0021B]/5' : 'text-[#424242]'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const formatDateOnly = (iso?: string) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
  };

  return (
    <div className="space-y-[16px] relative pb-[24px]" onClick={() => setOpenDropdown(null)}>
      {/* Active entityId filter banner */}
      {entityIdParam && (
        <div className="flex items-center gap-[12px] px-[16px] py-[10px] bg-[#FFEBEE] border border-[#FFCDD2] rounded-[8px] text-[14px]">
          <Filter size={14} className="text-[#C62828] shrink-0" />
          <span className="text-[#C62828] font-medium flex-1">
            Showing audit trail for a specific adjustment record
          </span>
          <button
            onClick={clearEntityFilter}
            className="flex items-center gap-[4px] text-[11px] font-bold uppercase tracking-[0.5px] text-[#C62828] hover:underline"
          >
            <X size={12} /> Clear Filter
          </button>
        </div>
      )}

      {/* Filter Row */}
      <div className="flex flex-col md:flex-row items-center gap-[8px]" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#9E9E9E] group-focus-within:text-[#D0021B] transition-colors" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee or admin..."
            className="w-full h-[40px] pl-[36px] pr-[36px] bg-white border border-[#E0E0E0] rounded-[6px] text-[14px] text-[#212121] outline-none focus:border-[#D0021B] focus:ring-4 focus:ring-[#D0021B]/5 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[#9E9E9E] hover:text-[#212121]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <CustomSelect id="branch" value={branchFilter} options={branches} onChange={setBranchFilter} placeholder="All Branches" />
      </div>

      {/* Audit Log Table Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-[12px] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Mobile View */}
        <div className="md:hidden">
          <AdjustmentAuditLogsMobileCards
            loading={loading}
            sortedGroupedLogs={sortedGroupedLogs}
          />
        </div>

        {/* Desktop View */}
        <div
          ref={dragScrollRef}
          className="hidden md:block overflow-x-auto scrollbar-table"
          tabIndex={0}
          role="region"
          aria-label="Adjustment audit logs table — scroll horizontally"
        >
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#E0E0E0] bg-white">
                <SortableHeader label="EMPLOYEE" sortKey="employeeName" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]" />
                <SortableHeader label="REQUESTED BY" sortKey="adjusterName" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]" />
                <SortableHeader label="APPROVED BY" sortKey="approverName" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]" />
                <th className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]">ACTION TYPE</th>
                <th className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]">ATTENDANCE DATE</th>
                <SortableHeader label="PROCESSED DATE" sortKey="createdAt" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]" />
                <th className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]">SUMMARY</th>
                <th className="px-[20px] py-[16px] text-right pr-[40px] text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]">DETAILS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-[20px] py-[64px] text-center">
                    <div className="flex flex-col items-center gap-[12px]">
                      <Loader2 size={24} className="animate-spin text-[#D0021B]" />
                      <span className="text-[12px] font-bold text-[#9E9E9E] uppercase tracking-widest">Loading Audit Logs...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedGroupedLogs.length > 0 ? sortedGroupedLogs.map((group: GroupedAuditLog, index: number) => {
                // Detect if this is a deletion or creation entry
                const isDeleteEntry = group.logs.some(
                    (log: { field: string; newValue: string | null }) =>
                        (log.field === 'record' && log.newValue === 'deleted') ||
                        (log.field === 'status' && log.newValue === 'deleted')
                );

                const isCreateEntry = group.logs.some(
                    (log: { field: string; newValue: string | null }) =>
                        log.field === 'record' && log.newValue === 'created'
                );

                const rowClassName = `group transition-all duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'} hover:bg-[#F5F5F5] cursor-default`;

                const getActionTypeInfo = () => {
                    if (isDeleteEntry) return { label: 'DELETED', color: 'bg-[#FFEBEE] text-[#C62828]' };
                    if (isCreateEntry || group.actionType === 'ATTENDANCE_OVERRIDE') return { label: 'CREATION', color: 'bg-[#FFF8E1] text-[#F57F17]' };
                    if (group.actionType === 'ADJUSTMENT_APPROVE') return { label: 'CORRECTION', color: 'bg-[#E3F2FD] text-[#1565C0]' };
                    return { label: 'EDIT', color: 'bg-[#F5F5F5] text-[#616161]' };
                };
                const actionInfo = getActionTypeInfo();

                // Split created at into date and time
                const processedDateObj = new Date(group.createdAt);
                const processedDateStr = processedDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const processedTimeStr = processedDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                return (
                <tr key={group.key} className={rowClassName}>
                  <td className="px-[20px] py-[16px] align-top">
                    <div className="text-[14px] font-semibold text-[#212121] leading-tight">{group.employeeName}</div>
                    <div className="text-[12px] text-[#9E9E9E] mt-[2px]">{group.branch}</div>
                  </td>
                  <td className="px-[20px] py-[16px] align-top">
                    <span className="text-[14px] text-[#212121]">{group.adjusterName}</span>
                  </td>
                  <td className="px-[20px] py-[16px] align-top">
                    <span className="text-[14px] text-[#757575]">{group.approverName || group.adjusterName}</span>
                  </td>
                  <td className="px-[20px] py-[16px] align-top">
                    <span className={`inline-flex items-center px-[8px] py-[3px] rounded-[4px] text-[11px] font-bold uppercase tracking-[0.5px] ${actionInfo.color}`}>
                        {actionInfo.label}
                    </span>
                  </td>
                  <td className="px-[20px] py-[16px] align-top">
                    <span className="text-[14px] text-[#212121] whitespace-nowrap">{formatDateOnly(group.attendanceDate)}</span>
                  </td>
                  <td className="px-[20px] py-[16px] align-top">
                    <div className="text-[14px] text-[#212121] leading-tight">{processedDateStr}</div>
                    <div className="text-[12px] text-[#9E9E9E] mt-[2px]">{processedTimeStr}</div>
                  </td>
                  <td className="px-[20px] py-[16px] align-top max-w-[200px]">
                    <p className="text-[13px] text-[#757575] leading-snug line-clamp-2" title={group.reason}>
                      {group.reason}
                    </p>
                  </td>
                  <td className="px-[20px] py-[16px] text-right pr-[40px] align-top relative">
                    <div className="flex items-center justify-end gap-[12px]">
                        {isDeleteEntry ? (
                            <div className="inline-flex items-center gap-[6px] px-[8px] py-[4px] bg-[#FFEBEE] border border-[#FFCDD2] rounded-[6px] text-[#C62828]">
                                <Trash2 size={12} className="shrink-0" />
                                <span className="text-[10px] font-bold uppercase">Removed</span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-[6px] items-end">
                            {group.logs.map((log: { id: string | number; field: string; oldValue: string | null; newValue: string | null }, idx: number) => {
                                const isNotes = log.field === 'notes';
                                return (
                                <div 
                                    key={`change-${idx}`} 
                                    className={`flex ${isNotes ? 'flex-col items-start gap-[4px] text-left max-w-[450px] whitespace-normal' : 'items-center gap-[6px] whitespace-nowrap'} bg-[#F5F5F5] border border-[#E0E0E0] px-[8px] py-[4px] rounded-[4px] text-[10px]`}
                                >
                                    <span className="font-bold text-[#9E9E9E] uppercase tracking-tight">{fieldLabels[log.field] || log.field}:</span>
                                    {isNotes ? (
                                        <div className="flex flex-col gap-[2px] mt-[2px] w-full text-[9px] leading-snug">
                                            {log.oldValue && log.oldValue !== 'None' && (
                                                <div className="text-[#9E9E9E] line-through decoration-[#BDBDBD] break-words">
                                                    {formatValue(log.field, log.oldValue)}
                                                </div>
                                            )}
                                            <div className={`font-black ${getChangeColor(log.field, log.newValue)} break-words`}>
                                                → {formatValue(log.field, log.newValue)}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-[#9E9E9E] line-through decoration-[#BDBDBD]">
                                                {formatValue(log.field, log.oldValue)}
                                            </span>
                                            <span className={`font-black ${getChangeColor(log.field, log.newValue)}`}>
                                                → {formatValue(log.field, log.newValue)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )})}
                            </div>
                        )}
                    </div>
                  </td>
                </tr>
              )}) : (
                <tr>
                  <td colSpan={8} className="px-[20px] py-[64px] text-center text-[#9E9E9E] font-bold uppercase text-[12px] tracking-[0.8px]">
                    No adjustment logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalCount={totalCount}
            pageSize={itemsPerPage}
            entityName="audit logs"
            loading={loading}
        />
      </div>
    </div>
  );
}
