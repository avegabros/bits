'use client'

import React from 'react'
import { Loader2, CheckCircle2, XCircle, Clock, Trash2, Calendar, User, ArrowRight } from 'lucide-react'
import { Adjustment } from '@/features/adjustments/types'
import { formatTime, formatTimestamp, formatDate, empName } from '../hooks/useAdjustmentList'

export interface AdjustmentMobileCardsProps {
    loading: boolean
    sortedAdjustments: Adjustment[]
    role: 'admin' | 'hr' | 'manager'
    isAdmin: boolean
    currentUserId: number | null
    actionLoading: boolean
    onApprove: (id: number) => void
    onReject: (id: number) => void
    onCancel: (id: number) => void
    onReopen?: (id: number) => void
}

export function AdjustmentMobileCards({
    loading,
    sortedAdjustments,
    role,
    isAdmin,
    currentUserId,
    actionLoading,
    onApprove,
    onReject,
    onCancel,
    onReopen,
}: AdjustmentMobileCardsProps) {
    if (loading) {
        return (
            <div className="px-[20px] py-[64px] text-center flex flex-col items-center gap-[12px]">
                <Loader2 size={24} className="animate-spin text-[#D0021B]" />
                <span className="text-[12px] font-bold text-[#9E9E9E] uppercase tracking-widest italic">Loading adjustments...</span>
            </div>
        )
    }

    if (sortedAdjustments.length === 0) {
        return (
            <div className="px-[20px] py-[48px] text-center text-[#9E9E9E] font-bold uppercase text-[12px] tracking-[0.8px]">
                All caught up!
            </div>
        )
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]';
            case 'rejected': return 'bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]';
            case 'cancelled': return 'bg-gray-50 text-gray-500 border-gray-200';
            default: return 'bg-[#FFF8E1] text-[#F57F17] border-[#FFE082]';
        }
    }

    return (
        <div className="divide-y divide-[#E0E0E0]">
            {sortedAdjustments.map((adj) => {
                const isDelete = adj.type === 'DELETE'
                const subDateObj = new Date(adj.submittedAt);
                const subDateStr = subDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const subTimeStr = subDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                return (
                    <div key={adj.id} className="p-[16px] space-y-[12px] bg-white hover:bg-[#F5F5F5] transition-colors">
                        {/* Header Row: Type & Status */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-[6px]">
                                {isDelete ? (
                                    <span className="inline-flex items-center gap-[4px] px-[8px] py-[3px] rounded-[4px] bg-[#FFEBEE] text-[#C62828] font-bold text-[10px] uppercase tracking-[0.5px] border border-[#FFCDD2]">
                                        <Trash2 size={10} />
                                        Delete
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-[4px] px-[8px] py-[3px] rounded-[4px] bg-[#E3F2FD] text-[#1565C0] font-bold text-[10px] uppercase tracking-[0.5px] border border-[#BBDEFB]">
                                        Edit
                                    </span>
                                )}
                            </div>
                            <span className={`inline-flex items-center gap-[4px] font-bold text-[10px] uppercase tracking-[0.5px] px-[8px] py-[2.5px] rounded-[4px] border ${getStatusStyle(adj.status)}`}>
                                {adj.status}
                            </span>
                        </div>

                        {/* Employee Details */}
                        <div className="space-y-[4px]">
                            <h4 className="font-bold text-[#212121] text-[15px] leading-tight">
                                {empName(adj.attendance?.employee)}
                            </h4>
                            <div className="flex items-center gap-[6px] text-[11px] text-[#757575]">
                                <span>{adj.attendance?.employee?.Branch?.name}</span>
                                <span>•</span>
                                <span className="font-semibold text-[#212121] bg-[#F5F5F5] border border-[#E0E0E0] px-[6px] py-[1.5px] rounded-[4px]">
                                    {formatDate(adj.attendance?.date)}
                                </span>
                            </div>
                        </div>

                        {/* Times grid */}
                        <div className="grid grid-cols-1 gap-[8px] bg-[#FAFAFA] border border-[#E0E0E0] p-[10px] rounded-[8px]">
                            <div className="text-[11px] text-[#757575] flex justify-between items-center">
                                <span className="font-medium">Original Time:</span>
                                <span className="font-bold text-[#212121]">
                                    In: {formatTime(adj.originalCheckIn)} • Out: {formatTime(adj.originalCheckOut)}
                                </span>
                            </div>
                            {!isDelete && (
                                <div className="text-[11px] text-[#1565C0] flex justify-between items-center pt-[6px] border-t border-[#E0E0E0]/60">
                                    <span className="font-medium">Requested Time:</span>
                                    <span className="font-bold">
                                        In: {formatTime(adj.requestedCheckIn)} • Out: {formatTime(adj.requestedCheckOut)}
                                    </span>
                                </div>
                            )}
                            {isDelete && (
                                <div className="text-[11px] text-[#C62828] font-bold flex justify-between items-center pt-[6px] border-t border-[#E0E0E0]/60">
                                    <span>Requested Change:</span>
                                    <span className="uppercase tracking-[0.5px]">Record Deletion</span>
                                </div>
                            )}
                        </div>

                        {/* Reason / Metadata */}
                        <div className="space-y-[6px]">
                            <div className="text-[12px] text-[#757575] leading-relaxed">
                                <span className="font-semibold text-[#424242]">Reason:</span> {adj.reason}
                            </div>
                            
                            {adj.rejectionReason && (
                                <div className="p-[10px] bg-[#FFEBEE] rounded-[6px] border border-[#FFCDD2] flex items-start gap-[6px]">
                                    <XCircle size={14} className="text-[#C62828] mt-[1.5px] shrink-0" />
                                    <div className="text-[11px] text-[#C62828] leading-tight">
                                        <span className="font-bold">Rejection Reason:</span> {adj.rejectionReason}
                                    </div>
                                </div>
                            )}

                            <div className="pt-[4px] flex flex-wrap gap-x-[12px] gap-y-[4px] text-[10px] text-[#9E9E9E] border-t border-[#F0F0F0]">
                                <div>Submitted by: <span className="font-medium text-[#616161]">{adj.submittedBy ? `${adj.submittedBy.firstName} ${adj.submittedBy.lastName}` : '—'}</span></div>
                                <div>on {subDateStr} at {subTimeStr}</div>
                            </div>
                        </div>

                        {/* Actions Row */}
                        <div className="pt-[4px]">
                            {isAdmin && adj.status === 'pending' ? (
                                <div className="flex gap-[8px]">
                                    <button onClick={() => onApprove(adj.id)} disabled={actionLoading}
                                        className={`flex-1 h-[36px] text-white rounded-[6px] text-[12px] font-bold uppercase tracking-[0.5px] transition-all shadow-sm active:scale-[0.95] flex items-center justify-center gap-[6px] ${
                                            isDelete
                                                ? 'bg-[#D0021B] hover:bg-[#B00216] shadow-[#D0021B]/10'
                                                : 'bg-[#2E7D32] hover:bg-[#1B5E20] shadow-[#2E7D32]/10'
                                        }`}>
                                        {isDelete ? <Trash2 size={13} /> : <CheckCircle2 size={13} />}
                                        {isDelete ? 'Delete' : 'Approve'}
                                    </button>
                                    <button onClick={() => onReject(adj.id)} disabled={actionLoading}
                                        className="flex-1 h-[36px] bg-[#F5F5F5] border border-[#E0E0E0] text-[#757575] rounded-[6px] text-[12px] font-bold uppercase tracking-[0.5px] hover:bg-[#EEEEEE] hover:text-[#212121] transition-all active:scale-[0.95] flex items-center justify-center gap-[6px]">
                                        <XCircle size={13} /> Reject
                                    </button>
                                </div>
                            ) : (!isAdmin && adj.status === 'pending' && adj.submittedById === currentUserId) ? (
                                <button onClick={() => onCancel(adj.id)} disabled={actionLoading}
                                    className="w-full h-[36px] bg-white border border-[#E0E0E0] text-[#9E9E9E] rounded-[6px] text-[12px] font-bold uppercase tracking-[0.5px] hover:bg-[#FFEBEE] hover:text-[#C62828] hover:border-[#FFCDD2] transition-all active:scale-[0.95] flex items-center justify-center gap-[6px]">
                                    <XCircle size={13} /> Cancel Request
                                </button>
                            ) : (
                                <div className="flex flex-col gap-[4px] text-[11px] text-[#757575] bg-[#FAFAFA] px-[10px] py-[8px] rounded-[6px] border border-[#E0E0E0]/60">
                                    <div className="flex justify-between">
                                        <span>Reviewed by:</span>
                                        <span className="font-semibold text-[#212121]">
                                            {adj.reviewedBy ? `${adj.reviewedBy.firstName} ${adj.reviewedBy.lastName}` : 'System'}
                                        </span>
                                    </div>
                                    {adj.reviewedAt && (
                                        <div className="flex justify-between text-[10px] text-[#9E9E9E]">
                                            <span>Reviewed on:</span>
                                            <span>{formatTimestamp(adj.reviewedAt)}</span>
                                        </div>
                                    )}
                                    {role === 'admin' && adj.status !== 'pending' && onReopen && (
                                        <button onClick={() => onReopen(adj.id)} disabled={actionLoading}
                                            className="mt-[6px] w-full h-[28px] bg-white border border-[#E0E0E0] text-[#1565C0] rounded-[4px] text-[11px] font-bold uppercase tracking-[0.5px] hover:bg-[#E3F2FD] hover:border-[#BBDEFB] transition-all active:scale-[0.95]">
                                            Reopen Request
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
