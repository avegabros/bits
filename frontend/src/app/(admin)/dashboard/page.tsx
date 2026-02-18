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

interface EmpStats {
  total: number;
  active: number;
}

interface AttStats {
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  totalOvertime: number;
  totalUndertime: number;
}

interface DeptBreakdown {
  department: string;
  employeeCount: number;
  attendanceRate: number;
}

interface WeeklyDay {
  day: string;
  present: number;
  late: number;
  absent: number;
}

interface RecentAct {
  id: number;
  employee: string;
  department: string;
  action: string;
  time: string;
  status: string;
}

export default function Dashboard() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [empStats, setEmpStats] = useState<EmpStats>({ total: 0, active: 0 })
  const [attStats, setAttStats] = useState<AttStats>({ totalPresent: 0, totalLate: 0, totalAbsent: 0, totalOvertime: 0, totalUndertime: 0 })
  const [deptBreakdown, setDeptBreakdown] = useState<DeptBreakdown[]>([])
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyDay[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentAct[]>([])
  const [attendanceRate, setAttendanceRate] = useState(0)

  useEffect(() => {
    const token = typeof window !== 'undefined' && localStorage.getItem('token')
    const employee = typeof window !== 'undefined' && localStorage.getItem('employee')
    if (!token || !employee) {
      router.replace('/login')
    } else {
      fetchDashboardData()
    }
  }, [router])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const today = new Date()
      const offset = today.getTimezoneOffset()
      const localDate = new Date(today.getTime() - (offset * 60 * 1000))
      const todayStr = localDate.toISOString().split('T')[0]

      // Get start of week (Monday)
      const dayOfWeek = localDate.getDay()
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(localDate)
      monday.setDate(monday.getDate() - mondayOffset)
      const mondayStr = monday.toISOString().split('T')[0]

      // Fetch employees and this week's attendance in parallel
      const [empRes, attRes] = await Promise.all([
        fetch('/api/employees', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/attendance?startDate=${mondayStr}&endDate=${todayStr}&limit=5000`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (empRes.status === 401 || attRes.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
        return
      }

      const empData = await empRes.json()
      const attData = await attRes.json()

      const employees = empData.success ? (empData.employees || empData.data || []) : []
      const attendance = attData.success ? (attData.data || []) : []

      // --- Employee stats ---
      const totalEmp = employees.length
      const activeEmp = employees.filter((e: any) => e.employmentStatus === 'ACTIVE').length
      setEmpStats({ total: totalEmp, active: activeEmp })

      // --- Today's attendance stats ---
      const todayRecords = attendance.filter((r: any) => {
        const recDate = new Date(r.date).toISOString().split('T')[0]
        return recDate === todayStr
      })

      let presentCount = 0
      let lateCount = 0
      let totalOT = 0
      let totalUT = 0
      const requiredHours = 8

      todayRecords.forEach((r: any) => {
        const checkIn = r.checkInTime ? new Date(r.checkInTime) : null
        const checkOut = r.checkOutTime ? new Date(r.checkOutTime) : null
        const isLate = r.status === 'late' || (checkIn && (checkIn.getHours() > 8 || (checkIn.getHours() === 8 && checkIn.getMinutes() > 0)))

        if (isLate) {
          lateCount++
        } else if (checkIn) {
          presentCount++
        }

        if (checkIn && checkOut) {
          const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
          if (hours > requiredHours) totalOT += Math.round(hours - requiredHours)
          else if (hours < requiredHours) totalUT += Math.round(requiredHours - hours)
        }
      })

      const absentCount = totalEmp - presentCount - lateCount
      setAttStats({
        totalPresent: presentCount,
        totalLate: lateCount,
        totalAbsent: absentCount > 0 ? absentCount : 0,
        totalOvertime: totalOT,
        totalUndertime: totalUT
      })

      const rate = totalEmp > 0 ? Math.round(((presentCount + lateCount) / totalEmp) * 100) : 0
      setAttendanceRate(rate)

      // --- Department breakdown ---
      const deptMap = new Map<string, { count: number; present: number }>()
      employees.forEach((e: any) => {
        const dept = e.department || 'Unassigned'
        if (!deptMap.has(dept)) deptMap.set(dept, { count: 0, present: 0 })
        deptMap.get(dept)!.count++
      })

      todayRecords.forEach((r: any) => {
        const emp = employees.find((e: any) => e.id === r.employeeId)
        const dept = emp?.department || 'Unassigned'
        if (deptMap.has(dept)) {
          deptMap.get(dept)!.present++
        }
      })

      const deptArr: DeptBreakdown[] = []
      deptMap.forEach((val, dept) => {
        deptArr.push({
          department: dept,
          employeeCount: val.count,
          attendanceRate: val.count > 0 ? Math.round((val.present / val.count) * 100) : 0
        })
      })
      setDeptBreakdown(deptArr)

      // --- Weekly trend ---
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const weekly: WeeklyDay[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        if (d > localDate) break // don't include future days

        const dayRecords = attendance.filter((r: any) => {
          return new Date(r.date).toISOString().split('T')[0] === dateStr
        })

        let dayPresent = 0, dayLate = 0
        dayRecords.forEach((r: any) => {
          const ci = r.checkInTime ? new Date(r.checkInTime) : null
          const isLateDay = r.status === 'late' || (ci && (ci.getHours() > 8 || (ci.getHours() === 8 && ci.getMinutes() > 0)))
          if (isLateDay) dayLate++
          else if (ci) dayPresent++
        })

        weekly.push({
          day: dayNames[i],
          present: dayPresent,
          late: dayLate,
          absent: Math.max(0, totalEmp - dayPresent - dayLate)
        })
      }
      setWeeklyTrend(weekly)

      // --- Recent activity (today's check-ins) ---
      const recent: RecentAct[] = todayRecords.slice(0, 5).map((r: any, idx: number) => {
        const emp = r.employee || employees.find((e: any) => e.id === r.employeeId) || {}
        const checkIn = r.checkInTime ? new Date(r.checkInTime) : null
        const isLate = r.status === 'late' || (checkIn && (checkIn.getHours() > 8 || (checkIn.getHours() === 8 && checkIn.getMinutes() > 0)))

        return {
          id: r.id || idx,
          employee: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || `Employee #${r.employeeId}`,
          department: emp.department || 'General',
          action: 'Clock In',
          time: checkIn ? checkIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '---',
          status: isLate ? 'late' : 'on-time'
        }
      })
      setRecentActivity(recent)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
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
            {deptBreakdown.length > 0 ? deptBreakdown.map(dept => (
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
            )) : (
              <p className="text-sm text-muted-foreground">No department data available</p>
            )}
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
              {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
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
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">
                    No activity recorded today
                  </td>
                </tr>
              )}
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
