'use client'

import React from 'react'
import { Search, Clock, AlertCircle, X, CheckCircle2, Loader2, Trash2, ChevronDown, Filter } from 'lucide-react'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import ToastContainer from '@/components/ui/ToastContainer'
import { useAdjustmentList } from '../hooks/useAdjustmentList'
import { AdjustmentTable } from './AdjustmentTable'
import { AdjustmentMobileCards } from './AdjustmentMobileCards'

export interface AdjustmentListPageProps {
    role: 'admin' | 'hr' | 'manager'
}

export function AdjustmentListPage({ role }: AdjustmentListPageProps) {
    const [openDropdown, setOpenDropdown] = React.useState<string | null>(null)
    const {
        searchQuery, setSearchQuery,
        statusFilter, setStatusFilter,
        branchFilter, setBranchFilter,
        branches,
        currentPage, setCurrentPage,
        itemsPerPage, totalCount, totalPages,
        loading, sortedAdjustments,
        sortKeyStr, sortOrder, handleSort,
        dragScrollRef,
        rejectingId, setRejectingId,
        rejectionReason, setRejectionReason,
        approvingId, setApprovingId,
        cancellingId, setCancellingId,
        reopeningId, setReopeningId,
        actionLoading,
        handleApprove, handleReject, handleCancel, handleReopen,
        role: hookRole, isAdmin, pendingCount, currentUserId,
        toasts, dismissToast,
    } = useAdjustmentList(role)

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
                <div className="absolute top-full left-0 right-0 mt-[4px] py-[4px] bg-white border border-[#E0E0E0] rounded-[6px] shadow-lg z-[50] max-h-[240px] overflow-y-auto">
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

    return (
        <div className="space-y-[16px] relative pb-[24px]" onClick={() => setOpenDropdown(null)}>
            {/* Sub-panel: no standalone h1 — title is owned by AdjustmentsDashboard */}

            {/* Filter Row */}
            <div className="flex flex-col md:flex-row items-center gap-[8px]" onClick={(e) => e.stopPropagation()}>
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-[#9E9E9E] group-focus-within:text-[#D0021B] transition-colors" />
                    <input 
                        placeholder="Search employee or HR..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full h-[40px] pl-[36px] pr-[36px] bg-white border border-[#E0E0E0] rounded-[6px] text-[14px] text-[#212121] placeholder-[#9E9E9E] outline-none focus:border-[#D0021B] focus:ring-4 focus:ring-[#D0021B]/5 transition-all" />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[#9E9E9E] hover:text-[#212121]">
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-[8px] w-full md:w-auto">
                    <CustomSelect 
                        id="status" 
                        value={statusFilter === '' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} 
                        options={['All Status', 'Pending', 'Approved', 'Rejected', 'Cancelled']} 
                        onChange={(val) => setStatusFilter(val === 'All Status' ? '' : val.toLowerCase())} 
                        placeholder="Status"
                    />
                    <CustomSelect 
                        id="branch" 
                        value={branchFilter} 
                        options={branches} 
                        onChange={setBranchFilter} 
                        placeholder="All Branches" 
                    />
                    
                    {isAdmin && pendingCount !== null && pendingCount > 0 && (
                        <div className="flex items-center gap-[6px] px-[12px] h-[40px] bg-[#FFF8E1] border border-[#FFE082] rounded-[6px] shrink-0">
                            <Clock className="w-[14px] h-[14px] text-[#F57F17]" />
                            <span className="text-[12px] font-bold text-[#F57F17]">{pendingCount} pending</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Adjustment Table Card */}
            <div className="bg-white border border-[#E0E0E0] rounded-[12px] shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
                {/* Mobile View */}
                <div className="md:hidden">
                    <AdjustmentMobileCards
                        loading={loading}
                        sortedAdjustments={sortedAdjustments}
                        role={hookRole}
                        isAdmin={isAdmin}
                        currentUserId={currentUserId}
                        actionLoading={actionLoading}
                        onApprove={setApprovingId}
                        onReject={(id) => { setRejectingId(id); setRejectionReason('') }}
                        onCancel={setCancellingId}
                        onReopen={setReopeningId}
                    />
                </div>

                {/* Desktop View */}
                <div
                  ref={dragScrollRef}
                  className="hidden md:block overflow-x-auto scrollbar-table"
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
                        role={hookRole}
                        isAdmin={isAdmin}
                        currentUserId={currentUserId}
                        actionLoading={actionLoading}
                        handleSort={handleSort as (key: string) => void}
                        onApprove={setApprovingId}
                        onReject={(id) => { setRejectingId(id); setRejectionReason('') }}
                        onCancel={setCancellingId}
                        onReopen={setReopeningId}
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
                <div className="fixed inset-0 bg-[#212121]/40 backdrop-blur-[4px] z-[100] flex items-center justify-center p-[20px] animate-in fade-in duration-200">
                    <div className="bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] w-full max-w-[400px] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-[24px] py-[20px] bg-[#D0021B] text-white flex justify-between items-center">
                            <h3 className="font-bold text-[18px] tracking-tight">Reject Adjustment</h3>
                            <button onClick={() => setRejectingId(null)} className="text-white/80 hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-[24px] space-y-[20px]">
                            <p className="text-[14px] text-[#757575] leading-relaxed">Please provide a reason for rejecting this adjustment request.</p>
                            <div className="space-y-[8px]">
                                <label className="text-[11px] font-bold uppercase text-[#9E9E9E] tracking-[0.5px]">Rejection Reason <span className="text-[#D0021B]">*</span></label>
                                <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                                    placeholder="e.g., Insufficient evidence, Incorrect time values..."
                                    className={`w-full p-[12px] bg-[#F5F5F5] border rounded-[8px] h-[100px] text-[13px] text-[#212121] outline-none focus:border-[#D0021B] focus:ring-4 focus:ring-[#D0021B]/5 transition-all resize-none ${!rejectionReason.trim() ? 'border-[#D0021B]/30' : 'border-[#E0E0E0]'}`} />
                                {!rejectionReason.trim() && (
                                    <p className="text-[11px] text-[#D0021B] font-medium flex items-center gap-[6px]">
                                        <AlertCircle size={12} /> Rejection reason is required.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="px-[24px] py-[16px] bg-[#FAFAFA] flex gap-[12px]">
                            <button onClick={() => setRejectingId(null)} className="flex-1 h-[44px] text-[14px] font-bold text-[#757575] hover:text-[#212121] transition-colors">Cancel</button>
                            <button onClick={handleReject} disabled={actionLoading || !rejectionReason.trim()}
                                className="flex-1 h-[44px] bg-[#D0021B] text-white rounded-[8px] text-[14px] font-bold shadow-lg shadow-[#D0021B]/20 hover:bg-[#B00216] transition-all active:scale-[0.98] flex items-center justify-center gap-[8px] disabled:opacity-50 disabled:cursor-not-allowed">
                                {actionLoading && <Loader2 size={16} className="animate-spin" />}
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Approve Confirmation Modal — adapts for DELETE vs EDIT */}
            {approvingId && (() => {
                const approvingAdj = sortedAdjustments.find(a => a.id === approvingId)
                const isDeleteApproval = approvingAdj?.type === 'DELETE'

                return (
                    <div className="fixed inset-0 bg-[#212121]/40 backdrop-blur-[4px] z-[150] flex items-center justify-center p-[20px] animate-in fade-in duration-200">
                        <div className="bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] w-full max-w-[360px] overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-[32px] text-center space-y-[24px]">
                                {isDeleteApproval ? (
                                    /* ── DELETE variant: red / destructive ── */
                                    <>
                                        <div className="w-[64px] h-[64px] rounded-full bg-[#FFEBEE] flex items-center justify-center mx-auto">
                                            <Trash2 className="w-[32px] h-[32px] text-[#C62828]" />
                                        </div>
                                        <div className="space-y-[8px]">
                                            <h3 className="text-[20px] font-bold text-[#212121] tracking-tight">Approve Deletion?</h3>
                                            <p className="text-[14px] text-[#C62828] font-semibold">This will permanently delete the record.</p>
                                            <p className="text-[12px] text-[#9E9E9E]">This action cannot be undone.</p>
                                        </div>
                                    </>
                                ) : (
                                    /* ── EDIT variant: green / standard ── */
                                    <>
                                        <div className="w-[64px] h-[64px] rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto">
                                            <CheckCircle2 className="w-[32px] h-[32px] text-[#2E7D32]" />
                                        </div>
                                        <div className="space-y-[8px]">
                                            <h3 className="text-[20px] font-bold text-[#212121] tracking-tight">Approve Adjustment?</h3>
                                            <p className="text-[14px] text-[#757575]">The attendance record will be updated with the requested changes.</p>
                                        </div>
                                    </>
                                )}
                                <div className="flex gap-[12px] pt-[8px]">
                                    <button onClick={() => setApprovingId(null)} className="flex-1 h-[44px] border border-[#E0E0E0] text-[#757575] rounded-[8px] text-[14px] font-bold hover:bg-[#F5F5F5] transition-all">Cancel</button>
                                    <button onClick={() => handleApprove(approvingId)} disabled={actionLoading}
                                        className={`flex-1 h-[44px] text-white rounded-[8px] text-[14px] font-bold disabled:opacity-50 transition-all active:scale-[0.98] ${
                                            isDeleteApproval
                                                ? 'bg-[#D0021B] hover:bg-[#B00216] shadow-lg shadow-[#D0021B]/20'
                                                : 'bg-[#2E7D32] hover:bg-[#1B5E20] shadow-lg shadow-[#2E7D32]/20'
                                        }`}>
                                        {actionLoading ? 'Processing…' : isDeleteApproval ? 'Confirm' : 'Approve'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* Cancel Confirmation Modal */}
            {cancellingId !== null && (
                <div className="fixed inset-0 bg-[#212121]/40 backdrop-blur-[4px] z-[150] flex items-center justify-center p-[20px] animate-in fade-in duration-200">
                    <div className="bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] w-full max-w-[360px] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-[32px] text-center space-y-[24px]">
                            <div className="w-[64px] h-[64px] rounded-full bg-[#FFF8E1] flex items-center justify-center mx-auto">
                                <AlertCircle className="w-[32px] h-[32px] text-[#F57F17]" />
                            </div>
                            <div className="space-y-[8px]">
                                <h3 className="text-[20px] font-bold text-[#212121] tracking-tight">Cancel Request?</h3>
                                <p className="text-[14px] text-[#757575]">This will withdraw your pending adjustment request.</p>
                            </div>
                            <div className="flex gap-[12px] pt-[8px]">
                                <button onClick={() => setCancellingId(null)} className="flex-1 h-[44px] border border-[#E0E0E0] text-[#757575] rounded-[8px] text-[14px] font-bold hover:bg-[#F5F5F5] transition-all">Keep</button>
                                <button onClick={handleCancel} disabled={actionLoading}
                                    className="flex-1 h-[44px] text-white rounded-[8px] text-[14px] font-bold disabled:opacity-50 transition-all active:scale-[0.98] bg-[#F57F17] hover:bg-[#F9A825] shadow-lg shadow-[#F57F17]/20 flex items-center justify-center gap-[8px]">
                                    {actionLoading && <Loader2 size={16} className="animate-spin" />}
                                    Confirm Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reopen Confirmation Modal */}
            {reopeningId !== null && (
                <div className="fixed inset-0 bg-[#212121]/40 backdrop-blur-[4px] z-[150] flex items-center justify-center p-[20px] animate-in fade-in duration-200">
                    <div className="bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] w-full max-w-[360px] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-[32px] text-center space-y-[24px]">
                            <div className="w-[64px] h-[64px] rounded-full bg-[#E3F2FD] flex items-center justify-center mx-auto">
                                <AlertCircle className="w-[32px] h-[32px] text-[#1565C0]" />
                            </div>
                            <div className="space-y-[8px]">
                                <h3 className="text-[20px] font-bold text-[#212121] tracking-tight">Reopen Request?</h3>
                                <p className="text-[14px] text-[#757575]">This will move the adjustment back to pending for re-review.</p>
                            </div>
                            <div className="flex gap-[12px] pt-[8px]">
                                <button onClick={() => setReopeningId(null)} className="flex-1 h-[44px] border border-[#E0E0E0] text-[#757575] rounded-[8px] text-[14px] font-bold hover:bg-[#F5F5F5] transition-all">Cancel</button>
                                <button onClick={() => handleReopen(reopeningId)} disabled={actionLoading}
                                    className="flex-1 h-[44px] text-white rounded-[8px] text-[14px] font-bold disabled:opacity-50 transition-all active:scale-[0.98] bg-[#1565C0] hover:bg-[#0D47A1] shadow-lg shadow-[#1565C0]/20 flex items-center justify-center gap-[8px]">
                                    {actionLoading && <Loader2 size={16} className="animate-spin" />}
                                    Reopen
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
