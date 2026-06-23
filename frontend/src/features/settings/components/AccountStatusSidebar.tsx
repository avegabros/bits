import { Shield } from 'lucide-react'
import type { UserData } from '../types'

interface AccountStatusSidebarProps {
  userData: UserData
  displayName: string
  role: 'admin' | 'hr' | 'manager'
}

export function AccountStatusSidebar({ userData, displayName, role }: AccountStatusSidebarProps) {
  const permissions = role === 'admin'
    ? [
        'System Administration',
        'User Account Management',
        'Device & Sync Control',
        'Employee Management',
        'Attendance & Overtime Control',
        'Report Generation'
      ]
    : role === 'manager'
    ? [
        'Department Employee View',
        'Adjustment Request Approvals',
        'Overtime Assignment & Control',
        'Shifts & Holidays View'
      ]
    : [
        'Employee Management',
        'Attendance Correction',
        'Shift & Holiday Management',
        'Organization Management',
        'Overtime Monitoring',
        'Report Generation'
      ]

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-8 text-white rounded-3xl shadow-sm">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Shield size={16} className="text-red-500" /> Account Status
        </h3>
        <div className="space-y-4">
          <div className="pb-4 border-b border-white/10">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Signed In As</p>
            <p className="text-sm font-black text-white mt-1">{displayName}</p>
            <p className="text-xs text-slate-500 mt-0.5">{userData.email}</p>
          </div>
          <div className="pb-4 border-b border-white/10">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Account Role</p>
            <p className="text-sm font-black text-red-500 uppercase tracking-tighter">
              {role === 'admin' ? 'Administrator' : role === 'manager' ? 'Manager' : userData.role === 'HR' ? 'HR Personnel' : userData.role || 'HR'}
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Permissions</p>
            {permissions.map((perm) => (
              <div key={perm} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {perm}
              </div>
            ))}
          </div>
          {userData.branch && (
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Branch</p>
              <p className="text-sm font-medium">{userData.branch}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
