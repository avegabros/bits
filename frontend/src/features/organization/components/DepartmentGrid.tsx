import { Building2, Users, Edit2, Trash2 } from 'lucide-react'
import type { Department } from '../types'
import { getColor, getInitials } from '../types'

interface DepartmentGridProps {
  paginatedDepts: Department[]
  deptCounts: Record<string, number>
  currentPage: number
  rowsPerPage: number
  totalCount: number
  onEditDept: (dept: Department) => void
  onDeleteDept: (dept: Department) => void
}

export function DepartmentGrid({
  paginatedDepts, deptCounts,
  currentPage, rowsPerPage, totalCount,
  onEditDept, onDeleteDept,
}: DepartmentGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {paginatedDepts.map((dept, index) => {
        const globalIndex = (currentPage - 1) * rowsPerPage + index
        const color = getColor(globalIndex)
        const count = deptCounts[dept.name] || 0
        const initials = getInitials(dept.name)
        const displayName = dept.name.replace(' DEPARTMENT', '')
        return (
          <div
            key={dept.id}
            className={`group relative ${color.bg} border ${color.border} rounded-2xl p-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 hover:-translate-y-0.5`}
          >
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={() => onEditDept(dept)}
                className="p-2 rounded-xl text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                title="Edit department"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              {count === 0 ? (
                <button
                  onClick={() => onDeleteDept(dept)}
                  className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Remove department"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span
                  title={`Cannot delete — ${count} active employee${count > 1 ? 's' : ''} assigned`}
                  className="p-2 rounded-xl text-slate-200 cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 ${color.icon} rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0 shadow-lg`}
                style={{ boxShadow: `0 4px 14px ${color.accent}30` }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-700 text-sm leading-tight">{displayName}</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Department</p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className={`w-3.5 h-3.5 ${color.light}`} />
                <span className="text-xs font-bold text-slate-500">{count} {count === 1 ? 'employee' : 'employees'}</span>
              </div>
              {count > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-500">Active</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
      {totalCount === 0 && (
        <div className="col-span-full py-20 text-center">
          <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No departments found</p>
        </div>
      )}
    </div>
  )
}
