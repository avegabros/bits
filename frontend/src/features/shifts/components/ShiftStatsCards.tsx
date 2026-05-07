import { Clock, Shield, Users } from 'lucide-react'
import type { Shift } from '../types'

interface ShiftStatsCardsProps {
  shifts: Shift[]
  activeCount: number
}

export function ShiftStatsCards({ shifts, activeCount }: ShiftStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium">Total Shifts</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{shifts.length}</p>
          <p className="text-xs text-slate-400 mt-1">Configured schedules</p>
        </div>
        <div className="p-2.5 rounded-lg bg-red-50"><Clock className="w-5 h-5 text-red-600" /></div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium">Active Shifts</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{activeCount}</p>
          <p className="text-xs text-slate-400 mt-1">Currently in use</p>
        </div>
        <div className="p-2.5 rounded-lg bg-emerald-50"><Shield className="w-5 h-5 text-emerald-600" /></div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium">Total Assigned</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{shifts.reduce((a, s) => a + s._count.Employee, 0)}</p>
          <p className="text-xs text-slate-400 mt-1">Employees on shifts</p>
        </div>
        <div className="p-2.5 rounded-lg bg-blue-50"><Users className="w-5 h-5 text-blue-600" /></div>
      </div>
    </div>
  )
}
