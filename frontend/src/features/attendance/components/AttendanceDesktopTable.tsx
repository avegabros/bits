import React from 'react'
import { AlertCircle, Edit2, Fingerprint, PenLine, AlertTriangle, Trash2 } from 'lucide-react'
import { SortableHeader } from '@/components/ui/SortableHeader'
import { fmtHours, formatLate, fmtMins } from '../utils/attendance-formatters'
import { AttendanceRecord } from '../types'

interface AttendanceDesktopTableProps {
  loading: boolean
  sortedRecords: AttendanceRecord[]
  sortKeyStr: string | null
  sortOrder: 'asc' | 'desc' | null
  handleSort: (key: keyof AttendanceRecord) => void
  currentPage: number
  rowsPerPage: number
  handleEditClick: (row: AttendanceRecord) => void
  handleDeleteClick?: (row: AttendanceRecord) => void
}

export function AttendanceDesktopTable({
  loading,
  sortedRecords,
  sortKeyStr,
  sortOrder,
  handleSort,
  currentPage,
  rowsPerPage,
  handleEditClick,
  handleDeleteClick,
}: AttendanceDesktopTableProps) {
  return (
    <table className="w-full text-left border-collapse min-w-[800px] bg-card">
      <thead className="bg-secondary/50 backdrop-blur-sm border-b border-border">
        <tr>
          <SortableHeader label="Employee"    sortKey="employeeName"     currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight" />
          <SortableHeader label="Shift"       sortKey="shiftCode"        currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center" />
          <SortableHeader label="Clock In"    sortKey="checkIn"          currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center" />
          <SortableHeader label="Clock Out"   sortKey="checkOut"         currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center" />
          <SortableHeader label="Late"        sortKey="lateMinutes"      currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center text-yellow-500" />
          <SortableHeader label="Reg Hrs"     sortKey="totalHours"       currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center" />
          <SortableHeader label="OT"          sortKey="overtimeMinutes"  currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center text-emerald-500" />
          <SortableHeader label="UT"          sortKey="undertimeMinutes" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center text-red-500" />
          <SortableHeader label="Status"      sortKey="status"           currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center" />
          <th className="px-2 py-3 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {loading ? (
          <tr><td colSpan={10} className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading attendance...</span>
            </div>
          </td></tr>
        ) : sortedRecords.length === 0 ? (
          <tr><td colSpan={10} className="px-6 py-16 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest">No attendance records found</td></tr>
        ) : (
          sortedRecords.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map(row => (
            <tr key={row.id} className="hover:bg-primary/5 transition-colors duration-200 group cursor-default">
              {/* Employee */}
              <td className="px-4 py-3 flex items-center gap-2 relative">
                {row.isPending && (
                  <span title="Pending Request" className="absolute top-0 left-0 bg-yellow-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-br-md shadow-sm z-10 leading-none tracking-widest">PR</span>
                )}
                <div className="relative group/avatar shrink-0">
                  {row.profilePicture ? (
                    <img 
                      src={row.profilePicture} 
                      alt={row.employeeName}
                      className="w-8 h-8 rounded-full object-cover border border-border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(row.employeeName)}&background=random`
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] uppercase tracking-tight">
                      {row.employeeName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground leading-tight uppercase tracking-tight">{row.employeeName}</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">{row.department}{row.branchName ? ` · ${row.branchName}` : ''}</p>
                </div>
              </td>
              {/* Shift */}
              <td className="px-2 py-3 text-center">
                {row.shiftCode ? (
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest whitespace-nowrap ${row.isNightShift ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{row.shiftCode}</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic font-medium">No Shift</span>
                )}
              </td>
              {/* Clock In */}
              <td className="px-4 py-4 text-sm font-mono font-bold text-center">
                <div className="flex flex-col items-center">
                  <span className={`${row.status === 'late' ? 'text-yellow-500' : row.status === 'present' ? 'text-emerald-500' : 'text-muted-foreground'}`}>{row.checkIn}</span>
                  {row.gracePeriodApplied && (
                    <span className="text-[9px] text-slate-400 mt-0.5" title="Check-in was late but within allowed grace period">Grace Period</span>
                  )}
                  {row.checkIn !== '—' && (
                    <div title={row.checkInDevice ?? 'Manual'} className="inline-flex items-center gap-1 mt-1 bg-secondary/60 hover:bg-secondary border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                      <Fingerprint className="w-2.5 h-2.5 text-primary shrink-0 opacity-80" />
                      <span className="text-[9px] text-muted-foreground font-bold truncate leading-none pt-px">{row.checkInDevice ?? 'Manual'}</span>
                    </div>
                  )}
                </div>
              </td>
              {/* Clock Out */}
              <td className="px-4 py-4 text-sm font-mono text-muted-foreground font-bold text-center">
                {row.isEarlyPunch ? (
                  <div className="flex flex-col items-center">
                    {row.isShiftActive ? (
                      <span className="inline-flex items-center gap-2 text-blue-500 font-bold text-[10px] uppercase tracking-wider">
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>Active
                      </span>
                    ) : row.checkOut !== '—' ? (
                      <span>{row.checkOut}</span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 text-orange-500 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap mt-0.5" title={row.notes ?? undefined}>
                      <AlertCircle className="w-3 h-3" /> Early punch flagged
                    </span>
                  </div>
                ) : row.isShiftActive ? (
                  <span className="inline-flex items-center gap-2 text-blue-500 font-bold text-[10px] uppercase tracking-wider">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>Active
                  </span>
                ) : row.displayStatus === 'missing_checkout' || row.isMissingCheckout ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap" title={row.notes ?? undefined}>
                      <AlertCircle className="w-3 h-3" /> No checkout
                    </span>
                  </div>
                ) : row.checkOut === '—' && row.isMissingCheckout ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap" title={row.notes ?? undefined}>
                      <AlertCircle className="w-3 h-3" /> No checkout
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="inline-flex items-center gap-1">
                      {row.checkoutSource === 'auto_closed' && (
                        <span title="Auto-closed (estimated)"><AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" /></span>
                      )}
                      {row.checkoutSource === 'manual' ? (
                        <span>{row.checkOut} <span className="text-[9px] text-amber-600 font-bold">(estimated)</span></span>
                      ) : (
                        <span>{row.checkOut}</span>
                      )}
                    </span>
                    {row.checkOut !== '—' && (
                      row.checkoutSource === 'manual' ? (
                        <div title="Manually set" className="inline-flex items-center gap-1 mt-1 bg-secondary/60 hover:bg-secondary border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                          <PenLine className="w-2.5 h-2.5 text-amber-500 shrink-0 opacity-80" />
                          <span className="text-[9px] text-amber-600 font-bold truncate leading-none pt-px">Manual</span>
                        </div>
                      ) : row.checkoutSource === 'auto_closed' ? (
                        <div title="Auto-closed — estimated checkout" className="inline-flex items-center gap-1 mt-1 bg-secondary/60 hover:bg-secondary border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0 opacity-80" />
                          <span className="text-[9px] text-amber-600 font-bold truncate leading-none pt-px">Auto-Closed</span>
                        </div>
                      ) : (
                        <div title={row.checkOutDevice ?? 'Manual'} className="inline-flex items-center gap-1 mt-1 bg-secondary/60 hover:bg-secondary border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                          <Fingerprint className="w-2.5 h-2.5 text-primary shrink-0 opacity-80" />
                          <span className="text-[9px] text-muted-foreground font-bold truncate leading-none pt-px">{row.checkOutDevice ?? 'Manual'}</span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </td>
              {/* Late */}
              <td className="px-2 py-3 text-center">
                {row.lateMinutes > 0 ? (
                  <span className="text-[10px] font-black text-yellow-600 bg-yellow-50 border border-yellow-100 px-2.5 py-1 rounded-full whitespace-nowrap">{formatLate(row.lateMinutes)}</span>
                ) : row.gracePeriodApplied ? (
                  <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">0m (Grace)</span>
                ) : <span className="text-[10px] text-slate-300 font-black">—</span>}
              </td>
              {/* Hours */}
              <td className="px-4 py-4 text-sm font-mono text-slate-700 font-bold text-center">
                {row.isShiftActive ? <span className="text-slate-400 text-xs italic">Live</span> : fmtHours(Math.max(0, row.totalHours - (row.overtimeMinutes / 60)))}
              </td>
              {/* OT */}
              <td className="px-2 py-3 text-center">
                <span className={`text-sm font-bold ${row.overtimeMinutes > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                  {row.overtimeMinutes > 0 ? `+${fmtMins(row.overtimeMinutes)}` : '—'}
                </span>
              </td>
              {/* UT */}
              <td className="px-2 py-3 text-center">
                <span className={`text-sm font-bold ${row.undertimeMinutes > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                  {row.undertimeMinutes > 0 ? `-${fmtMins(row.undertimeMinutes)}` : '—'}
                </span>
              </td>
              {/* Status */}
              <td className="px-2 py-3 text-center">
                <div className="flex flex-col items-center justify-center gap-1">
                  <span className={`font-black text-[10px] uppercase px-3 py-1 rounded-full border whitespace-nowrap ${
                    row.displayStatus === 'present'           ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                    : row.displayStatus === 'IN_PROGRESS'      ? 'text-blue-500 bg-blue-500/10 border-blue-500/20'
                    : row.displayStatus === 'late'             ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
                    : row.displayStatus === 'missing_checkout' ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                    : row.displayStatus === 'incomplete'       ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                    : row.displayStatus === 'pending'          ? 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                    : row.displayStatus === 'holiday'          ? 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'
                    : row.displayStatus === '—'                ? 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                    : 'text-red-500 bg-red-500/10 border-red-500/20'
                  }`}>
                    {row.displayStatus === 'present' ? 'On Time' : row.displayStatus === 'IN_PROGRESS' ? 'In Progress' : row.displayStatus === 'missing_checkout' ? 'Missing Checkout' : row.displayStatus === 'holiday' ? 'Holiday' : row.displayStatus}
                  </span>
                  {row.isEdited && (
                    <span 
                      title={row.notes || 'Manually adjusted'}
                      className="font-black text-[10px] uppercase px-2 py-0.5 rounded-full border whitespace-nowrap text-violet-500 bg-violet-500/10 border-violet-500/20 cursor-help"
                    >
                      Edited
                    </span>
                  )}
                </div>
              </td>
              {/* Actions */}
              <td className="px-2 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => handleEditClick(row)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Edit Record">
                    <Edit2 size={16} />
                  </button>
                  {handleDeleteClick && typeof row.id === 'number' && (
                    <button onClick={() => handleDeleteClick(row)} className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-600/10 rounded-lg transition-all" title="Delete Record">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
