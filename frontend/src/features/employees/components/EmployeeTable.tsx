'use client'

import React from 'react'
import Link from 'next/link'
import { Edit2, Fingerprint, CreditCard, Key, RotateCcw, UserX, Eye } from 'lucide-react'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import { SortableHeader } from '@/components/ui/SortableHeader'
import { Avatar } from '@/components/ui/avatar'
import { Employee, formatFullName, formatTime } from '../utils/employee-types'

interface EmployeeTableProps {
  employees: Employee[]
  loading: boolean
  filteredCount: number
  currentPage: number
  totalPages: number
  sortKey: string | null
  sortOrder: 'asc' | 'desc' | null
  onSort: (key: keyof Employee) => void
  onPageChange: (page: number) => void
  onEdit: (employee: Employee) => void
  onResetPassword: (employee: Employee) => void
  onFingerprintOpen: (employeeId: number, name: string) => void
  onCardEnrollOpen: (employeeId: number, name: string, currentCard: number | null) => void
  enrollStatus: Record<number, 'idle' | 'loading' | 'success' | 'error'>
  dragScrollRef: React.RefObject<HTMLDivElement | null>
  pageSize?: number
  role?: 'admin' | 'hr'
  // Inactive-only actions
  onRestore?: (employee: Employee) => void
  onPermanentDelete?: (employee: Employee) => void
}

export function EmployeeTable({
  employees, loading, filteredCount, currentPage, totalPages,
  sortKey, sortOrder, onSort, onPageChange,
  onEdit, onResetPassword, onFingerprintOpen, onCardEnrollOpen,
  enrollStatus, dragScrollRef,
  onRestore, onPermanentDelete,
  pageSize = 10,
  role = 'admin',
}: EmployeeTableProps) {
  const isInactiveMode = !!(onRestore || onPermanentDelete)
  const basePath = role === 'hr' ? '/hr/employees' : '/employees'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div
        ref={dragScrollRef}
        className="overflow-x-auto scrollbar-table"
        tabIndex={0}
        role="region"
        aria-label="Employees table — scroll horizontally"
      >
        <table className="w-full text-left text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr>
              <SortableHeader label="ZK ID" sortKey="zkId" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={onSort} className="px-4 py-4 w-20" />
              <th className="px-4 py-4 w-14"><span className="sr-only">Avatar</span></th>
              <SortableHeader label="Employee" sortKey="firstName" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={onSort} className="px-6 py-4" />
              <SortableHeader label="Employee ID" sortKey="employeeNumber" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={onSort} className="px-4 py-4" />
              <th className="px-6 py-4">Shift</th>
              <SortableHeader label="Branch" sortKey="branch" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={onSort} className="px-6 py-4" />
              <th className="px-6 py-4">Date Hired</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold text-xs">Loading employees...</td></tr>
            ) : employees.length > 0 ? (
              employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-red-50/50 transition-colors duration-200 group">
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{employee.zkId ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`${basePath}/${employee.id}`} className="block transition-transform hover:scale-105 active:scale-95">
                      <Avatar
                        src={employee.profilePicture || null}
                        initials={`${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.trim()}
                        size="sm"
                        className="ring-2 ring-white shadow-sm hover:ring-red-200 transition-all"
                      />
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`${basePath}/${employee.id}`} className="block group/link">
                      <p className="font-bold text-slate-700 group-hover/link:text-red-600 transition-colors">
                        {formatFullName(employee.firstName, employee.middleName, employee.lastName, employee.suffix)}
                      </p>
                      <p className="text-xs text-slate-400">{employee.email || '—'}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{employee.employeeNumber ?? '—'}</td>
                  <td className="px-6 py-4">
                    {employee.Shift ? (
                      <div>
                        <p className="text-xs font-bold text-slate-700 leading-tight">{employee.Shift.name}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">{formatTime(employee.Shift.startTime)} – {formatTime(employee.Shift.endTime)}</p>
                      </div>
                    ) : (<span className="text-[10px] text-slate-300 font-bold">Unassigned</span>)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-500">{employee.Branch?.name || '—'}</span>
                    {employee.Company ? (
                      <p className="text-[10px] text-slate-400 mt-0.5">{employee.Company.name}</p>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 mt-0.5">No Company</span>
                    )}
                  </td>
                  <td className="px-6 py-4"><span className="text-xs font-medium text-slate-500">{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {isInactiveMode ? (
                        <>
                          <button
                            onClick={() => onRestore?.(employee)}
                            title="Restore to Active"
                            className="p-2.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all active:scale-90"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onPermanentDelete?.(employee)}
                            title="Delete Permanently"
                            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href={`${basePath}/${employee.id}`}
                            className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90"
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button onClick={() => onEdit(employee)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90" title="Edit employee">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {(() => {
                            const status = enrollStatus[employee.id] || 'idle'
                            if (status === 'loading') {
                              return (<button disabled className="p-2.5 rounded-xl bg-blue-50 text-blue-400 cursor-wait" title="Enrolling..."><Fingerprint className="w-4 h-4 animate-pulse" /></button>)
                            }
                            return (
                              <button onClick={() => { onFingerprintOpen(employee.id, `${employee.firstName} ${employee.lastName}`) }}
                                className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-xl transition-all active:scale-90" title="Manage Fingerprints">
                                <Fingerprint className="w-4 h-4" />
                              </button>
                            )
                          })()}
                          <button onClick={() => { onCardEnrollOpen(employee.id, `${employee.firstName} ${employee.lastName}`, employee.cardNumber || null) }}
                            className={`p-2.5 rounded-xl transition-all active:scale-90 ${employee.cardNumber ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                            title={employee.cardNumber ? `Badge #${employee.cardNumber}` : 'Enroll RFID Badge'}>
                            <CreditCard className="w-4 h-4" />
                          </button>
                          <button onClick={() => onResetPassword(employee)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90" title="Reset Password">
                            <Key className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} className="px-6 py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">No matching employees found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <DataTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        totalCount={filteredCount}
        pageSize={pageSize}
        entityName="employees"
        loading={loading}
      />
    </div>
  )
}
