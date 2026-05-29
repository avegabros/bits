import React, { useState } from 'react'
import { AlertCircle, Edit2, Fingerprint, PenLine, AlertTriangle, Trash2, Clock } from 'lucide-react'
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
  handleEditClick?: (row: AttendanceRecord) => void
  handleDeleteClick?: (row: AttendanceRecord) => void
  onShiftClick?: (shiftCode: string, row: AttendanceRecord) => void
  shiftFilter?: string | null
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
  onShiftClick,
  shiftFilter,
}: AttendanceDesktopTableProps) {
  const [expandedOTRecordId, setExpandedOTRecordId] = useState<string | number | null>(null)

  const isAllShifts = !shiftFilter || shiftFilter === 'All Shifts'
  const showActions = !!(handleEditClick || handleDeleteClick)
  const totalColumns = (10 - (showActions ? 0 : 1)) - (isAllShifts ? 0 : 1)

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
          {isAllShifts && (
            <SortableHeader label="OT"          sortKey="overtimeMinutes"  currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center text-emerald-500" />
          )}
          <SortableHeader label="UT"          sortKey="undertimeMinutes" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center text-red-500" />
          <SortableHeader label="Status"      sortKey="status"           currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-2 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center" />
          {showActions && (
            <th className="px-2 py-3 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">Actions</th>
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {loading ? (
          <tr><td colSpan={totalColumns} className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading attendance...</span>
            </div>
          </td></tr>
        ) : sortedRecords.length === 0 ? (
          <tr><td colSpan={totalColumns} className="px-6 py-16 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest">No attendance records found</td></tr>
        ) : (
          sortedRecords.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map(row => (
            <React.Fragment key={row.id}>
              <tr className="hover:bg-primary/5 transition-colors duration-200 group cursor-default">
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
                <td className="px-2 py-3 text-center">
                  {row.isMerged && row.subRecords ? (
                    <div className="flex flex-col items-center gap-1">
                      {row.subRecords.map((sr, idx) => {
                        const isComplete = sr.checkIn !== '—' && sr.checkOut !== '—' && sr.checkoutSource !== 'auto_closed';
                        const colorClass = isComplete
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                        const isOtApproved = (sr.approvedOts && sr.approvedOts.length > 0) || (row.approvedOts && row.approvedOts.length > 0);
                        const label = sr.shiftCode ?? sr.shiftName ?? (isOtApproved ? 'OT Approved' : 'No Shift');
                        return (
                          <div key={idx} className="flex flex-col items-center">
                            {onShiftClick && (sr.shiftCode || sr.shiftName || isOtApproved) ? (
                              <button 
                                onClick={() => onShiftClick(sr.shiftName || sr.shiftCode || 'OT Approved', row)}
                                className={`group/shift text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest whitespace-nowrap transition-all hover:scale-105 active:scale-95 cursor-pointer ${colorClass}`}
                                title={isOtApproved && !sr.shiftCode && !sr.shiftName ? 'Click to go to Manage OT → Live Monitoring' : 'Click to filter and edit'}
                              >
                                <span className="group-hover/shift:hidden">{label}</span>
                                <span className="hidden group-hover/shift:inline">{sr.shiftName ?? sr.shiftCode ?? (isOtApproved ? 'OT Approved' : 'No Shift')}</span>
                              </button>
                            ) : (
                              <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest whitespace-nowrap ${colorClass}`} title={sr.shiftName || sr.shiftCode || undefined}>
                                {label}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (() => {
                    const isOtApproved = row.approvedOts && row.approvedOts.length > 0;
                    if (row.shiftName || row.shiftCode || isOtApproved) {
                      const isComplete = row.checkIn !== '—' && row.checkOut !== '—' && row.checkoutSource !== 'auto_closed';
                      const colorClass = isComplete
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20';
                      const label = row.shiftCode ?? row.shiftName ?? 'OT Approved';
                      const hoverLabel = row.shiftName ?? row.shiftCode ?? 'OT Approved';
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          {onShiftClick && (row.shiftName || row.shiftCode || isOtApproved) ? (
                            <button 
                              onClick={() => onShiftClick(row.shiftName || row.shiftCode || 'OT Approved', row)}
                              className={`group/shift text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest whitespace-nowrap transition-all hover:scale-105 active:scale-95 cursor-pointer ${colorClass}`}
                              title={isOtApproved && !row.shiftName && !row.shiftCode ? 'Click to go to Manage OT → Live Monitoring' : 'Click to filter and edit'}
                            >
                              <span className="group-hover/shift:hidden">{label}</span>
                              <span className="hidden group-hover/shift:inline">{hoverLabel}</span>
                            </button>
                          ) : (
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest whitespace-nowrap ${colorClass}`} title={row.shiftName || row.shiftCode || undefined}>
                              {label}
                            </span>
                          )}
                        </div>
                      )
                    }
                    return (
                      <span className="text-[10px] text-muted-foreground italic font-medium">No Shift</span>
                    )
                  })()}
                </td>
                {/* Clock In */}
                <td className="px-4 py-4 text-sm font-mono font-bold text-center">
                  {row.isMerged && row.subRecords ? (
                    <div className="flex flex-col items-center gap-2">
                      {row.subRecords.map((sr, idx) => (
                        <div key={idx} className="flex flex-col items-center h-[34px] justify-center">
                          <span className={`${sr.status === 'late' ? 'text-yellow-500' : sr.status === 'present' ? 'text-emerald-500' : 'text-muted-foreground'}`}>{sr.checkIn}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
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
                  )}
                </td>
                {/* Clock Out */}
                <td className="px-4 py-4 text-sm font-mono text-muted-foreground font-bold text-center">
                  {row.isMerged && row.subRecords ? (
                    <div className="flex flex-col items-center gap-2">
                      {row.subRecords.map((sr, idx) => (
                        <div key={idx} className="flex flex-col items-center h-[34px] justify-center">
                          <span className="inline-flex items-center gap-1">
                            {sr.isShiftActive ? (
                              <span className="inline-flex items-center gap-2 text-blue-500 font-bold text-[10px] uppercase tracking-wider">
                                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>Active
                              </span>
                            ) : (
                              <span>{sr.checkOut}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : row.isEarlyPunch ? (
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
                  {row.isShiftActive ? <span className="text-slate-400 text-xs italic">Live</span> : fmtHours(Math.max(0, row.totalHours))}
                </td>
                {/* OT */}
                {isAllShifts && (
                  <td
                    onClick={(e) => {
                      e.stopPropagation();
                      if (row.overtimeMinutes > 0 || (row.approvedOts && row.approvedOts.length > 0)) {
                        setExpandedOTRecordId(expandedOTRecordId === row.id ? null : row.id);
                      }
                    }}
                    className={`px-2 py-3 text-center ${
                      (row.overtimeMinutes > 0 || (row.approvedOts && row.approvedOts.length > 0))
                        ? 'cursor-pointer hover:bg-emerald-500/10 transition-colors select-none'
                        : ''
                    }`}
                    title={
                      (row.overtimeMinutes > 0 || (row.approvedOts && row.approvedOts.length > 0))
                        ? "Click to view detailed overtime records"
                        : undefined
                    }
                  >
                    <span className={`text-sm font-bold ${row.overtimeMinutes > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {row.overtimeMinutes > 0 ? `+${fmtMins(row.overtimeMinutes)}` : '—'}
                    </span>
                  </td>
                )}
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
                      row.isMerged                               ? 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                      : row.displayStatus === 'present'           ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                      : row.displayStatus === 'IN_PROGRESS'      ? 'text-blue-500 bg-blue-500/10 border-blue-500/20'
                      : row.displayStatus === 'late'             ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
                      : row.displayStatus === 'missing_checkout' ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                      : row.displayStatus === 'incomplete'       ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                      : row.displayStatus === 'pending'          ? 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                      : row.displayStatus === 'holiday'          ? 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'
                      : row.displayStatus === 'rest_day'         ? 'text-slate-400 bg-slate-400/10 border-slate-400/20'
                      : row.displayStatus === '—'                ? 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                      : 'text-red-500 bg-red-500/10 border-red-500/20'
                    }`}>
                      {row.isMerged ? 'Multiple Shifts' : row.displayStatus === 'present' ? 'On Time' : row.displayStatus === 'IN_PROGRESS' ? 'In Progress' : row.displayStatus === 'missing_checkout' ? 'Missing Checkout' : row.displayStatus === 'holiday' ? 'Holiday' : row.displayStatus === 'rest_day' ? 'Rest Day' : row.displayStatus}
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
                {showActions && (
                  <td className="px-2 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {handleEditClick && (
                        <button onClick={() => handleEditClick(row)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Edit Record">
                          <Edit2 size={16} />
                        </button>
                      )}
                      {handleDeleteClick && typeof row.id === 'number' && (
                        <button onClick={() => handleDeleteClick(row)} className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-600/10 rounded-lg transition-all" title="Delete Record">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
              {expandedOTRecordId === row.id && (
                <tr className="bg-slate-50/50">
                  <td colSpan={totalColumns} className="px-6 py-4 border-b border-slate-100">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-emerald-500" /> Overtime Details
                        </h4>
                        <button
                          onClick={() => setExpandedOTRecordId(null)}
                          className="text-xs text-slate-400 hover:text-slate-600 font-bold hover:underline"
                        >
                          Close
                        </button>
                      </div>
                      
                      {row.approvedOts && row.approvedOts.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {row.approvedOts.map((ot: any, idx: number) => {
                            // Calculate approved duration
                            const [startH, startM] = ot.startTime.split(':').map(Number);
                            const [endH, endM] = ot.endTime.split(':').map(Number);
                            let diffMins = (endH * 60 + endM) - (startH * 60 + startM);
                            if (diffMins < 0) diffMins += 24 * 60;
                            const approvedHours = (diffMins / 60).toFixed(1);

                            // Calculate actual duration
                            let actualHours: string | null = null;
                            if (ot.actualStartTime && ot.actualEndTime) {
                              const actualStart = new Date(ot.actualStartTime);
                              const actualEnd = new Date(ot.actualEndTime);
                              const diffMs = actualEnd.getTime() - actualStart.getTime();
                              if (diffMs > 0) {
                                actualHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
                              }
                            }

                            // Format requested times to 12-hour with AM/PM
                            const fmtTime12 = (t: string) => {
                              const [h, m] = t.split(':').map(Number);
                              const ampm = h >= 12 ? 'PM' : 'AM';
                              const h12 = h % 12 || 12;
                              return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
                            };

                            // Format actual timestamps
                            const fmtActual = (dt: string | null | undefined) => {
                              if (!dt) return null;
                              return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                            };

                            const actualIn = fmtActual(ot.actualStartTime);
                            const actualOut = fmtActual(ot.actualEndTime);

                            // Format date
                            const otDateStr = new Date(ot.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              timeZone: 'UTC'
                            });

                            return (
                              <div key={idx} className="py-3 first:pt-0 last:pb-0">
                                {/* Date header */}
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-xs font-bold text-slate-800">{otDateStr}</span>
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">Approved</span>
                                </div>

                                {/* Comparison grid */}
                                <div className="grid grid-cols-2 gap-3">
                                  {/* Left: Requested / Approved Schedule */}
                                  <div className="bg-slate-50 rounded-lg border border-slate-200/80 p-3 space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
                                      Requested Schedule
                                    </p>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500 font-medium">Start Time</span>
                                        <span className="text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{fmtTime12(ot.startTime)}</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500 font-medium">End Time</span>
                                        <span className="text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{fmtTime12(ot.endTime)}</span>
                                      </div>
                                    </div>
                                    <div className="pt-1.5 border-t border-slate-200/60">
                                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{approvedHours} hrs approved</span>
                                    </div>
                                  </div>

                                  {/* Right: Actual Biometric Attendance */}
                                  <div className="bg-emerald-50/50 rounded-lg border border-emerald-200/60 p-3 space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                                      Actual Attendance
                                    </p>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500 font-medium">Time In</span>
                                        {actualIn ? (
                                          <span className="text-xs font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">{actualIn}</span>
                                        ) : (
                                          <span className="text-xs font-medium text-slate-400 italic">—</span>
                                        )}
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500 font-medium">Time Out</span>
                                        {actualOut ? (
                                          <span className="text-xs font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">{actualOut}</span>
                                        ) : (
                                          <span className="text-xs font-medium text-slate-400 italic">—</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="pt-1.5 border-t border-emerald-200/40">
                                      {actualHours ? (
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">{actualHours} hrs rendered</span>
                                      ) : (
                                        <span className="text-[10px] font-medium text-slate-400 italic">No clock-in/out recorded</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No approved overtime requests found for this day.</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))
        )}
      </tbody>
    </table>
  )
}
