import React from 'react'
import { Card } from '@/components/ui/card'
import { Users, Shield, UserCog } from 'lucide-react'
import { UserAccount } from '../utils/user-types'

interface UserAccountStatsProps {
  users: UserAccount[]
}

export function UserAccountStats({ users }: UserAccountStatsProps) {
  const totalUsers = users.length
  const adminCount = users.filter(u => u.role === 'ADMIN').length
  const hrCount = users.filter(u => u.role === 'HR').length
  const managerCount = users.filter(u => u.role === 'MANAGER').length

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <Card className="bg-white border-slate-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400 font-medium">Total Users</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{totalUsers}</p>
            <p className="text-xs text-slate-400 mt-1">Registered accounts</p>
          </div>
          <div className="p-2.5 rounded-lg bg-red-50">
            <Users className="w-5 h-5 text-red-600" />
          </div>
        </div>
      </Card>
      <Card className="bg-white border-slate-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400 font-medium">Administrators</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{adminCount}</p>
            <p className="text-xs text-slate-400 mt-1">Admin role accounts</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
        </div>
      </Card>
      <Card className="bg-white border-slate-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400 font-medium">Managers</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{managerCount}</p>
            <p className="text-xs text-slate-400 mt-1">Manager role accounts</p>
          </div>
          <div className="p-2.5 rounded-lg bg-purple-50">
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
        </div>
      </Card>
      <Card className="bg-white border-slate-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400 font-medium">HR Users</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{hrCount}</p>
            <p className="text-xs text-slate-400 mt-1">HR role accounts</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50">
            <UserCog className="w-5 h-5 text-emerald-600" />
          </div>
        </div>
      </Card>
    </div>
  )
}
