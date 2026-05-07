import React from 'react'
import { Clock, Sun, Moon } from 'lucide-react'
import { useEmployeeShift } from '../hooks/useEmployeeShift'

export function ShiftDetailsDashboard() {
  const { loading, shift } = useEmployeeShift()

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse flex flex-col gap-6">
        <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
        <div className="h-64 bg-gray-200 rounded-2xl w-full"></div>
      </div>
    )
  }

  if (!shift) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-4 bg-white border border-slate-200 rounded-2xl p-12 mt-8">
        <Clock className="w-16 h-16 text-slate-200" />
        <h2 className="text-xl font-bold text-slate-700">No Shift Assigned</h2>
        <p className="text-slate-500 text-center">You currently do not have a shift assigned to your profile.<br/>Please contact HR for assistance.</p>
      </div>
    )
  }

  const workDaysArray = (() => {
    try { return JSON.parse(shift.workDays) }
    catch { return [] }
  })()

  const formatTime = (time: string) => {
    if (!time) return ''
    const [h, m] = time.split(':')
    const hr = parseInt(h, 10)
    const ampm = hr >= 12 ? 'PM' : 'AM'
    const hr12 = hr % 12 || 12
    return `${hr12}:${m} ${ampm}`
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Clock className="w-6 h-6 text-red-600" /> My Shift Details
        </h1>
        <p className="text-slate-500 text-sm mt-1">Information about your current work schedule</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
        <div className={`absolute top-0 left-0 w-full h-2 ${shift.isNightShift ? 'bg-indigo-600' : 'bg-amber-400'}`} />
        
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between mb-8 pb-8 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-black text-slate-900">{shift.name}</h2>
                <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                  shift.isNightShift ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                } flex items-center gap-1.5`}>
                  {shift.isNightShift ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                  {shift.isNightShift ? 'Night Shift' : 'Day Shift'}
                </span>
              </div>
              <p className="text-slate-500 font-mono text-sm">Code: {shift.shiftCode}</p>
              {shift.description && (
                <p className="text-slate-600 mt-2 text-sm">{shift.description}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
             {/* Timeline / Hours */}
             <div>
               <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Work Hours</h3>
               <div className="flex flex-col gap-6 relative">
                 <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-slate-100" />
                 
                 <div className="relative flex items-center gap-4">
                   <div className="w-6 h-6 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center shrink-0 z-10 shadow-sm" />
                   <div>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Start Time</p>
                     <p className="text-2xl font-black text-slate-800">{formatTime(shift.startTime)}</p>
                   </div>
                 </div>

                 <div className="relative flex items-center gap-4">
                   <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center shrink-0 z-10 shadow-sm" />
                   <div>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex gap-2 items-center">
                        Break Duration <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px]">{shift.breakMinutes} mins</span>
                     </p>
                   </div>
                 </div>

                 <div className="relative flex items-center gap-4">
                   <div className="w-6 h-6 rounded-full bg-rose-100 border-2 border-white flex items-center justify-center shrink-0 z-10 shadow-sm" />
                   <div>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">End Time</p>
                     <p className="text-2xl font-black text-slate-800">{formatTime(shift.endTime)}</p>
                   </div>
                 </div>
               </div>
             </div>

             {/* Details & Days */}
             <div className="flex flex-col gap-8">
               <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Work Days</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => {
                      const isWorkDay = workDaysArray.includes(day)
                      return (
                        <div key={day} className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold border ${
                          isWorkDay 
                            ? 'bg-red-50 border-red-200 text-red-600' 
                            : 'bg-slate-50 border-slate-100 text-slate-400 opacity-50'
                        }`}>
                          {day}
                        </div>
                      )
                    })}
                  </div>
               </div>

               <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Allowances</h3>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-4">
                     <Clock className="w-8 h-8 text-amber-500 opacity-80" />
                     <div>
                       <p className="font-bold text-slate-800 text-lg">{shift.graceMinutes} minutes</p>
                       <p className="text-xs text-slate-500">Late Grace Period</p>
                     </div>
                  </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
