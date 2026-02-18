'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Building2,
  FileText,
  CalendarDays
} from 'lucide-react'
import {
  employees,
  getEmployeeStats,
  getAttendanceStats,
  getDepartmentBreakdown,
  getWeeklyTrend,
  getRecentActivity
} from '@/lib/mock-data'

// Pre-compute all data from shared source
const empStats = getEmployeeStats()
const attStats = getAttendanceStats()
const deptBreakdown = getDepartmentBreakdown()
const weeklyTrend = getWeeklyTrend()
const recentActivity = getRecentActivity()
const attendanceRate = employees.length > 0
  ? Math.round(((attStats.totalPresent + attStats.totalLate) / employees.length) * 100)
  : 0

export default function Dashboard() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = typeof window !== 'undefined' && localStorage.getItem('token')
    const employee = typeof window !== 'undefined' && localStorage.getItem('employee')
    if (!token || !employee) {
      router.replace('/login')
    } else {
      setIsLoading(false)
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-full animate-spin mb-4">
            <div className="w-8 h-8 bg-background rounded-full"></div>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Color palette for department bars
  const deptColors: Record<string, string> = {
    Engineering: '#6366f1',
    Design: '#f472b6',
    HR: '#34d399',
    Finance: '#fbbf24',
    Marketing: '#60a5fa',
    Operations: '#a78bfa',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground text-sm mt-1">Welcome to BITS Admin Panel — here&apos;s today&apos;s overview</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto" onClick={() => router.push('/admin/reports')}>
          <FileText className="w-4 h-4" />
          Generate Report
        </Button>
      </div>

      {/* ─── Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Employees */}
        <Card className="bg-card border-border p-4 sm:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Total Employees</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{empStats.total}</p>
              <p className="text-xs text-green-400 mt-1">{empStats.active} active</p>
            </div>
            <div className="bg-primary/20 p-2 sm:p-3 rounded-lg">
              <Users className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
            </div>
          </div>
        </Card>

        {/* Present Today */}
        <Card className="bg-card border-border p-4 sm:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Present Today</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{attStats.totalPresent}</p>
              <p className="text-xs text-muted-foreground mt-1">{attendanceRate}% rate</p>
            </div>
            <div className="bg-green-500/20 p-2 sm:p-3 rounded-lg">
              <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-green-400" />
            </div>
          </div>
        </Card>

        {/* Late */}
        <Card className="bg-card border-border p-4 sm:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Late</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{attStats.totalLate}</p>
              <p className="text-xs text-yellow-400 mt-1">+{attStats.totalOvertime}h overtime</p>
            </div>
            <div className="bg-yellow-500/20 p-2 sm:p-3 rounded-lg">
              <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-400" />
            </div>
          </div>
        </Card>

        {/* Absent */}
        <Card className="bg-card border-border p-4 sm:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Absent</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{attStats.totalAbsent}</p>
              <p className="text-xs text-red-400 mt-1">{attStats.totalUndertime}h undertime</p>
            </div>
            <div className="bg-red-500/20 p-2 sm:p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 sm:w-6 sm:h-6 text-red-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Two-Column: Chart + Department Breakdown ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Weekly Attendance Chart — takes 3/5 width */}
        <Card className="lg:col-span-3 bg-card border-border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-foreground">Weekly Attendance</h3>
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs">This Week</Badge>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weeklyTrend} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(22, 28, 45, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
              />
              <Bar dataKey="present" fill="#34d399" radius={[4, 4, 0, 0]} name="Present" />
              <Bar dataKey="late" fill="#fbbf24" radius={[4, 4, 0, 0]} name="Late" />
              <Bar dataKey="absent" fill="#f87171" radius={[4, 4, 0, 0]} name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Department Breakdown — takes 2/5 width */}
        <Card className="lg:col-span-2 bg-card border-border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-foreground">Departments</h3>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {deptBreakdown.map(dept => (
              <div key={dept.department}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-foreground font-medium truncate">{dept.department}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{dept.employeeCount} emp</span>
                    <Badge
                      variant="outline"
                      className={
                        dept.attendanceRate >= 80
                          ? 'bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5'
                          : dept.attendanceRate >= 50
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5'
                            : 'bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5'
                      }
                    >
                      {dept.attendanceRate}%
                    </Badge>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${dept.attendanceRate}%`,
                      backgroundColor: deptColors[dept.department] || '#6366f1',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ─── Recent Activity ──────────────────────────────── */}
      <Card className="bg-card border-border overflow-hidden rounded-2xl shadow-lg">
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-secondary/20 flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">Recent Activity</h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:bg-primary/10 gap-1 text-xs"
            onClick={() => router.push('/attendance')}
          >
            View All <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Employee</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Department</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Time</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentActivity.slice(0, 5).map((activity, index) => (
                <tr
                  key={activity.id}
                  className={`hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-secondary/10'}`}
                >
                  <td className="px-4 sm:px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {activity.employee.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground block truncate">{activity.employee}</span>
                        <span className="text-xs text-muted-foreground sm:hidden">{activity.department}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-3 hidden sm:table-cell">
                    <Badge variant="outline" className="bg-secondary/50 text-foreground border-border text-xs">
                      {activity.department}
                    </Badge>
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-sm text-foreground">{activity.action}</td>
                  <td className="px-4 sm:px-6 py-3 text-sm text-muted-foreground font-mono hidden md:table-cell">{activity.time}</td>
                  <td className="px-4 sm:px-6 py-3">
                    <Badge
                      variant="outline"
                      className={
                        activity.status === 'on-time'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : activity.status === 'late'
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }
                    >
                      {activity.status === 'on-time' ? 'On Time' : activity.status === 'late' ? 'Late' : 'Absent'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Quick Actions ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card
          className="bg-card border-border p-4 sm:p-5 hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer group"
          onClick={() => router.push('/employees')}
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2.5 rounded-lg group-hover:bg-primary/30 transition-colors">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Employees</p>
              <p className="text-xs text-muted-foreground truncate">Manage {empStats.total} employees</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Card>

        <Card
          className="bg-card border-border p-4 sm:p-5 hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer group"
          onClick={() => router.push('/attendance')}
        >
          <div className="flex items-center gap-3">
            <div className="bg-green-500/20 p-2.5 rounded-lg group-hover:bg-green-500/30 transition-colors">
              <CalendarDays className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Attendance</p>
              <p className="text-xs text-muted-foreground truncate">Today: {attStats.totalPresent + attStats.totalLate} checked in</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-green-400 transition-colors" />
          </div>
        </Card>

        <Card
          className="bg-card border-border p-4 sm:p-5 hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer group"
          onClick={() => router.push('/admin/reports')}
        >
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/20 p-2.5 rounded-lg group-hover:bg-yellow-500/30 transition-colors">
              <FileText className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Reports</p>
              <p className="text-xs text-muted-foreground truncate">Generate & export reports</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-yellow-400 transition-colors" />
          </div>
        </Card>
      </div>
    </div>
  )
}
