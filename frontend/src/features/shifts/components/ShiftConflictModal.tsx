import { AlertTriangle, Users, Clock, XIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { ShiftConflictReport } from '../types'

interface ShiftConflictModalProps {
  isOpen: boolean
  report: ShiftConflictReport | null
  onClose: () => void
}

export function ShiftConflictModal({ isOpen, report, onClose }: ShiftConflictModalProps) {
  if (!report) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="bg-white/90 backdrop-blur-2xl border border-white/40 max-w-lg p-0 gap-0 flex flex-col rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-black/5">
        
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 flex items-start justify-between shrink-0 bg-red-50/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-[10px] font-bold uppercase tracking-wider">Update Blocked</p>
            </div>
            <DialogTitle className="text-slate-900 font-poppins font-bold text-2xl tracking-tight">
              Scheduling Conflicts
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-medium tracking-wide flex items-center gap-1.5 mt-2">
              <Users size={14} />
              {report.affectedEmployeeCount} employee{report.affectedEmployeeCount !== 1 ? 's' : ''} would have scheduling issues.
            </DialogDescription>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full bg-slate-100/80 text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 transition-all active:scale-90 shadow-sm ring-1 ring-black/5"
          >
            <XIcon className="w-5 h-5" />
          </button>
          
          <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-200 to-transparent" />
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-4 max-h-[50vh] overflow-y-auto scrollbar-light">
          
          {report.hasAttendanceRecords && (
            <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-800">Historical Attendance Warning</p>
                <p className="text-[11px] font-medium text-amber-700/80">
                  Before you resolve these conflicts and save, please ensure you export the Attendance Reports first to avoid corrupting existing attendance records linked to this shift.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Affected Employees</label>
            
            <div className="space-y-3">
              {report.conflicts.map((conflict, i) => (
                <div key={`${conflict.employeeId}-${i}`} className="p-4 bg-white border border-red-100 rounded-2xl shadow-sm hover:border-red-200 transition-colors animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-slate-800">{conflict.employeeName}</p>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {conflict.commonDays.map(day => (
                        <span key={day} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold">
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 p-3 bg-red-50/50 rounded-xl border border-red-50/80">
                    <div className="flex items-start gap-2">
                      <Clock size={14} className="text-red-400 mt-0.5 shrink-0" />
                      <p className="text-xs font-medium text-red-900 leading-snug">
                        {conflict.reason === 'overlap' ? (
                          <>Overlaps with <span className="font-bold">{conflict.conflictingShiftName}</span> ({conflict.conflictingShiftTime})</>
                        ) : (
                          <>Insufficient gap with <span className="font-bold">{conflict.conflictingShiftName}</span></>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pl-5 text-[11px] font-semibold text-red-700/70">
                      <span>Edited shift: {conflict.editedShiftTime}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 px-8 py-6 bg-slate-50/50 backdrop-blur-md border-t border-slate-100 shrink-0">
          <p className="flex-1 text-[11px] font-medium text-slate-400">
            Please resolve these schedule conflicts before updating the shift.
          </p>
          <button 
            onClick={onClose} 
            className="px-6 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-[0.98]"
          >
            Go Back
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
