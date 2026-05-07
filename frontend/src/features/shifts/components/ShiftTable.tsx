import {
  Edit2, Trash2, ToggleLeft, ToggleRight,
  Moon, Sun, Users, Coffee
} from 'lucide-react'
import { SortableHeader } from '@/components/ui/SortableHeader'
import type { Shift } from '../types'
import { formatTime, calcDuration, calcBreaksDuration } from '../utils/shift-formatters'

interface ShiftTableProps {
  paginatedShifts: Shift[]
  loading: boolean
  sortKey: string | null
  sortOrder: 'asc' | 'desc' | null
  handleSort: (key: any) => void
  onToggle: (s: Shift) => void
  onEdit: (s: Shift) => void
  onDelete: (s: Shift) => void
  isReadOnly?: boolean
}

export function ShiftTable({
  paginatedShifts, loading,
  sortKey, sortOrder, handleSort,
  onToggle, onEdit, onDelete, isReadOnly,
}: ShiftTableProps) {
  return (
    <>
      {/* Desktop Table (lg+) */}
      <div
        className="hidden lg:block overflow-x-auto scrollbar-table"
        tabIndex={0}
        role="region"
        aria-label="Shifts table — scroll horizontally"
      >
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr>
              <SortableHeader label="Shift" sortKey="name" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-6 py-5" />
              <SortableHeader label="Schedule" sortKey="startTime" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-6 py-5" />
              <th className="px-6 py-5">Work Days</th>
              <th className="px-6 py-5">Grace / Break</th>
              <th className="px-6 py-5">Employees</th>
              <SortableHeader label="Status" sortKey="isActive" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-6 py-5 text-center" />
              {!isReadOnly && <th className="px-6 py-5">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-24 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">Loading shifts…</td></tr>
            ) : paginatedShifts.length > 0 ? paginatedShifts.map(s => (
              <tr key={s.id} className="hover:bg-red-50/30 transition-colors duration-200">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.isNightShift ? 'bg-indigo-100' : 'bg-amber-100'}`}>
                      {s.isNightShift ? <Moon size={16} className="text-indigo-600" /> : <Sun size={16} className="text-amber-600" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 text-sm">{s.name}</p>
                      <p className="text-[10px] font-black text-slate-400 tracking-wider">{s.shiftCode}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-xs font-bold text-slate-700">{formatTime(s.startTime)} – {formatTime(s.endTime)}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{calcDuration(s.startTime, s.endTime, s.isNightShift)} shift</p>
                </td>
                <td className="px-6 py-4">
                  {(() => {
                    let days: string[] = []
                    let halfs: string[] = []
                    try { days = JSON.parse(s.workDays || '[]') } catch { }
                    try { halfs = JSON.parse(s.halfDays || '[]') } catch { }
                    return (
                      <div className="flex flex-wrap gap-1">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => {
                          const on = days.includes(d)
                          const half = halfs.includes(d)
                          const isWeekend = d === 'Sat' || d === 'Sun'
                          return (
                            <div key={d} className="flex flex-col items-center gap-0.5">
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${on
                                ? isWeekend ? 'bg-red-100 text-red-600' : 'bg-slate-700 text-white'
                                : 'bg-slate-100 text-slate-300'
                                }`}>{d}</span>
                              {on && half && (
                                <span className="text-[8px] font-black bg-orange-400 text-white px-1 rounded-sm">½</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{s.graceMinutes}m grace</span>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      <Coffee size={11} className="text-slate-400" />{calcBreaksDuration(s.breaks, s.breakMinutes)}m break
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-600">{s._count.Employee}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {!isReadOnly && (
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => onToggle(s)} title={s.isActive ? 'Deactivate' : 'Activate'}
                        className={`p-2.5 rounded-xl transition-all active:scale-90 ${s.isActive ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                        {s.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <button onClick={() => onEdit(s)} title="Edit" className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => onDelete(s)} title="Delete" className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            )) : (
              <tr><td colSpan={7} className="px-6 py-24 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No shifts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards (<lg) */}
      <div className="lg:hidden">
        {loading ? (
          <div className="px-4 py-16 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">Loading shifts…</div>
        ) : paginatedShifts.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {paginatedShifts.map(s => {
              let days: string[] = []
              let halfs: string[] = []
              try { days = JSON.parse(s.workDays || '[]') } catch { }
              try { halfs = JSON.parse(s.halfDays || '[]') } catch { }
              return (
                <div key={s.id} className="p-4 hover:bg-red-50/30 transition-colors">
                  {/* Top row: Shift name + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.isNightShift ? 'bg-indigo-100' : 'bg-amber-100'}`}>
                        {s.isNightShift ? <Moon size={18} className="text-indigo-600" /> : <Sun size={18} className="text-amber-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 text-sm truncate">{s.name}</p>
                        <p className="text-[10px] font-black text-slate-400 tracking-wider">{s.shiftCode}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Schedule + Meta */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700">{formatTime(s.startTime)} – {formatTime(s.endTime)}</span>
                    <span className="text-slate-400 font-medium">({calcDuration(s.startTime, s.endTime, s.isNightShift)})</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{s.graceMinutes}m grace</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      <Coffee size={11} className="text-slate-400" />{calcBreaksDuration(s.breaks, s.breakMinutes)}m break
                    </span>
                  </div>

                  {/* Work Days */}
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => {
                      const on = days.includes(d)
                      const half = halfs.includes(d)
                      const isWeekend = d === 'Sat' || d === 'Sun'
                      return (
                        <div key={d} className="flex flex-col items-center gap-0.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${on
                            ? isWeekend ? 'bg-red-100 text-red-600' : 'bg-slate-700 text-white'
                            : 'bg-slate-100 text-slate-300'
                            }`}>{d}</span>
                          {on && half && (
                            <span className="text-[8px] font-black bg-orange-400 text-white px-1 rounded-sm">½</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Bottom row: Employees + Actions */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Users size={13} className="text-slate-400" />
                      <span className="font-bold">{s._count.Employee}</span>
                      <span className="text-slate-400">assigned</span>
                    </div>
                    {!isReadOnly && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => onToggle(s)} title={s.isActive ? 'Deactivate' : 'Activate'}
                          className={`p-2 rounded-xl transition-all active:scale-90 ${s.isActive ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                          {s.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button onClick={() => onEdit(s)} title="Edit" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => onDelete(s)} title="Delete" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-4 py-16 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No shifts found</div>
        )}
      </div>
    </>
  )
}
