'use client';

import React, { Suspense } from 'react';
import { Fingerprint, Calendar as CalendarIcon, Download, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { useAttendanceDashboard } from '@/features/attendance/hooks/useAttendanceDashboard';
import { AttendanceStats } from './AttendanceStats';
import { AttendanceFilters } from './AttendanceFilters';
import { AttendanceTable } from './AttendanceTable';
import { AttendanceEditModal } from './AttendanceEditModal';
import { CompanyTabs } from './CompanyTabs';
import ToastContainer from '@/components/ui/ToastContainer';

function ManagerAttendanceContent() {
  const {
    selectedDate, setSelectedDate,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    branchFilter, setBranchFilter,
    deptFilter, setDeptFilter,
    companyFilter, setCompanyFilter,
    shiftFilter, setShiftFilter,
    dateInputRef,
    records, loading, error, stats,
    branches, companies, departments, statuses, shifts,
    sortedRecords, sortKeyStr, sortOrder, handleSort,
    currentPage, setCurrentPage, totalPages, rowsPerPage,
    exportToCSV,
    toasts, dismissToast,
    getTodayDate,
  } = useAttendanceDashboard('manager');

  const handleShiftQuickNav = (shiftName: string, _row: any) => {
    setShiftFilter(shiftName);
  };

  return (
    <div className="space-y-5">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Department Attendance</h2>
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
          <Link
            href="/manager/overtime?tab=pending"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Clock className="w-4 h-4" /> Manage OT
          </Link>
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

      {/* Company Tabs + Filters + Table */}
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
            shiftFilter={shiftFilter}
            setShiftFilter={setShiftFilter}
            shifts={shifts}
          />
        </div>

        {/* Table Card */}
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
            showStatsHeader={true}
            stats={{
              onTime: stats.onTime,
              late: stats.late,
              absent: stats.absent,
              total: stats.total,
            }}
            shiftFilter={shiftFilter}
            setShiftFilter={setShiftFilter}
            shifts={shifts}
            onShiftClick={handleShiftQuickNav}
          />
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function ManagerAttendanceDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-medium">Loading attendance workspace...</div>}>
      <ManagerAttendanceContent />
    </Suspense>
  );
}
