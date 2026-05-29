import React from 'react'
import { LogIn, LogOut, CalendarDays, Clock, UserCheck, AlertCircle, Sparkles, TrendingUp, Info } from 'lucide-react'
import { useEmployeeDashboard } from '../hooks/useEmployeeDashboard'

export function OverviewDashboard() {
  const { loading, userName, todayRecords, weeklyStats, todayApprovedOts } = useEmployeeDashboard()

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex flex-col gap-6 lg:gap-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-28 bg-slate-100 rounded-3xl border border-slate-200/50"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Today's Status Column */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="h-6 bg-slate-100 rounded w-48"></div>
            <div className="h-60 bg-slate-100 rounded-3xl border border-slate-200/50"></div>
          </div>
          
          {/* Weekly Overview Column */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="h-6 bg-slate-100 rounded w-36"></div>
            <div className="h-[340px] bg-slate-100 rounded-3xl border border-slate-200/50"></div>
          </div>
        </div>
      </div>
    )
  }

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '--:--'
    return new Date(timeStr).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
  }

  const formatTimeString = (hhmm?: string | null) => {
    if (!hhmm) return '--:--'
    const [h, m] = hhmm.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const displayH = h % 12 || 12
    const displayM = m.toString().padStart(2, '0')
    return `${displayH}:${displayM} ${ampm}`
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 lg:gap-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-600/10 via-rose-500/5 to-transparent border border-red-500/10 rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm overflow-hidden relative">
        {/* Abstract background mesh effect */}
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-red-500/10 p-3.5 rounded-2xl border border-red-500/20 shrink-0">
            <Sparkles className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Hello, {userName}!
            </h1>
            <p className="text-slate-500 font-medium mt-1 flex items-center gap-1.5 text-sm">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              {new Date().toLocaleDateString('en-PH', {
                timeZone: 'Asia/Manila',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 relative z-10 shrink-0 bg-white/80 backdrop-blur-sm border border-slate-100 p-2 rounded-2xl shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ml-2" />
          <span className="text-xs font-bold text-slate-600 pr-2">System Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Today's Shift Status Column - occupies 7 cols */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-600" /> Today's Shift Status
            </h2>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {todayRecords.length} Shift{todayRecords.length !== 1 ? 's' : ''} Today
            </span>
          </div>

          {todayRecords.length === 0 ? (
            <div className="flex flex-col gap-6">
              <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center gap-3 text-center min-h-[220px]">
                <div className="bg-slate-50 p-4 rounded-full border border-slate-100">
                  <Clock className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-bold">No active shifts scheduled for today</p>
                <p className="text-slate-400 text-xs max-w-xs">
                  {todayApprovedOts.length > 0
                    ? 'However, you have approved overtime scheduled below.'
                    : 'Your schedule is clear. If you think this is an error, please contact HR.'}
                </p>
              </div>

              {todayApprovedOts.length > 0 && (
                <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100/80 shadow-sm p-6 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Approved Overtime Schedule</span>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100/50 rounded-full text-[10px] font-black uppercase tracking-wider">
                      Approved
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {todayApprovedOts.map((ot: any, idx: number) => (
                      <div key={ot.id || idx} className="bg-emerald-500/[0.02] border border-emerald-500/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                            <Clock className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800">
                              Overtime Request
                            </p>
                            <p className="text-xs text-slate-400 font-medium">
                              Date: {new Date(ot.date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col sm:text-right">
                          <span className="text-sm font-black text-slate-800">
                            Time-in: {formatTimeString(ot.startTime)}
                          </span>
                          <span className="text-sm font-black text-slate-800">
                            Time-out: {formatTimeString(ot.endTime)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {todayRecords.map((record, index) => {
                const isLate = record.status.toLowerCase() === 'late';
                const isRestDay = record.status.toLowerCase() === 'rest_day';
                const isInProgress = record.status.toLowerCase() === 'in_progress';
                const isAbsent = record.status.toLowerCase() === 'absent';
                
                let statusColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100/50';
                let dotColorClass = 'bg-emerald-500';
                if (isLate) {
                  statusColorClass = 'bg-amber-50 text-amber-700 border-amber-100/50';
                  dotColorClass = 'bg-amber-500';
                } else if (isRestDay) {
                  statusColorClass = 'bg-slate-50 text-slate-500 border-slate-100';
                  dotColorClass = 'bg-slate-400';
                } else if (isInProgress) {
                  statusColorClass = 'bg-blue-50 text-blue-700 border-blue-100/50';
                  dotColorClass = 'bg-blue-500';
                } else if (isAbsent) {
                  statusColorClass = 'bg-rose-50 text-rose-700 border-rose-100/50';
                  dotColorClass = 'bg-rose-500';
                }

                return (
                  <div key={record.id} className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100/80 shadow-sm p-6 relative overflow-hidden group">
                    {/* Accent top gradient indicator based on index */}
                    <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${index === 0 ? 'from-red-500 to-rose-500' : 'from-amber-500 to-orange-500'}`} />
                    
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Shift</span>
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200/50 rounded-xl text-xs font-black uppercase tracking-wider">
                          {record.shiftName || record.shiftCode || 'Standard'}
                        </span>
                      </div>
                      
                      <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${statusColorClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColorClass} ${isInProgress ? 'animate-ping' : ''}`} />
                        {isInProgress ? 'Active Session' : record.status === 'REST_DAY' ? 'Rest Day' : record.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-emerald-500/[0.03] border border-emerald-500/10 hover:bg-emerald-500/[0.06] transition-colors rounded-2xl p-4 flex flex-col relative overflow-hidden group/item">
                        <div className="absolute right-3 top-3 opacity-10 group-hover/item:opacity-20 transition-opacity">
                          <LogIn className="w-12 h-12 text-emerald-600" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                          <LogIn className="w-3.5 h-3.5" /> Check-in
                        </span>
                        <span className="text-2xl font-black text-slate-800 tracking-tight">
                          {formatTime(record.checkInTime)}
                        </span>
                      </div>
                      
                      <div className="bg-amber-500/[0.03] border border-amber-500/10 hover:bg-amber-500/[0.06] transition-colors rounded-2xl p-4 flex flex-col relative overflow-hidden group/item">
                        <div className="absolute right-3 top-3 opacity-10 group-hover/item:opacity-20 transition-opacity">
                          <LogOut className="w-12 h-12 text-amber-600" />
                        </div>
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                          <LogOut className="w-3.5 h-3.5" /> Check-out
                        </span>
                        <span className="text-2xl font-black text-slate-800 tracking-tight">
                          {formatTime(record.checkOutTime)}
                        </span>
                        {!record.checkOutTime && (
                          <div className="flex flex-col gap-1 mt-1.5">
                            {record.minCheckoutTime && (
                              <span className="text-[10px] text-amber-600/80 font-bold flex items-center gap-1">
                                <Info className="w-3.5 h-3.5 shrink-0" /> Earliest checkout (biometrics): {formatTime(record.minCheckoutTime)}
                              </span>
                            )}
                            {record.shift?.endTime && (
                              <span className="text-[10px] text-indigo-600/80 font-bold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 shrink-0" /> Minimum checkout (shift end): {formatTimeString(record.shift.endTime)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {record.approvedOts && record.approvedOts.length > 0 && (
                      <div className="mt-6 border-t border-slate-100 pt-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Approved Overtime</span>
                        <div className="flex flex-col gap-2">
                          {record.approvedOts.map((ot: any, idx: number) => (
                            <div key={ot.id || idx} className="bg-emerald-500/[0.02] border border-emerald-500/10 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                                  <Clock className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-slate-700 block">
                                    Time-in: {formatTimeString(ot.startTime)}
                                  </span>
                                  <span className="text-xs font-bold text-slate-700 block">
                                    Time-out: {formatTimeString(ot.endTime)}
                                  </span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[9px] font-black uppercase tracking-wider">
                                Approved
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Weekly Performance Column - occupies 5 cols */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-600" /> Weekly Overview
          </h2>
          
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100/80 shadow-md p-6 flex flex-col gap-4 relative overflow-hidden">
            {/* Decorative corner indicator */}
            <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-bl-3xl pointer-events-none" />

            <div className="flex items-center gap-3 mb-2">
              <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20">
                <UserCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Attendance Summary</h3>
                <p className="text-xs text-slate-400">Current calendar week progress</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Days Present Card */}
              <div className="bg-gradient-to-br from-emerald-500/[0.02] to-emerald-500/[0.08] border border-emerald-500/10 rounded-2xl p-4 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 transition-transform">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest">Days Present</span>
                    <span className="text-xs text-slate-400 font-medium">Recorded logs</span>
                  </div>
                </div>
                <span className="text-3xl font-black text-emerald-600 tracking-tight">{weeklyStats.present}</span>
              </div>

              {/* Days Late Card */}
              <div className="bg-gradient-to-br from-amber-500/[0.02] to-amber-500/[0.08] border border-amber-500/10 rounded-2xl p-4 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 transition-transform">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-amber-600 uppercase tracking-widest">Days Late</span>
                    <span className="text-xs text-slate-400 font-medium">Exceeded shift start</span>
                  </div>
                </div>
                <span className="text-3xl font-black text-amber-500 tracking-tight">{weeklyStats.late}</span>
              </div>

              {/* Total Hours Card */}
              <div className="bg-gradient-to-br from-indigo-500/[0.02] to-indigo-500/[0.08] border border-indigo-500/10 rounded-2xl p-4 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/20 transition-transform">
                    <Clock className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest">Total Hours</span>
                    <span className="text-xs text-slate-400 font-medium">Break-aware sum</span>
                  </div>
                </div>
                <span className="text-3xl font-black text-indigo-600 tracking-tight">{weeklyStats.totalHours}<span className="text-sm font-bold text-indigo-400 ml-0.5">h</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
