'use client'

import React from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { fieldLabels, GroupedAuditLog } from '../utils/adjustment-log-types'

function formatValue(field: string, value: string | null): string {
  if (!value) return 'None';
  if (field === 'status') {
    const lower = value.toLowerCase();
    if (lower === 'present') return 'On Time';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
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
        const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
        const mins = pht.getUTCHours() * 60 + pht.getUTCMinutes();
        return mins > 8 * 60 + 30 ? 'text-amber-500' : 'text-emerald-600';
      }
    } catch { }
  }
  return 'text-emerald-600';
}

function formatDateOnly(iso?: string) {
  if (!iso) return '—';
  try {
      return new Date(iso).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

export interface AdjustmentAuditLogsMobileCardsProps {
    loading: boolean
    sortedGroupedLogs: GroupedAuditLog[]
}

export function AdjustmentAuditLogsMobileCards({
    loading,
    sortedGroupedLogs,
}: AdjustmentAuditLogsMobileCardsProps) {
    if (loading) {
        return (
            <div className="px-[20px] py-[64px] text-center flex flex-col items-center gap-[12px]">
                <Loader2 size={24} className="animate-spin text-[#D0021B]" />
                <span className="text-[12px] font-bold text-[#9E9E9E] uppercase tracking-widest">Loading Audit Logs...</span>
            </div>
        )
    }

    if (sortedGroupedLogs.length === 0) {
        return (
            <div className="px-[20px] py-[48px] text-center text-[#9E9E9E] font-bold uppercase text-[12px] tracking-[0.8px]">
                No adjustment logs found
            </div>
        )
    }

    return (
        <div className="divide-y divide-[#E0E0E0]">
            {sortedGroupedLogs.map((group) => {
                const isDeleteEntry = group.logs.some(
                    (log) =>
                        (log.field === 'record' && log.newValue === 'deleted') ||
                        (log.field === 'status' && log.newValue === 'deleted')
                );

                const isCreateEntry = group.logs.some(
                    (log) =>
                        log.field === 'record' && log.newValue === 'created'
                );

                const getActionTypeInfo = () => {
                    if (isDeleteEntry) return { label: 'DELETED', color: 'bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]' };
                    if (isCreateEntry || group.actionType === 'ATTENDANCE_OVERRIDE') return { label: 'CREATION', color: 'bg-[#FFF8E1] text-[#F57F17] border-[#FFE082]' };
                    if (group.actionType === 'ADJUSTMENT_APPROVE') return { label: 'CORRECTION', color: 'bg-[#E3F2FD] text-[#1565C0] border-[#BBDEFB]' };
                    return { label: 'EDIT', color: 'bg-[#F5F5F5] text-[#616161] border-[#E0E0E0]' };
                };
                const actionInfo = getActionTypeInfo();

                const processedDateObj = new Date(group.createdAt);
                const processedDateStr = processedDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const processedTimeStr = processedDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                return (
                    <div key={group.key} className="p-[16px] space-y-[12px] bg-white hover:bg-[#F5F5F5] transition-colors">
                        {/* Action Badge & Attendance Date */}
                        <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center px-[8px] py-[3.5px] rounded-[4px] text-[10px] font-bold uppercase tracking-[0.5px] border ${actionInfo.color}`}>
                                {actionInfo.label}
                            </span>
                            <span className="text-[11px] font-semibold text-[#212121] bg-[#F5F5F5] border border-[#E0E0E0] px-[6px] py-[1.5px] rounded-[4px]">
                                {formatDateOnly(group.attendanceDate)}
                            </span>
                        </div>

                        {/* Employee Name */}
                        <div className="space-y-[2px]">
                            <h4 className="font-bold text-[#212121] text-[15px] leading-tight">
                                {group.employeeName}
                            </h4>
                            <p className="text-[11px] text-[#757575]">{group.branch}</p>
                        </div>

                        {/* Summary / Reason */}
                        <div className="text-[12px] text-[#757575] leading-relaxed">
                            <span className="font-semibold text-[#424242]">Reason / Summary:</span> {group.reason || 'No details provided'}
                        </div>

                        {/* Changes Details Block */}
                        <div className="bg-[#FAFAFA] border border-[#E0E0E0] p-[10px] rounded-[8px] space-y-[6px]">
                            <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#9E9E9E] mb-[4px]">
                                Logged Changes
                            </p>
                            {isDeleteEntry ? (
                                <div className="inline-flex items-center gap-[6px] px-[8px] py-[4px] bg-[#FFEBEE] border border-[#FFCDD2] rounded-[6px] text-[#C62828]">
                                    <Trash2 size={12} className="shrink-0" />
                                    <span className="text-[10px] font-bold uppercase">Record Removed</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-[6px]">
                                    {group.logs.map((log, idx) => (
                                        <div key={`change-${idx}`} className="flex flex-wrap items-center gap-x-[6px] text-[11px] leading-normal">
                                            <span className="font-semibold text-[#616161]">{fieldLabels[log.field] || log.field}:</span>
                                            <span className="text-[#9E9E9E] line-through decoration-[#BDBDBD]">
                                                {formatValue(log.field, log.oldValue)}
                                            </span>
                                            <span className={`font-black ${getChangeColor(log.field, log.newValue)}`}>
                                                → {formatValue(log.field, log.newValue)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Processing info */}
                        <div className="pt-[6px] flex flex-col gap-[4px] text-[10px] text-[#9E9E9E] border-t border-[#F0F0F0]">
                            <div className="flex justify-between">
                                <span>Requested by: <span className="font-medium text-[#616161]">{group.adjusterName}</span></span>
                                <span>Approved by: <span className="font-medium text-[#616161]">{group.approverName || group.adjusterName}</span></span>
                            </div>
                            <div className="text-right">
                                Processed on {processedDateStr} at {processedTimeStr}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
