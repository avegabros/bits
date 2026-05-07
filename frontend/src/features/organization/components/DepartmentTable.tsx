import { Users, Edit2, Trash2 } from 'lucide-react'
import { SortableHeader } from '@/components/ui/SortableHeader'
import type { Department } from '../types'
import { getColor, getInitials } from '../types'

interface DepartmentTableProps {
  paginatedDepts: Department[]
  deptCounts: Record<string, number>
  currentPage: number
  rowsPerPage: number
  totalCount: number
  sortKey: string | null
  sortOrder: 'asc' | 'desc' | null
  handleSort: (key: any) => void
  onEditDept: (dept: Department) => void
  onDeleteDept: (dept: Department) => void
}

export function DepartmentTable({
  paginatedDepts, deptCounts,
  currentPage, rowsPerPage, totalCount,
  sortKey, sortOrder, handleSort,
  onEditDept, onDeleteDept,
}: DepartmentTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div
        className="overflow-x-auto scrollbar-table"
        tabIndex={0}
        role="region"
        aria-label="Departments table — scroll horizontally"
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 w-16">#</th>
              <SortableHeader label="Department" sortKey="name" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-6 py-4" />
              <th className="px-6 py-4 w-36">Employees</th>
              <th className="px-6 py-4 w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedDepts.map((dept, index) => {
              const globalIndex = (currentPage - 1) * rowsPerPage + index
              const color = getColor(globalIndex)
              const count = deptCounts[dept.name] || 0
              const initials = getInitials(dept.name)
              const displayName = dept.name.replace(' DEPARTMENT', '')
              return (
                <tr key={dept.id} className="hover:bg-red-50/50 transition-colors duration-200 group">
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">{String(index + 1).padStart(2, '0')}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 ${color.icon} rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0`}>
                        {initials}
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">{displayName}</span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Department</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className={`w-3.5 h-3.5 ${color.light}`} />
                      <span className="text-xs font-bold text-slate-500">{count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEditDept(dept)}
                        title="Edit department"
                        className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {count === 0 ? (
                        <button
                          onClick={() => onDeleteDept(dept)}
                          title="Remove department"
                          className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span
                          title={`Cannot delete — ${count} active employee${count > 1 ? 's' : ''} assigned`}
                          className="p-2.5 text-slate-200 cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {totalCount === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                  No departments found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
        <span className="text-xs text-slate-400 font-bold">
          Showing {paginatedDepts.length} of {totalCount} department{totalCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
