import React from 'react'
import { Edit2, Fingerprint, PenLine, AlertTriangle, Trash2 } from 'lucide-react'
import { fmtHours, formatLate, fmtMins } from '../utils/attendance-formatters'
import { AttendanceRecord } from '../types'

interface AttendanceMobileCardsProps {
  loading: boolean
  records: AttendanceRecord[]
  sortedRecords: AttendanceRecord[]
  currentPage: number
  rowsPerPage: number
  handleEditClick?: (row: AttendanceRecord) => void
  handleDeleteClick?: (row: AttendanceRecord) => void
}

export function AttendanceMobileCards({
  loading,
  records,
  sortedRecords,
  currentPage,
  rowsPerPage,
  handleEditClick,
  handleDeleteClick,
}: AttendanceMobileCardsProps) {
  if (loading) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading attendance...</span>
        </div>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-muted-foreground font-black uppercase text-[10px] tracking-widest">
        No attendance records found
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {sortedRecords.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map(row => (
        <div key={row.id} className="p-4 hover:bg-primary/5 transition-colors relative">
          {row.isPending && (
            <span title="Pending Request" className="absolute top-0 left-0 bg-yellow-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-br-md shadow-sm z-10 leading-none tracking-widest">PR</span>
          )}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
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
              <div className="min-w-0 flex-1">
                <p className="font-black text-foreground text-sm truncate uppercase tracking-tight">{row.employeeName}</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">{row.department} • {row.branchName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <span className={`font-black text-[10px] uppercase px-3 py-1 rounded-full border whitespace-nowrap ${
                row.displayStatus === 'present'           ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                  : row.displayStatus === 'IN_PROGRESS'      ? 'text-blue-500 bg-blue-500/10 border-blue-500/20'
                  : row.displayStatus === 'late'             ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
                  : row.displayStatus === 'missing_checkout' ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                  : row.displayStatus === 'rest_day'         ? 'text-slate-400 bg-slate-400/10 border-slate-400/20'
                  : row.displayStatus === '—'                ? 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                  : 'text-red-500 bg-red-500/10 border-red-500/20'
              }`}>
                {row.displayStatus === 'present' ? 'On Time' : row.displayStatus === 'IN_PROGRESS' ? 'In Progress' : row.displayStatus === 'missing_checkout' ? 'Missing Checkout' : row.displayStatus === 'rest_day' ? 'Rest Day' : row.displayStatus}
              </span>
              {row.isEdited && (
                <span 
                  title={row.notes || 'Manually adjusted'}
                  className="font-black text-[10px] uppercase px-2 py-0.5 rounded-full border whitespace-nowrap text-violet-500 bg-violet-500/10 border-violet-500/20 cursor-help"
                >
                  Edited
                </span>
              )}
              {handleEditClick && (
                <button onClick={() => handleEditClick(row)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Edit Record">
                  <Edit2 size={14} />
                </button>
              )}
              {handleDeleteClick && typeof row.id === 'number' && (
                <button onClick={() => handleDeleteClick(row)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-600/10 rounded-lg transition-all" title="Delete Record">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Clock In</p>
              <p className={`font-mono font-black text-sm ${row.status === 'late' ? 'text-yellow-500' : row.status === 'present' ? 'text-emerald-500' : 'text-muted-foreground'}`}>{row.checkIn}</p>
              {row.checkIn !== '—' && (
                <div title={row.checkInDevice ?? 'Manual'} className="inline-flex items-center gap-1 mt-1 bg-secondary/60 border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                  <Fingerprint className="w-2.5 h-2.5 text-primary shrink-0 opacity-80" />
                  <span className="text-[9px] text-muted-foreground font-bold truncate leading-none pt-px">{row.checkInDevice ?? 'Manual'}</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Clock Out</p>
              {row.notes?.includes('Early punch detected') ? (
                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Early punch flagged</span>
              ) : row.displayStatus === 'missing_checkout' ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">No checkout</span>
                </div>
              ) : row.checkOut === '—' && row.notes?.includes('No checkout recorded') ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">No checkout</span>
                </div>
              ) : (
                <>
                  <p className="font-mono text-muted-foreground font-black text-sm">
                    {row.checkoutSource === 'auto_closed' && <span title="Auto-closed (estimated)"><AlertTriangle className="w-3 h-3 text-amber-500 inline mr-0.5" /></span>}
                    {row.checkOut}
                    {row.checkoutSource === 'auto_closed' && <span className="text-[9px] text-amber-600 font-bold ml-1">(estimated)</span>}
                  </p>
                  {row.checkOut !== '—' && (
                    row.checkoutSource === 'manual' ? (
                      <div title="Manually set" className="inline-flex items-center gap-1 mt-1 bg-secondary/60 border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                        <PenLine className="w-2.5 h-2.5 text-amber-500 shrink-0 opacity-80" />
                        <span className="text-[9px] text-amber-600 font-bold truncate leading-none pt-px">Manual</span>
                      </div>
                    ) : row.checkoutSource === 'auto_closed' ? (
                      <div title="Auto-closed — estimated checkout" className="inline-flex items-center gap-1 mt-1 bg-secondary/60 border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0 opacity-80" />
                        <span className="text-[9px] text-amber-600 font-bold truncate leading-none pt-px">Auto-Closed</span>
                      </div>
                    ) : (
                      <div title={row.checkOutDevice ?? 'Manual'} className="inline-flex items-center gap-1 mt-1 bg-secondary/60 border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                        <Fingerprint className="w-2.5 h-2.5 text-primary shrink-0 opacity-80" />
                        <span className="text-[9px] text-muted-foreground font-bold truncate leading-none pt-px">{row.checkOutDevice ?? 'Manual'}</span>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Shift</p>
              {row.shiftCode
                ? <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${row.isNightShift ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{row.shiftCode}</span>
                : <span className="text-[10px] text-muted-foreground italic font-medium">No shift</span>
              }
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Reg Hrs</p>
              <p className="font-mono text-foreground font-black text-sm">
                {row.isShiftActive ? <span className="text-blue-500 text-xs font-bold uppercase tracking-widest">Active</span> : fmtHours(Math.max(0, row.totalHours - (row.overtimeMinutes / 60)))}
              </p>
            </div>
          </div>
          {(row.lateMinutes > 0 || row.overtimeMinutes > 0 || row.undertimeMinutes > 0) && (
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
              {row.lateMinutes > 0 && <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">Late {formatLate(row.lateMinutes)}</span>}
              {row.overtimeMinutes > 0 && <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">OT +{fmtMins(row.overtimeMinutes)}</span>}
              {row.undertimeMinutes > 0 && <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">UT -{fmtMins(row.undertimeMinutes)}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
