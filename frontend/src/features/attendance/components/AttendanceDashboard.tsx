"use client"

export const dynamic = 'force-dynamic'

import React, { Suspense } from 'react'
import { AlertCircle, Calendar as CalendarIcon, Download } from 'lucide-react'
import ToastContainer from '@/components/ui/ToastContainer'
import { AttendanceStats } from '@/features/attendance/components/AttendanceStats'
import { AttendanceFilters } from '@/features/attendance/components/AttendanceFilters'
import { AttendanceTable } from '@/features/attendance/components/AttendanceTable'
import { AttendanceEditModal } from '@/features/attendance/components/AttendanceEditModal'
import { useAttendanceDashboard } from '@/features/attendance/hooks/useAttendanceDashboard'

export interface AttendanceDashboardProps {
  role: 'admin' | 'hr'
}

function AttendanceContent({ role }: AttendanceDashboardProps) {
  const {
    selectedDate, setSelectedDate,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    branchFilter, setBranchFilter,
    deptFilter, setDeptFilter,
    dateInputRef, dragScrollRef,
    records, loading, error, stats,
    branches, departments, statuses,
    sortedRecords, sortKeyStr, sortOrder, handleSort,
    currentPage, setCurrentPage, totalPages, rowsPerPage,
    editingLog, setEditingLog,
    showCancelModal, setShowCancelModal,
    actionLoading,
    editCheckIn, setEditCheckIn,
    editCheckOut, setEditCheckOut,
    editReason, setEditReason,
    handleEditClick, handleApplyChanges, exportToCSV,
    toasts, dismissToast,
    getTodayDate,
  } = useAttendanceDashboard(role)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Attendance Logs</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">
            {new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" ref={dateInputRef} className="absolute opacity-0 pointer-events-none"
            onChange={e => setSelectedDate(e.target.value)} value={selectedDate} />
          <button onClick={() => dateInputRef.current?.showPicker()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-red-200 transition-all shadow-sm">
            <CalendarIcon className="w-4 h-4 text-red-500" />
            <span>
              {selectedDate === getTodayDate()
                ? 'Today, ' + new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                : new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
            </span>
          </button>
          <button onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95">
            <Download className="w-4 h-4" /> Export Log
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      <AttendanceStats stats={stats} />

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
        dragScrollRef={dragScrollRef}
      />

      <AttendanceEditModal
        editingLog={editingLog}
        setEditingLog={setEditingLog}
        role={role}
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

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default function AttendanceDashboard({ role }: AttendanceDashboardProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-medium">Loading workspace...</div>}>
      <AttendanceContent role={role} />
    </Suspense>
  )
}
