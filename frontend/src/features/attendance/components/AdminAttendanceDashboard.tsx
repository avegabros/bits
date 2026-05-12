'use client';

import React, { Suspense } from 'react';
import { Fingerprint, Calendar as CalendarIcon, Download, AlertCircle } from 'lucide-react';
import { useAttendanceDashboard } from '@/features/attendance/hooks/useAttendanceDashboard';
import { AttendanceStats } from './AttendanceStats';
import { AttendanceFilters } from './AttendanceFilters';
import { AttendanceTable } from './AttendanceTable';
import { AttendanceEditModal } from './AttendanceEditModal';
import { CompanyTabs } from './CompanyTabs';
import ToastContainer from '@/components/ui/ToastContainer';

function AdminAttendanceContent() {
  const {
    selectedDate, setSelectedDate,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    branchFilter, setBranchFilter,
    deptFilter, setDeptFilter,
    companyFilter, setCompanyFilter,
    dateInputRef,
    records, loading, error, stats,
    branches, companies, departments, statuses,
    sortedRecords, sortKeyStr, sortOrder, handleSort,
    currentPage, setCurrentPage, totalPages, rowsPerPage,
    editingLog, setEditingLog,
    showCancelModal, setShowCancelModal,
    actionLoading,
    editCheckIn, setEditCheckIn,
    editCheckOut, setEditCheckOut,
    editReason, setEditReason,
    deletingLog, setDeletingLog,
    deleteReason, setDeleteReason,
    handleEditClick, handleApplyChanges, handleDeleteClick, handleDeleteSubmit, exportToCSV,
    toasts, dismissToast,
    getTodayDate,
  } = useAttendanceDashboard('admin');

  return (
    <div className="space-y-5">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Biometric Attendance</h2>
            <p className="text-muted-foreground text-sm font-medium">
              {new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            ref={dateInputRef}
            className="absolute opacity-0 pointer-events-none"
            onChange={(e) => setSelectedDate(e.target.value)}
            value={selectedDate}
          />
          <button
            onClick={() => {
              if (dateInputRef.current && 'showPicker' in dateInputRef.current) {
                dateInputRef.current.showPicker()
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm font-bold text-foreground hover:bg-secondary/80 transition-all shadow-sm"
          >
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span>
              {selectedDate === getTodayDate()
                ? `Today, ${new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
                : new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
            </span>
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {selectedDate > getTodayDate() && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium px-4 py-3 rounded-xl">
          <span>🗓️</span>
          <span>You are viewing a future date — attendance has not been recorded yet.</span>
        </div>
      )}

      {/* Stats Grid */}
      <AttendanceStats stats={stats} variant="admin" />

      {/* Company Tabs + Filters + Table (tighter spacing) */}
      <div className="space-y-2">
        <CompanyTabs
          activeCompany={companyFilter}
          onCompanyChange={setCompanyFilter}
          companies={companies}
        />

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <AttendanceFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            branchFilter={branchFilter}
            setBranchFilter={setBranchFilter}
            deptFilter={deptFilter}
            setDeptFilter={setDeptFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            branches={branches}
            departments={departments}
            statuses={statuses}
          />
        </div>

        {/* Table Card (with integrated stats header) */}
        <div className="rounded-2xl shadow-md overflow-hidden bg-white border border-border rounded-tl-1">
          <AttendanceTable
            loading={loading}
            records={records}
            sortedRecords={sortedRecords}
            sortKeyStr={sortKeyStr}
            sortOrder={sortOrder}
            handleSort={handleSort}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            rowsPerPage={rowsPerPage}
            handleEditClick={handleEditClick}
            handleDeleteClick={handleDeleteClick}
            showStatsHeader={true}
            stats={{
              onTime: stats.onTime,
              late: stats.late,
              absent: stats.absent,
              total: stats.total,
            }}
          />
        </div>
      </div>

      <AttendanceEditModal
        editingLog={editingLog}
        setEditingLog={setEditingLog}
        role="admin"
        editCheckIn={editCheckIn}
        setEditCheckIn={setEditCheckIn}
        editCheckOut={editCheckOut}
        setEditCheckOut={setEditCheckOut}
        editReason={editReason}
        setEditReason={setEditReason}
        showCancelModal={showCancelModal}
        setShowCancelModal={setShowCancelModal}
        handleApplyChanges={handleApplyChanges}
        actionLoading={actionLoading}
      />

      {deletingLog && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="p-5 bg-red-600 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg leading-tight tracking-tight flex items-center gap-2">
                <AlertCircle size={20} />
                Delete Record
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm font-medium text-slate-700">
                Are you sure you want to delete the attendance record for <span className="font-bold">{deletingLog.employeeName}</span> on {deletingLog.date}?
              </p>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">Reason for Deletion <span className="text-red-500">*</span></label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Reason is required..."
                  className={`w-full p-3 bg-slate-50 border rounded-xl h-20 text-xs outline-none focus:ring-2 focus:ring-red-500/20 resize-none ${!deleteReason.trim() ? 'border-red-300' : 'border-slate-200'}`}
                />
              </div>
            </div>
            <div className="p-5 bg-slate-50 flex gap-3 shrink-0">
              <button
                onClick={() => setDeletingLog(null)}
                className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={actionLoading || !deleteReason.trim()}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-black shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

import TableLoading from '@/components/ui/TableLoading';

export default function AdminAttendanceDashboard() {
  return (
    <Suspense fallback={<TableLoading />}>
      <AdminAttendanceContent />
    </Suspense>
  );
}
