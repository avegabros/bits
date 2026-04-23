'use client'

import React, { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, CalendarSearch, X, ChevronUp, ChevronDown, Loader2, Filter } from 'lucide-react';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { DataTablePagination } from '@/components/ui/DataTablePagination';
import { useAdjustmentLogs } from '../hooks/useAdjustmentLogs';
import { fieldLabels, GroupedAuditLog } from '../utils/adjustment-log-types';

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
    searchQuery, branchFilter, logDate, branches, itemsPerPage,
    setCurrentPage, setSearchQuery, setBranchFilter, setLogDate
  } = useAdjustmentLogs({ initialEntityId: entityIdParam });

  const clearEntityFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('entityId');
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const logDateRef = useRef<HTMLInputElement>(null);
  const dragScrollRef = useHorizontalDragScroll();

  const { sortedData: sortedGroupedLogs, sortKey, sortOrder, handleSort } = useTableSort({
    initialData: groupedLogs
  });
  const sortKeyStr = sortKey as string | null;

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "Select Date";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const CustomSelect = ({ value, options, onChange, id }: any) => {
    const isOpen = openDropdown === id;
    return (
      <div className="relative min-w-[180px]">
        <button
          onClick={(e) => { e.stopPropagation(); setOpenDropdown(isOpen ? null : id); }}
          className={`w-full flex items-center justify-between px-5 py-3 bg-brand text-white rounded-lg text-xs font-bold transition-all ${isOpen ? 'rounded-b-none' : 'shadow-md'}`}
        >
          <span>{value}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 flex flex-col pt-1">
            <button
              className="w-full text-left px-5 py-3 bg-brand-dark text-white hover:bg-red-500 transition-colors text-xs font-bold first:mt-0 mt-px rounded-sm shadow-sm"
              onClick={() => {
                onChange("All Branches");
                setOpenDropdown(null);
              }}
            >
              All Branches
            </button>
            {options.map((opt: string) => (
              <button
                key={opt}
                className="w-full text-left px-5 py-3 bg-brand-dark text-white hover:bg-red-500 transition-colors text-xs font-bold first:mt-0 mt-px rounded-sm last:rounded-b-lg shadow-sm"
                onClick={() => {
                  onChange(opt);
                  setOpenDropdown(null);
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 relative" onClick={() => setOpenDropdown(null)}>
      {/* Sub-panel: title is owned by AdjustmentsDashboard History tab */}

      {/* Active entityId filter banner */}
      {entityIdParam && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm">
          <Filter size={14} className="text-red-600 shrink-0" />
          <span className="text-red-700 font-bold flex-1">
            Showing audit trail for a specific adjustment record
          </span>
          <button
            onClick={clearEntityFilter}
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-600 hover:text-red-800 transition-colors"
          >
            <X size={12} /> Clear Filter
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee or admin..."
            className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400/20 outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <div className="relative">
            <input
              type="date"
              ref={logDateRef}
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="absolute opacity-0 pointer-events-none"
            />
            <button
              onClick={() => {
                if (logDateRef.current && 'showPicker' in logDateRef.current) {
                  logDateRef.current.showPicker()
                }
              }}
              className="min-w-[180px] flex items-center justify-between px-5 py-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none shadow-sm hover:border-red-200 transition-all"
            >
              <div className="flex items-center gap-3">
                <CalendarSearch size={14} className="text-slate-400" />
                <span>{formatDateLabel(logDate)}</span>
              </div>
              {logDate && (
                <X
                  size={14}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setLogDate(""); }}
                />
              )}
            </button>
          </div>
          <CustomSelect id="branch" value={branchFilter} options={branches} onChange={setBranchFilter} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          ref={dragScrollRef}
          className="overflow-x-auto scrollbar-table"
          tabIndex={0}
          role="region"
          aria-label="Adjustment audit logs table — scroll horizontally"
        >
          <table className="w-full text-left text-sm border-collapse table-auto min-w-[900px]">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
              <tr>
                <SortableHeader label="Timestamp" sortKey="createdAt" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-4 py-3.5" />
                <SortableHeader label="Adjusted By" sortKey="adjusterName" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-4 py-3.5" />
                <SortableHeader label="Branch" sortKey="branch" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-4 py-3.5" />
                <SortableHeader label="Target Employee" sortKey="employeeName" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-4 py-3.5" />
                <th className="px-4 py-3.5">Modified Field</th>
                <th className="px-4 py-3.5">Changes Made</th>
                <th className="px-4 py-3.5 text-right pr-10">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-bold uppercase text-[10px] tracking-widest">Loading audit logs...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedGroupedLogs.length > 0 ? sortedGroupedLogs.map((group: GroupedAuditLog) => (
                <tr key={group.key} className="hover:bg-red-50 transition-colors duration-200 group cursor-default">
                  <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 whitespace-nowrap align-top">{formatTimestamp(group.createdAt)}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-700 underline decoration-red-100 underline-offset-4 decoration-2 align-top">{group.adjusterName}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-500 text-xs align-top">{group.branch}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-700 align-top">{group.employeeName}</td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="flex flex-col gap-1.5">
                      {group.logs.map((log: { id: string | number; field: string; oldValue: string | null; newValue: string | null }, idx: number) => (
                        <span key={`field-${idx}`} className="text-[10px] font-black uppercase tracking-tight text-slate-600">
                          {fieldLabels[log.field] || log.field}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="flex flex-col gap-1.5">
                      {group.logs.map((log: { id: string | number; field: string; oldValue: string | null; newValue: string | null }, idx: number) => (
                        <div key={`change-${idx}`} className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-[10px] text-slate-400 line-through decoration-slate-300">
                            {formatValue(log.field, log.oldValue)}
                          </span>
                          <span className={`text-xs font-black ${getChangeColor(log.field, log.newValue)}`}>
                            → {formatValue(log.field, log.newValue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right pr-10 align-top">
                    <p className="text-[11px] font-medium text-slate-500 leading-relaxed max-w-[200px] ml-auto">
                      {group.reason}
                    </p>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                    No adjustment logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalCount={totalCount}
          pageSize={itemsPerPage}
          entityName="records"
          loading={loading}
        />
      </div>
    </div>
  );
}
