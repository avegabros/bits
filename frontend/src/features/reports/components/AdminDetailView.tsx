import React from 'react';
import { Download, X as XIcon, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { ReportRow, AttendanceRecord } from '@/types/reports';
import {
    formatShiftTime,
    formatLateHrs,
    formatHrsMins,
} from '@/features/reports/lib/formatters';
import { SortableHeader } from '@/components/ui/SortableHeader';
import type { TableRowData } from '../hooks/useEmployeeModalData';

export interface AdminDetailViewProps {
    employee: ReportRow;
    records: AttendanceRecord[];
    startDate: string;
    endDate: string;
    exportSource: 'admin-panel' | 'hr-panel';
    attendanceRate: number;
    sortedData: TableRowData[];
    sortKeyStr: string | null;
    sortOrder: 'asc' | 'desc' | null;
    handleSort: (key: string) => void;
    onClose: () => void;
    onExport: (employee: ReportRow, records: AttendanceRecord[], expSrc: 'admin-panel' | 'hr-panel') => void;
}

export function AdminDetailView({
    employee,
    records,
    startDate,
    endDate,
    exportSource,
    attendanceRate,
    sortedData,
    sortKeyStr,
    sortOrder,
    handleSort,
    onClose,
    onExport,
}: AdminDetailViewProps) {
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/50">
                {/* Modal Header */}
                <div className="px-6 py-4 bg-white border-b border-slate-200/60 flex justify-between items-center shrink-0 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300" />
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-200/50 flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 text-lg leading-tight tracking-tight uppercase">
                                {employee.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    {employee.department}
                                </p>
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    {employee.branch}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {employee.shift && (
                            <div className="hidden md:flex flex-col items-end mr-4 pr-4 border-r border-slate-100">
                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Active Shift</span>
                                <span className="text-[11px] text-slate-700 font-bold">
                                    {employee.shift.name} ({formatShiftTime(employee.shift.startTime)} – {formatShiftTime(employee.shift.endTime)})
                                </span>
                            </div>
                        )}
                        <button
                            onClick={() => onExport(employee, records, exportSource)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-sm active:scale-95"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export Report
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all duration-200"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Critical Alerts */}
                <div className="shrink-0">
                    {employee.hasAnomaly && (
                        <div className="flex items-start gap-3 px-6 py-3 bg-orange-50 border-b border-orange-100/50">
                            <div className="mt-0.5 p-1 bg-orange-100 rounded-md">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-orange-900 uppercase tracking-tight">Shift Anomaly Detected</p>
                                <p className="text-[11px] text-orange-700/80 mt-0.5 leading-relaxed">
                                    Check-ins recorded more than 4 hours outside assigned shift. Requires manual verification.
                                </p>
                            </div>
                        </div>
                    )}
                    {employee.hasMissingCheckout && (
                        <div className="flex items-start gap-3 px-6 py-3 bg-amber-50 border-b border-amber-100/50">
                            <div className="mt-0.5 p-1 bg-amber-100 rounded-md">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-amber-900 uppercase tracking-tight">Incomplete Attendance Records</p>
                                <p className="text-[11px] text-amber-700/80 mt-0.5 leading-relaxed">
                                    Some entries are missing check-out timestamps. Employee total hours may be under-calculated.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Body */}
                <div className="overflow-y-auto flex-1 min-h-0">
                    {/* Summary Stats Grid */}
                    <div className="bg-slate-50 p-6 border-b border-slate-200/60">
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                            {[
                                {
                                    label: 'Attendance',
                                    value: `${attendanceRate}%`,
                                    sub: `${employee.present}/${employee.totalDays} Days`,
                                    color: attendanceRate >= 90 ? 'text-emerald-600/80' : attendanceRate >= 70 ? 'text-amber-600/80' : 'text-rose-600/80',
                                },
                                {
                                    label: 'Present',
                                    value: employee.present,
                                    color: 'text-emerald-600/80',
                                },
                                {
                                    label: 'Late Hrs',
                                    value: employee.lateMinutes > 0 ? formatLateHrs(employee.lateMinutes) : '0.00',
                                    color: 'text-amber-600/80',
                                },
                                {
                                    label: 'Overtime',
                                    value: employee.overtime > 0 ? formatHrsMins(employee.overtime) : '0:00',
                                    color: 'text-blue-600/80',
                                },
                                {
                                    label: 'Undertime',
                                    value: employee.undertime > 0 ? formatHrsMins(employee.undertime) : '0:00',
                                    color: 'text-rose-600/80',
                                },
                                {
                                    label: 'Regular Hrs',
                                    value: Math.max(0, employee.totalHours - employee.overtime).toFixed(2),
                                    color: 'text-slate-600/90',
                                },
                            ].map((s, i) => (
                                <div key={i} className={`p-4 rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_-3px_rgba(0,0,0,0.07)] flex flex-col items-center justify-center text-center transition-all duration-200 hover:shadow-[0_4px_15px_-3px_rgba(0,0,0,0.1)] hover:border-slate-300`}>
                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1.5">
                                        {s.label}
                                    </span>
                                    <span className={`text-lg font-black font-mono ${s.color}`}>
                                        {s.value}
                                    </span>
                                    {'sub' in s && s.sub && (
                                        <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                                            {s.sub}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Date Range & Legend */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-100/40 border-b border-slate-200/60 sticky top-0 z-20 backdrop-blur-md">
                        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white rounded-full border border-slate-200/80 shadow-sm">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest">
                                {new Date(startDate + 'T00:00:00Z').toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    timeZone: 'UTC',
                                })}
                                <span className="mx-2 text-slate-300">/</span>
                                {new Date(endDate + 'T00:00:00Z').toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    timeZone: 'UTC',
                                })}
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">On Time</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Late / OT</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-rose-300/80" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Absent / UT</span>
                            </div>
                        </div>
                    </div>

                    {/* Daily Attendance Table */}
                    <table className="w-full text-left text-sm bg-white">
                        <thead className="bg-slate-100/70 text-slate-400/80 font-black uppercase text-[9px] tracking-widest border-b border-slate-200/60 sticky top-[57px] z-10 backdrop-blur-md">
                            <tr>
                                <SortableHeader label="Date" sortKey="loopDateStr" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-5 py-3" />
                                <SortableHeader label="Check In" sortKey="checkInVal" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-5 py-3" />
                                <SortableHeader label="Check Out" sortKey="checkOutVal" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-5 py-3" />
                                <SortableHeader label="Reg Hrs" sortKey="workedHrsVal" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-5 py-3" />
                                <SortableHeader label="Late" sortKey="lateMinsVal" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-5 py-3" />
                                <SortableHeader label="OT" sortKey="otMinsVal" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-5 py-3" />
                                <SortableHeader label="UT" sortKey="utMinsVal" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-5 py-3" />
                                <SortableHeader label="Status" sortKey="statusType" currentSortKey={sortKeyStr} currentSortOrder={sortOrder} onSort={handleSort} className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-5 py-16 text-center text-slate-400 font-bold uppercase text-xs tracking-widest"
                                    >
                                        No attendance records found
                                    </td>
                                </tr>
                            ) : (
                                sortedData.map((row) => {
                                    const { loopDate, loopDateStr, record, statusType, missingStatus, isFuture, checkInVal: checkIn, checkOutVal: checkOut, workedHrsVal: hoursWorked, lateMinsVal: lateMins, otMinsVal: otMins, utMinsVal: utMins } = row;

                                    if (!record) {
                                        const statusColor = missingStatus === 'Upcoming' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                            missingStatus === 'Absent' ? 'bg-red-50 text-red-600 border-red-200' :
                                                            'bg-slate-100 text-slate-500 border-slate-200';

                                        return (
                                            <tr key={loopDateStr} className="hover:bg-slate-50/50 transition-colors duration-200">
                                                <td className="px-5 py-3.5">
                                                   <p className="font-bold text-slate-700 text-xs">
                                                      {loopDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                                                   </p>
                                                </td>
                                                <td colSpan={6} className="px-5 py-3.5 text-center">
                                                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                      {isFuture ? 'Scheduled' : 'No Record'}
                                                   </span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                   <span className={`inline-flex items-center justify-center w-28 h-6 rounded-md text-[10px] font-black uppercase tracking-wider border shrink-0 ${statusColor}`}>
                                                      {missingStatus}
                                                   </span>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    const rowBg = statusType === 'anomaly' ? 'bg-orange-50/60 hover:bg-orange-50' : 'hover:bg-slate-50/50';

                                    return (
                                        <tr key={record.id} className={`transition-colors duration-200 ${rowBg}`}>
                                            <td className="px-5 py-3.5">
                                                <p className="font-bold text-slate-700 text-xs">
                                                    {new Date(record.date).toLocaleDateString('en-US', {
                                                        weekday: 'short',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        timeZone: 'UTC',
                                                    })}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700 font-mono">
                                                        {checkIn!.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {record.gracePeriodApplied && (
                                                        <span className="text-[9px] text-slate-400 mt-0.5 font-bold uppercase">Grace Period</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {record.isShiftActive ? (
                                                    <span className="inline-flex items-center gap-2 text-blue-500 font-bold text-[10px] uppercase tracking-wider">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                        </span>
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-700 font-mono">
                                                        {checkOut ? checkOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 font-mono">
                                                {record.isShiftActive ? (
                                                    <span className="text-muted-foreground text-xs italic font-sans uppercase font-bold">Live</span>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-600">
                                                        {hoursWorked > 0 ? `${Math.max(0, hoursWorked - (otMins / 60)).toFixed(2)}` : '—'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 font-mono">
                                                {lateMins > 0 ? (
                                                    <span className="text-xs font-bold text-amber-600">{formatLateHrs(lateMins)}</span>
                                                ) : record.gracePeriodApplied ? (
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">0m (Grace)</span>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 font-mono">
                                                <span className="text-xs font-bold text-blue-600">{otMins > 0 ? formatHrsMins(otMins / 60) : '—'}</span>
                                            </td>
                                            <td className="px-5 py-3.5 font-mono">
                                                <span className="text-xs font-bold text-rose-500">{utMins > 0 ? formatHrsMins(utMins / 60) : '—'}</span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex flex-col items-start gap-1">
                                                {statusType === 'in-progress' ? (
                                                    <span className="inline-flex items-center justify-center w-28 h-6 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100/50 text-slate-400 border border-slate-200 shrink-0">In Progress</span>
                                                ) : statusType === 'early-out' ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="inline-flex items-center justify-center w-28 h-6 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100/70 text-slate-400 border border-slate-200 shrink-0">Early Out</span>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase pl-1">Left early</span>
                                                    </div>
                                                ) : statusType === 'anomaly' ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="inline-flex items-center justify-center w-28 h-6 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-50/20 text-rose-600/60 border border-rose-100 shrink-0"><AlertTriangle className="w-3 h-3 mr-1" />Anomaly</span>
                                                        <span className="text-[8px] font-bold text-rose-400/80 uppercase pl-1">Out of shift</span>
                                                    </div>
                                                ) : statusType === 'missing-checkout' || statusType === 'incomplete' ? (
                                                    <span className="inline-flex items-center justify-center w-28 h-6 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50/30 text-amber-600/70 border border-amber-100 shrink-0">Missing Out</span>
                                                ) : statusType === 'late' ? (
                                                    <span className="inline-flex items-center justify-center w-28 h-6 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50/30 text-amber-600/70 border border-amber-100 shrink-0">Late</span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center w-28 h-6 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50/30 text-emerald-600/70 border border-emerald-100 shrink-0">On Time</span>
                                                )}
                                                {record && (record.checkin_updated || record.checkout_updated) && (
                                                    <span title={record.notes || 'Manually adjusted'} className="inline-flex items-center justify-center w-28 h-5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100/50 text-slate-400/80 border border-slate-200 shrink-0 cursor-help mt-0.5">Edited</span>
                                                )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 shrink-0 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        {records.length} total attendance records
                    </span>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Working Days: <span className="text-slate-900">{employee.totalDays}</span>
                        </span>
                        <div className="h-4 w-px bg-slate-200" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Total Reg Hrs: <span className="text-slate-900">{Math.max(0, employee.totalHours - employee.overtime).toFixed(2)}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
