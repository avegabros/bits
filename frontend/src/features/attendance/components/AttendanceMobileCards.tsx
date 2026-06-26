import React, { useState } from 'react'
import { Edit2, Fingerprint, PenLine, AlertTriangle, Trash2, Clock } from 'lucide-react'
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
  onShiftClick?: (shiftCode: string, row: AttendanceRecord) => void
  shiftFilter?: string | null
}

export function AttendanceMobileCards({
  loading,
  records,
  sortedRecords,
  currentPage,
  rowsPerPage,
  handleEditClick,
  handleDeleteClick,
  onShiftClick,
  shiftFilter,
}: AttendanceMobileCardsProps) {
  const [expandedOTRecordId, setExpandedOTRecordId] = useState<string | number | null>(null)
  const isAllShifts = !shiftFilter || shiftFilter === 'All Shifts';

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
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">{row.department}{row.sectionName && row.sectionName !== '—' ? ` • ${row.sectionName}` : ''} • {row.branchName}</p>
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
              {row.isMerged && row.subRecords ? (
                <div className="flex flex-col gap-2">
                  {row.subRecords.map((sr, idx) => (
                    <div key={idx}>
                      <p className={`font-mono font-black text-sm ${sr.status === 'late' ? 'text-yellow-500' : (sr.status === 'present' || sr.status === 'IN_PROGRESS') ? 'text-emerald-500' : 'text-muted-foreground'}`}>{sr.checkIn}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <p className={`font-mono font-black text-sm ${row.status === 'late' ? 'text-yellow-500' : (row.status === 'present' || row.status === 'IN_PROGRESS') ? 'text-emerald-500' : 'text-muted-foreground'}`}>{row.checkIn}</p>
                  {row.checkIn !== '—' && (
                    <div title={row.checkInDevice ?? 'Manual'} className="inline-flex items-center gap-1 mt-1 bg-secondary/60 border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                      <Fingerprint className="w-2.5 h-2.5 text-primary shrink-0 opacity-80" />
                      <span className="text-[9px] text-muted-foreground font-bold truncate leading-none pt-px">{row.checkInDevice ?? 'Manual'}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Clock Out</p>
              {row.isMerged && row.subRecords ? (
                <div className="flex flex-col gap-2">
                  {row.subRecords.map((sr, idx) => (
                    <div key={idx}>
                      {sr.isShiftActive ? (
                        <span className="text-blue-500 font-bold text-[10px] uppercase tracking-wider">Active</span>
                      ) : (
                        <p className="font-mono text-muted-foreground font-black text-sm">{sr.checkOut}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : row.notes?.includes('Early punch detected') ? (
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
              {row.isMerged && row.subRecords ? (
                <div className="flex flex-col gap-1">
                  {row.subRecords.map((sr, idx) => {
                    const isComplete = sr.checkIn !== '—' && sr.checkOut !== '—' && sr.checkoutSource !== 'auto_closed';
                    const colorClass = isComplete
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                    const isOtApproved = (sr.approvedOts && sr.approvedOts.length > 0) || (row.approvedOts && row.approvedOts.length > 0);
                    const label = sr.shiftCode ?? sr.shiftName ?? (isOtApproved ? 'OT Approved' : 'No Shift');
                    return (
                      <div key={idx} className="flex flex-col">
                        {onShiftClick && (sr.shiftCode || sr.shiftName || isOtApproved) ? (
                          <button 
                            onClick={() => onShiftClick(sr.shiftName || sr.shiftCode || 'OT Approved', row)}
                            className={`group/shift text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest w-fit transition-all hover:scale-105 active:scale-95 cursor-pointer ${colorClass}`}
                            title={isOtApproved && !sr.shiftCode && !sr.shiftName ? 'Click to go to Manage OT → Live Monitoring' : 'Click to filter and edit'}
                          >
                            <span className="group-hover/shift:hidden">{label}</span>
                            <span className="hidden group-hover/shift:inline">{sr.shiftName ?? sr.shiftCode ?? (isOtApproved ? 'OT Approved' : 'No Shift')}</span>
                          </button>
                        ) : (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest w-fit ${colorClass}`} title={sr.shiftName || sr.shiftCode || undefined}>
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
                    <div className="flex flex-col gap-0.5">
                      {onShiftClick && (row.shiftName || row.shiftCode || isOtApproved) ? (
                        <button 
                          onClick={() => onShiftClick(row.shiftName || row.shiftCode || 'OT Approved', row)}
                          className={`group/shift text-[10px] font-black px-2.5 py-0.5 rounded-md border uppercase tracking-widest w-fit transition-all hover:scale-105 active:scale-95 cursor-pointer ${colorClass}`}
                          title={isOtApproved && !row.shiftName && !row.shiftCode ? 'Click to go to Manage OT → Live Monitoring' : 'Click to filter and edit'}
                        >
                          <span className="group-hover/shift:hidden">{label}</span>
                          <span className="hidden group-hover/shift:inline">{hoverLabel}</span>
                        </button>
                      ) : (
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md border uppercase tracking-widest w-fit ${colorClass}`} title={row.shiftName || row.shiftCode || undefined}>
                          {label}
                        </span>
                      )}
                    </div>
                  );
                }
                return (
                  <span className="text-[10px] text-muted-foreground italic font-medium">No shift</span>
                );
              })()}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Reg Hrs</p>
              <p className="font-mono text-foreground font-black text-sm">
                {row.isShiftActive ? <span className="text-blue-500 text-xs font-bold uppercase tracking-widest">Active</span> : fmtHours(Math.max(0, row.totalHours))}
              </p>
            </div>
          </div>
          {(row.lateMinutes > 0 || (isAllShifts && (row.overtimeMinutes > 0 || (row.approvedOts && row.approvedOts.length > 0))) || row.undertimeMinutes > 0) && (
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
              {row.lateMinutes > 0 && <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">Late {formatLate(row.lateMinutes)}</span>}
              {isAllShifts && (row.overtimeMinutes > 0 || (row.approvedOts && row.approvedOts.length > 0)) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedOTRecordId(expandedOTRecordId === row.id ? null : row.id);
                  }}
                  className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest cursor-pointer hover:bg-emerald-500/20 transition-all"
                  title="Click to view detailed overtime records"
                >
                  OT +{fmtMins(row.overtimeMinutes)}
                </button>
              )}
              {row.undertimeMinutes > 0 && <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">UT -{fmtMins(row.undertimeMinutes)}</span>}
            </div>
          )}
          {expandedOTRecordId === row.id && (
            <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200/60">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" /> Overtime Details
                </p>
                <button
                  onClick={() => setExpandedOTRecordId(null)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                >
                  Close
                </button>
              </div>
              
              {row.approvedOts && row.approvedOts.length > 0 ? (
                <div className="space-y-4">
                  {row.approvedOts.map((ot: any, idx: number) => {
                    const [startH, startM] = ot.startTime.split(':').map(Number);
                    const [endH, endM] = ot.endTime.split(':').map(Number);
                    let diffMins = (endH * 60 + endM) - (startH * 60 + startM);
                    if (diffMins < 0) diffMins += 24 * 60;
                    const approvedHours = (diffMins / 60).toFixed(1);

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

                    const otDateStr = new Date(ot.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: 'UTC'
                    });

                    return (
                      <div key={idx} className="space-y-2.5 pt-2.5 first:pt-0 border-t first:border-t-0 border-slate-200/60">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{otDateStr}</span>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">Approved</span>
                        </div>

                        <div className="space-y-2">
                          {/* Requested Schedule Block */}
                          <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5 space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
                              Requested Schedule
                            </p>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-medium">Requested Start Time</span>
                              <span className="font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">{fmtTime12(ot.startTime)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-medium">Requested End Time</span>
                              <span className="font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">{fmtTime12(ot.endTime)}</span>
                            </div>
                            <div className="pt-1.5 border-t border-slate-200/60 flex justify-between items-center">
                              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">{approvedHours} hrs approved</span>
                            </div>
                          </div>

                          {/* Actual Attendance Block */}
                          <div className="bg-emerald-50/40 rounded-lg border border-emerald-200/50 p-2.5 space-y-1.5">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                              Actual Attendance
                            </p>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-medium">Actual Time In</span>
                              {actualIn ? (
                                <span className="font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">{actualIn}</span>
                              ) : (
                                <span className="font-medium text-slate-400 italic">—</span>
                              )}
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-500 font-medium">Actual Time Out</span>
                              {actualOut ? (
                                <span className="font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">{actualOut}</span>
                              ) : (
                                <span className="font-medium text-slate-400 italic">—</span>
                              )}
                            </div>
                            <div className="pt-1.5 border-t border-emerald-200/40 flex justify-between items-center">
                              {actualHours ? (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-200">{actualHours} hrs rendered</span>
                              ) : (
                                <span className="text-[9px] font-medium text-slate-400 italic">No clock-in/out recorded</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No approved overtime requests found for this day.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
