import React from 'react'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import { AttendanceMobileCards } from './AttendanceMobileCards'
import { AttendanceDesktopTable } from './AttendanceDesktopTable'
import { ShiftTabs } from './ShiftTabs'
import { AttendanceRecord } from '../types'

interface AttendanceTableProps {
  loading: boolean
  records: AttendanceRecord[]
  sortedRecords: AttendanceRecord[]
  sortKeyStr: string | null
  sortOrder: 'asc' | 'desc' | null
  handleSort: (key: keyof AttendanceRecord) => void
  currentPage: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
  totalPages: number
  rowsPerPage: number;
  handleEditClick?: (row: AttendanceRecord) => void;
  handleDeleteClick?: (row: AttendanceRecord) => void;
  showStatsHeader?: boolean;
  stats?: {
    onTime: number;
    late: number;
    absent: number;
    restDay?: number;
    total: number;
  };
  shiftFilter?: string | null;
  setShiftFilter?: (val: string) => void;
  shifts?: string[];
  dragScrollRef?: React.RefObject<HTMLDivElement | null>
  onShiftClick?: (shiftCode: string, row: AttendanceRecord) => void;
}

export function AttendanceTable({
  loading,
  records,
  sortedRecords,
  sortKeyStr,
  sortOrder,
  handleSort,
  currentPage,
  setCurrentPage,
  totalPages,
  rowsPerPage,
  handleEditClick,
  handleDeleteClick,
  showStatsHeader,
  stats,
  shiftFilter,
  setShiftFilter,
  shifts,
  dragScrollRef,
  onShiftClick,
}: AttendanceTableProps) {
  // Disable actions if viewing "All Shifts" to force specific shift selection
  const canEdit = shiftFilter !== 'All Shifts';
  const effectiveEditClick = canEdit ? handleEditClick : undefined;
  const effectiveDeleteClick = canEdit ? handleDeleteClick : undefined;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-md overflow-hidden rounded-tl-none">
      {shifts && shifts.length > 0 && setShiftFilter && (
        <ShiftTabs 
          activeShift={shiftFilter || 'All Shifts'} 
          onShiftChange={setShiftFilter} 
          shifts={shifts} 
        />
      )}
      {showStatsHeader && stats && (
        <div className="px-6 py-4 border-b border-border bg-secondary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Attendance Logs</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">On Time</p>
              <p className="text-xl font-black text-emerald-500">{stats.onTime}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Late</p>
              <p className="text-xl font-black text-yellow-500">{stats.late}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Absent</p>
              <p className="text-xl font-black text-red-500">{stats.absent}</p>
            </div>
            {stats.restDay !== undefined && stats.restDay > 0 && (
              <>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rest Day</p>
                  <p className="text-xl font-black text-slate-400">{stats.restDay}</p>
                </div>
              </>
            )}
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
              <p className="text-xl font-black text-foreground">{stats.total}</p>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Card View */}
      <div className="lg:hidden">
        <AttendanceMobileCards
          loading={loading}
          records={records}
          sortedRecords={sortedRecords}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          handleEditClick={effectiveEditClick}
          handleDeleteClick={effectiveDeleteClick}
          onShiftClick={onShiftClick}
        />
      </div>

      {/* Desktop Table View */}
      <div
        ref={dragScrollRef}
        className="overflow-x-auto scrollbar-table cursor-grab active:cursor-grabbing hidden lg:block"
        tabIndex={0}
        role="region"
        aria-label="Attendance records table — scroll horizontally"
      >
        <AttendanceDesktopTable
          loading={loading}
          sortedRecords={sortedRecords}
          sortKeyStr={sortKeyStr}
          sortOrder={sortOrder}
          handleSort={handleSort}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          handleEditClick={effectiveEditClick}
          handleDeleteClick={effectiveDeleteClick}
          onShiftClick={onShiftClick}
        />
      </div>

      {/* Pagination */}
      <DataTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalCount={records.length}
        pageSize={rowsPerPage}
        entityName="attendance records"
        loading={loading}
      />
    </div>
  )
}
