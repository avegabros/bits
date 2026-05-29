import React, { useState, useMemo, useEffect } from 'react'
import { CalendarDays, Clock } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import { useEmployeeAttendance } from '../hooks/useEmployeeAttendance'
import { OvertimeRequestModal } from './OvertimeRequestModal'
import { useAuth } from '@/hooks/useAuth'

export function AttendanceDashboard() {
  const {
    loading,
    records,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    handleApplyFilter,
    paginatedRecords
  } = useEmployeeAttendance()

  const { employee } = useAuth()
  const [isOTModalOpen, setIsOTModalOpen] = useState(false)
  const [expandedOTRecordId, setExpandedOTRecordId] = useState<number | null>(null)

  // ── Shift filter (Employee Portal) ────────────────────────────────────────
  // Employees only see their own shifts — no "All Shifts" option.
  // Defaults to the first (primary) shift detected.
  const uniqueShifts = useMemo(() => {
    const seen = new Set<string>()
    for (const r of records) {
      const label = r.shiftName ?? r.shiftCode ?? null
      if (label) seen.add(label)
    }
    return Array.from(seen).sort()
  }, [records])

  const [shiftFilter, setShiftFilter] = useState<string>('ALL')

  // Reset page to 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [shiftFilter, setCurrentPage])

  // Filtered records based on selected shift (when multiple shifts exist)
  const allFilteredRecords = useMemo(() => {
    if (uniqueShifts.length <= 1 || !shiftFilter || shiftFilter === 'ALL') return records
    return records.filter(r => {
      const label = r.shiftName ?? r.shiftCode ?? null
      return label === shiftFilter
    })
  }, [records, shiftFilter, uniqueShifts])

  const filteredRecords = useMemo(() => {
    return allFilteredRecords.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
  }, [allFilteredRecords, currentPage, rowsPerPage])

  // Total record count for pagination — filter from full set when shift filter active
  const filteredTotal = allFilteredRecords.length

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '--:--'
    return new Date(timeStr).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
  }

  /** Display the backend-computed totalHours (break-aware) instead of raw checkOut−checkIn */
  const formatWorkedHours = (totalHours?: number | null) => {
    if (totalHours == null || totalHours <= 0) return '--'
    const h = Math.floor(totalHours)
    const m = Math.round((totalHours - h) * 60)
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  const fmtMins = (mins: number | null | undefined): string => {
    if (!mins || mins <= 0) return '—'
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-red-600" /> My Attendance
          </h1>
          <p className="text-slate-500 text-sm mt-1">View your personal attendance history</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsOTModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm shadow-emerald-600/20 transition-all active:scale-[0.98]"
          >
            <Clock className="w-4 h-4" /> Request OT
          </button>
        </div>

        {/* Date Filter + Shift Selector */}
        <div className="flex items-end gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex-wrap">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">From</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-red-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">To</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-red-500 transition-colors"
            />
          </div>
          {/* Shift filter — only shows when the employee has multiple shifts */}
          {uniqueShifts.length > 1 && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Shift</label>
              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger className="w-40 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-bold" id="employee-shift-filter">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <SelectValue placeholder="Shift" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Shifts</SelectItem>
                  {uniqueShifts.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 h-96 flex items-center justify-center animate-pulse">
           <div className="text-slate-400 font-bold">Loading records...</div>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 h-64 flex flex-col items-center justify-center gap-3">
          <CalendarDays className="w-12 h-12 text-slate-200" />
          <p className="text-slate-500 font-semibold">No attendance records found for this period</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div
            className="overflow-x-auto scrollbar-table"
            tabIndex={0}
            role="region"
            aria-label="My attendance records — scroll horizontally"
          >
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-black">Date</th>
                  <th className="px-6 py-4 font-black">Shift</th>
                  <th className="px-6 py-4 font-black">Check In</th>
                  <th className="px-6 py-4 font-black">Check Out</th>
                  <th className="px-6 py-4 font-black">Total Time</th>
                  <th className="px-6 py-4 font-black text-emerald-600">OT</th>
                  <th className="px-6 py-4 font-black text-red-500">UT</th>
                  <th className="px-6 py-4 font-black">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">
                          {new Date(r.date || r.checkInTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(r.date || r.checkInTime).toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {r.shiftName || (r.approvedOts && r.approvedOts.length > 0) ? (
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${
                            r.shiftName
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}>
                            {r.shiftName ?? 'OT Approved'}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600">{formatTime(r.checkInTime)}</td>
                      <td className="px-6 py-4 font-mono text-slate-600">{formatTime(r.checkOutTime)}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {formatWorkedHours(r.totalHours)}
                      </td>
                      <td
                        onClick={(e) => {
                          e.stopPropagation();
                          if ((r.overtimeMinutes && r.overtimeMinutes > 0) || (r.approvedOts && r.approvedOts.length > 0)) {
                            setExpandedOTRecordId(expandedOTRecordId === r.id ? null : r.id);
                          }
                        }}
                        className={`px-6 py-4 ${
                          ((r.overtimeMinutes && r.overtimeMinutes > 0) || (r.approvedOts && r.approvedOts.length > 0))
                            ? 'cursor-pointer hover:bg-emerald-500/10 transition-colors select-none'
                            : ''
                        }`}
                        title={
                          ((r.overtimeMinutes && r.overtimeMinutes > 0) || (r.approvedOts && r.approvedOts.length > 0))
                            ? "Click to view detailed overtime records"
                            : undefined
                        }
                      >
                        <span className={`text-sm font-bold ${((r.overtimeMinutes && r.overtimeMinutes > 0) || (r.approvedOts && r.approvedOts.length > 0)) ? 'text-emerald-600' : 'text-slate-300'}`}>
                          {r.overtimeMinutes && r.overtimeMinutes > 0 ? `+${fmtMins(r.overtimeMinutes)}` : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${r.undertimeMinutes && r.undertimeMinutes > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                          {r.undertimeMinutes && r.undertimeMinutes > 0 ? `-${fmtMins(r.undertimeMinutes)}` : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            r.status.toLowerCase() === 'late' 
                              ? 'bg-amber-100 text-amber-700' 
                              : r.status.toLowerCase() === 'absent'
                                ? 'bg-rose-100 text-rose-700'
                                : r.status.toLowerCase() === 'rest_day'
                                  ? 'bg-slate-100 text-slate-500'
                                  : r.status.toLowerCase() === 'in_progress'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {r.status === 'IN_PROGRESS' ? 'In Progress' : r.status.toLowerCase() === 'rest_day' ? 'Rest Day' : r.status}
                          </span>
                          {r.isEdited && (
                            <span 
                              title={r.notes || 'Manually adjusted'}
                              className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-violet-50 text-violet-600 border border-violet-100 cursor-help"
                            >
                              Edited
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedOTRecordId === r.id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={8} className="px-6 py-4 border-b border-slate-100">
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
                            
                            {r.approvedOts && r.approvedOts.length > 0 ? (
                              <div className="divide-y divide-slate-100">
                                {r.approvedOts.map((ot: any, idx: number) => {
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
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DataTablePagination
        currentPage={currentPage}
        totalPages={Math.ceil(filteredTotal / rowsPerPage)}
        onPageChange={setCurrentPage}
        totalCount={filteredTotal}
        pageSize={rowsPerPage}
        entityName="records"
        loading={loading}
      />

      {employee?.id && (
        <OvertimeRequestModal 
          isOpen={isOTModalOpen} 
          onClose={() => setIsOTModalOpen(false)} 
          employeeId={employee.id} 
        />
      )}
    </div>
  )
}
