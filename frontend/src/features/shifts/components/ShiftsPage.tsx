'use client'

import { Plus, Search } from 'lucide-react'
import { useTableSort } from '@/hooks/useTableSort'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import ToastContainer from '@/components/ui/ToastContainer'

import { useShifts } from '../hooks/useShifts'
import type { Shift } from '../types'
import { ShiftStatsCards } from './ShiftStatsCards'
import { ShiftDeleteModal } from './ShiftDeleteModal'
import { ShiftFormModal } from './ShiftFormModal'
import { ShiftConflictModal } from './ShiftConflictModal'
import { ShiftTable } from './ShiftTable'

interface ShiftsPageProps {
  role: 'admin' | 'hr' | 'manager'
}

export default function ShiftsPage({ role }: ShiftsPageProps) {
  const s = useShifts()

  const { sortedData, sortKey, sortOrder, handleSort } = useTableSort<Shift>({
    initialData: s.filtered,
  })

  const paginatedShifts = sortedData.slice(
    (s.currentPage - 1) * s.rowsPerPage,
    s.currentPage * s.rowsPerPage
  )

  return (
    <div className="space-y-6 relative">
      <ToastContainer toasts={s.toasts} onDismiss={s.dismissToast} />

      {/* Delete Confirm Modal */}
      <ShiftDeleteModal
        deleteTarget={s.deleteTarget}
        deleteLoading={s.deleteLoading}
        onCancel={() => s.setDeleteTarget(null)}
        onDelete={s.handleDelete}
      />

      {/* Shift Form Modal */}
      <ShiftFormModal
        isFormOpen={s.isFormOpen}
        editingShift={s.editingShift}
        form={s.form}
        setForm={s.setForm}
        formLoading={s.formLoading}
        formError={s.formError}
        hasInvalidBreaks={s.hasInvalidBreaks}
        shiftTimingError={s.shiftTimingError}
        onClose={() => s.setIsFormOpen(false)}
        onSubmit={s.handleSubmit}
      />

      {/* Shift Conflict Modal */}
      <ShiftConflictModal
        isOpen={s.showConflictModal}
        report={s.conflictReport}
        onClose={() => s.setShowConflictModal(false)}
      />

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Shift Management</h1>
          <p className="text-slate-500 text-sm font-medium">Define and manage employee work shift schedules.</p>
        </div>
        {role !== 'manager' && (
          <button
            onClick={s.openCreate}
            className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2 self-start lg:self-center"
          >
            <Plus size={18} />
            New Shift
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <ShiftStatsCards shifts={s.shifts} />

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-center bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text" placeholder="Search shifts..."
            value={s.searchTerm} onChange={e => s.setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none w-full focus:ring-2 focus:ring-red-500/10 focus:border-red-200 transition-all"
          />
        </div>
      </div>

      {/* Shifts Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <ShiftTable
          paginatedShifts={paginatedShifts}
          loading={s.loading}
          sortKey={sortKey as string | null}
          sortOrder={sortOrder}
          handleSort={handleSort}
          onEdit={s.openEdit}
          onDelete={s.setDeleteTarget}
          isReadOnly={role === 'manager'}
        />
      </div>

      <DataTablePagination
        currentPage={s.currentPage}
        totalPages={Math.ceil(s.filtered.length / s.rowsPerPage)}
        onPageChange={s.setCurrentPage}
        totalCount={s.filtered.length}
        pageSize={s.rowsPerPage}
        entityName="shifts"
        loading={s.loading}
      />
    </div>
  )
}
