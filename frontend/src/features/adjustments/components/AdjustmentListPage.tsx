'use client'

import React from 'react'
import { Search, Clock, AlertCircle, X, CheckCircle2, Loader2 } from 'lucide-react'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import ToastContainer from '@/components/ui/ToastContainer'
import { useAdjustmentList } from '../hooks/useAdjustmentList'
import { AdjustmentTable } from './AdjustmentTable'

export interface AdjustmentListPageProps {
    role: 'admin' | 'hr'
}

export function AdjustmentListPage({ role }: AdjustmentListPageProps) {
    const {
        searchQuery, setSearchQuery,
        statusFilter, setStatusFilter,
        currentPage, setCurrentPage,
        itemsPerPage, totalCount, totalPages,
        loading, sortedAdjustments,
        sortKeyStr, sortOrder, handleSort,
        dragScrollRef,
        rejectingId, setRejectingId,
        rejectionReason, setRejectionReason,
        approvingId, setApprovingId,
        actionLoading,
        handleApprove, handleReject,
        isAdmin, pendingCount,
        toasts, dismissToast,
    } = useAdjustmentList(role)

    return (
        <div className="space-y-6">
            {/* Sub-panel: no standalone h1 — title is owned by AdjustmentsDashboard */}

            {/* Filters */}
            <div className="flex flex-col md:flex-row items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input placeholder="Search employee or HR..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                    {/* Pending count badge */}
                    {isAdmin && pendingCount !== null && pendingCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-yellow-600" />
                            <span className="text-xs font-bold text-yellow-700">{pendingCount} pending</span>
                        </div>
                    )}
                    {/* Status filter pills */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                        {[
                            { value: 'pending', label: 'Pending' },
                            { value: 'approved', label: 'Approved' },
                            { value: 'rejected', label: 'Rejected' },
                            { value: '', label: 'All' },
                        ].map(s => (
                            <button key={s.value} onClick={() => setStatusFilter(s.value)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${statusFilter === s.value ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table + Pagination */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div
                  ref={dragScrollRef}
                  className="overflow-x-auto scrollbar-table"
                  tabIndex={0}
                  role="region"
                  aria-label="Adjustments table — scroll horizontally"
                >
                    <AdjustmentTable
                        loading={loading}
                        sortedAdjustments={sortedAdjustments}
                        sortKeyStr={sortKeyStr}
                        sortOrder={sortOrder}
                        statusFilter={statusFilter}
                        isAdmin={isAdmin}
                        actionLoading={actionLoading}
                        handleSort={handleSort as (key: string) => void}
                        onApprove={setApprovingId}
                        onReject={(id) => { setRejectingId(id); setRejectionReason('') }}
                    />
                </div>
                <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalCount={totalCount}
                    pageSize={itemsPerPage}
                    entityName="adjustments"
                    loading={loading}
                />
            </div>

            {/* Reject Modal */}
            {rejectingId !== null && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-5 bg-red-600 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg tracking-tight">Reject Adjustment</h3>
                            <button onClick={() => setRejectingId(null)} className="text-white/70 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-600">Please provide a reason for rejecting this adjustment request.</p>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Rejection Reason <span className="text-red-500">*</span></label>
                                <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                                    placeholder="e.g., Insufficient evidence, Incorrect time values..."
                                    className={`w-full p-3 bg-slate-50 border rounded-xl h-24 text-xs outline-none focus:ring-2 focus:ring-red-500/20 resize-none ${!rejectionReason.trim() ? 'border-red-300' : 'border-slate-200'}`} />
                                {!rejectionReason.trim() && (
                                    <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                                        <AlertCircle size={10} /> Rejection reason is required.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="p-5 bg-slate-50 flex gap-3">
                            <button onClick={() => setRejectingId(null)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                            <button onClick={handleReject} disabled={actionLoading || !rejectionReason.trim()}
                                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-black shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                {actionLoading && <Loader2 size={15} className="animate-spin" />}
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Approve Confirmation Modal */}
            {approvingId && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center space-y-4">
                            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Approve Adjustment?</h3>
                                <p className="text-sm text-slate-500 mt-1">The attendance record will be updated with the requested changes.</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setApprovingId(null)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">Cancel</button>
                                <button onClick={() => handleApprove(approvingId)} disabled={actionLoading}
                                    className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200 active:scale-95">
                                    {actionLoading ? 'Approving…' : 'Approve'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
    )
}
