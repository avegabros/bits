'use client'

import React from 'react'

import { Loader2, CheckCircle2, XCircle, Clock, Trash2, LucideIcon } from 'lucide-react'
import { SortableHeader } from '@/components/ui/SortableHeader'
import { Adjustment } from '@/features/adjustments/types'
import { formatTime, formatTimestamp, formatDate, empName } from '../hooks/useAdjustmentList'

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: LucideIcon }> = {
    pending: { label: 'Pending', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: Clock },
    approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
    rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
    cancelled: { label: 'Cancelled', bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', icon: XCircle },
}

export interface AdjustmentTableProps {
    loading: boolean
    sortedAdjustments: Adjustment[]
    sortKeyStr: string | null
    sortOrder: 'asc' | 'desc' | null
    statusFilter: string
    isAdmin: boolean
    currentUserId: number | null
    actionLoading: boolean
    handleSort: (key: string) => void
    onApprove: (id: number) => void
    onReject: (id: number) => void
    onCancel: (id: number) => void
}

export function AdjustmentTable({
    loading,
    sortedAdjustments,
    sortKeyStr,
    sortOrder,
    statusFilter,
    isAdmin,
    currentUserId,
    actionLoading,
    handleSort,
    onApprove,
    onReject,
    onCancel,
}: AdjustmentTableProps) {
    return (
        <table className="w-full border-collapse">
            <thead>
                <tr className="border-b border-[#E0E0E0] bg-white">
                    <SortableHeader label="SUBMITTED" sortKey="submittedAt" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]" />
                    <th className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]">TYPE</th>
                    <SortableHeader label="EMPLOYEE" sortKey="attendance.employee.lastName" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]" />
                    <th className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]">ORIGINAL TIME</th>
                    <th className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]">REQUESTED TIME</th>
                    <th className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]">REASON</th>
                    <SortableHeader label="SUBMITTED BY" sortKey="submittedBy.lastName" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-[20px] py-[16px] text-left text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]" />
                    <SortableHeader label="STATUS" sortKey="status" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-[20px] py-[16px] text-center text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]" />
                    <th className="px-[20px] py-[16px] text-center text-[11px] font-semibold text-[#9E9E9E] uppercase tracking-[0.8px]">ACTIONS / REVIEWED</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
                {loading ? (
                    <tr>
                        <td colSpan={9} className="px-[20px] py-[64px] text-center">
                            <div className="flex flex-col items-center gap-[12px]">
                                <Loader2 size={24} className="animate-spin text-[#D0021B]" />
                                <span className="text-[12px] font-bold text-[#9E9E9E] uppercase tracking-widest italic">Loading adjustments...</span>
                            </div>
                        </td>
                    </tr>
                ) : sortedAdjustments.length > 0 ? sortedAdjustments.map((adj, index) => {
                    const isDelete = adj.type === 'DELETE'
                    
                    const getStatusStyle = (status: string) => {
                        switch (status) {
                            case 'approved': return 'bg-[#E8F5E9] text-[#2E7D32]';
                            case 'rejected': return 'bg-[#FFEBEE] text-[#C62828]';
                            default: return 'bg-[#FFF8E1] text-[#F57F17]';
                        }
                    }

                    const rowClassName = `group transition-all duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'} hover:bg-[#F5F5F5] cursor-default`;

                    // Split submitted at into date and time
                    const subDateObj = new Date(adj.submittedAt);
                    const subDateStr = subDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const subTimeStr = subDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                    return (
                        <tr key={adj.id} className={rowClassName}>
                            <td className="px-[20px] py-[16px] align-top whitespace-nowrap">
                                <div className="text-[13px] text-[#212121] leading-tight font-medium">{subDateStr}</div>
                                <div className="text-[11px] text-[#9E9E9E] mt-[2px]">{subTimeStr}</div>
                            </td>

                            <td className="px-[20px] py-[16px] align-top">
                                {isDelete ? (
                                    <span className="inline-flex items-center gap-[4px] px-[8px] py-[3px] rounded-[4px] bg-[#FFEBEE] text-[#C62828] font-bold text-[11px] uppercase tracking-[0.5px]">
                                        <Trash2 size={10} />
                                        Delete
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-[4px] px-[8px] py-[3px] rounded-[4px] bg-[#E3F2FD] text-[#1565C0] font-bold text-[11px] uppercase tracking-[0.5px]">
                                        Edit
                                    </span>
                                )}
                            </td>

                            <td className="px-[20px] py-[16px] align-top min-w-[180px]">
                                <div className="font-semibold text-[#212121] text-[14px] leading-tight">{empName(adj.attendance?.employee)}</div>
                                <div className="text-[12px] text-[#9E9E9E] mt-[2px]">
                                    {adj.attendance?.employee?.Branch?.name}
                                </div>
                                <div className="text-[12px] text-[#212121] font-medium mt-[4px] px-[6px] py-[2px] bg-[#F5F5F5] border border-[#E0E0E0] rounded-[4px] inline-block">
                                    {formatDate(adj.attendance?.date)}
                                </div>
                            </td>

                            <td className="px-[20px] py-[16px] align-top whitespace-nowrap">
                                <div className="text-[12px] text-[#757575] space-y-[2px]">
                                    <div>In: <span className="font-bold text-[#212121]">{formatTime(adj.originalCheckIn)}</span></div>
                                    <div>Out: <span className="font-bold text-[#212121]">{formatTime(adj.originalCheckOut)}</span></div>
                                </div>
                            </td>

                            <td className="px-[20px] py-[16px] align-top whitespace-nowrap">
                                {isDelete ? (
                                    <div className="flex flex-col gap-[2px]">
                                        <span className="text-[10px] font-bold text-[#C62828] uppercase tracking-[0.5px]">Record Deletion</span>
                                        <span className="text-[11px] text-[#9E9E9E]">Removing all logs</span>
                                    </div>
                                ) : (
                                    <div className="text-[12px] text-[#1565C0] space-y-[2px] font-bold bg-[#E3F2FD] px-[8px] py-[4px] rounded-[6px] border border-[#BBDEFB]">
                                        <div>In: {formatTime(adj.requestedCheckIn)}</div>
                                        <div>Out: {formatTime(adj.requestedCheckOut)}</div>
                                    </div>
                                )}
                            </td>

                            <td className="px-[20px] py-[16px] align-top max-w-[200px]">
                                <p className="text-[13px] text-[#757575] leading-snug line-clamp-2" title={adj.reason}>{adj.reason}</p>
                                {adj.rejectionReason && (
                                    <div className="mt-[6px] p-[6px] bg-[#FFEBEE] rounded-[4px] border border-[#FFCDD2] flex items-start gap-[6px]">
                                        <XCircle size={12} className="text-[#C62828] mt-[2px] shrink-0" />
                                        <p className="text-[11px] text-[#C62828] font-medium line-clamp-2" title={adj.rejectionReason}>{adj.rejectionReason}</p>
                                    </div>
                                )}
                            </td>
                            <td className="px-[20px] py-[16px] align-top font-medium text-[#212121] text-[13px] whitespace-nowrap">
                                {adj.submittedBy ? `${adj.submittedBy.firstName} ${adj.submittedBy.lastName}` : ''}
                            </td>
                            <td className="px-[20px] py-[16px] align-top text-center">
                                <span className={`inline-flex items-center gap-[4px] font-bold text-[11px] uppercase tracking-[0.5px] px-[10px] py-[3px] rounded-[4px] whitespace-nowrap ${getStatusStyle(adj.status)}`}>
                                    {adj.status}
                                </span>
                            </td>
                            <td className="px-[20px] py-[16px] align-top text-center">
                                {isAdmin && adj.status === 'pending' ? (
                                    <div className="flex items-center justify-center gap-[8px]">
                                        <button onClick={() => onApprove(adj.id)} disabled={actionLoading}
                                            className={`h-[32px] px-[12px] text-white rounded-[6px] text-[11px] font-bold uppercase tracking-[0.5px] transition-all shadow-sm active:scale-[0.95] inline-flex items-center gap-[6px] ${
                                                isDelete
                                                    ? 'bg-[#D0021B] hover:bg-[#B00216] shadow-[#D0021B]/20'
                                                    : 'bg-[#2E7D32] hover:bg-[#1B5E20] shadow-[#2E7D32]/20'
                                            }`}>
                                            {isDelete ? <Trash2 size={12} /> : <CheckCircle2 size={12} />}
                                            {isDelete ? 'Delete' : 'Approve'}
                                        </button>
                                        <button onClick={() => onReject(adj.id)} disabled={actionLoading}
                                            className="h-[32px] px-[12px] bg-[#F5F5F5] border border-[#E0E0E0] text-[#757575] rounded-[6px] text-[11px] font-bold uppercase tracking-[0.5px] hover:bg-[#EEEEEE] hover:text-[#212121] transition-all active:scale-[0.95] inline-flex items-center gap-[6px]">
                                            <XCircle size={12} /> Reject
                                        </button>
                                    </div>
                                ) : (!isAdmin && adj.status === 'pending' && adj.submittedById === currentUserId) ? (
                                    <div className="flex items-center justify-center gap-[8px]">
                                        <button onClick={() => onCancel(adj.id)} disabled={actionLoading}
                                            className="h-[32px] px-[12px] bg-white border border-[#E0E0E0] text-[#9E9E9E] rounded-[6px] text-[11px] font-bold uppercase tracking-[0.5px] hover:bg-[#FFEBEE] hover:text-[#C62828] hover:border-[#FFCDD2] transition-all active:scale-[0.95] inline-flex items-center gap-[6px]">
                                            <XCircle size={12} /> Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-[4px]">
                                        <span className="text-[12px] text-[#212121] font-semibold">
                                            {adj.reviewedBy ? `${adj.reviewedBy.firstName} ${adj.reviewedBy.lastName}` : ''}
                                        </span>
                                        {adj.reviewedAt && <span className="text-[11px] text-[#9E9E9E]">{formatTimestamp(adj.reviewedAt)}</span>}

                                    </div>
                                )}
                            </td>
                        </tr>
                    )
                }) : (
                    <tr>
                        <td colSpan={9} className="px-[20px] py-[64px] text-center text-[#9E9E9E] font-bold uppercase text-[12px] tracking-[0.8px]">
                            {statusFilter === 'pending' ? 'All caught up!' : 'No records found'}
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    )
}
