'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Download, FileText, BarChart3, TrendingUp } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'

const departmentMetrics = [
  { department: 'Engineering', employees: 45, avgAttendance: 94.2, avgSalary: 5200, productivity: 88 },
  { department: 'Design', employees: 18, avgAttendance: 92.1, avgSalary: 4800, productivity: 85 },
  { department: 'HR', employees: 12, avgAttendance: 96.5, avgSalary: 4200, productivity: 90 },
  { department: 'Finance', employees: 22, avgAttendance: 95.8, avgSalary: 4900, productivity: 92 },
  { department: 'Marketing', employees: 28, avgAttendance: 91.3, avgSalary: 4600, productivity: 87 },
  { department: 'Operations', employees: 35, avgAttendance: 93.7, avgSalary: 4400, productivity: 89 },
]

const attendanceByMonth = [
  { month: 'Jan', onTime: 92, late: 5, absent: 3 },
  { month: 'Feb', onTime: 94, late: 3, absent: 3 },
  { month: 'Mar', onTime: 91, late: 6, absent: 3 },
  { month: 'Apr', onTime: 95, late: 3, absent: 2 },
  { month: 'May', onTime: 93, late: 4, absent: 3 },
  { month: 'Jun', onTime: 96, late: 2, absent: 2 },
]

const salaryDistribution = [
  { range: '3k-4k', count: 85, fill: 'var(--color-chart-1)' },
  { range: '4k-5k', count: 92, fill: 'var(--color-chart-2)' },
  { range: '5k-6k', count: 45, fill: 'var(--color-chart-3)' },
  { range: '6k-7k', count: 18, fill: 'var(--color-chart-4)' },
  { range: '7k+', count: 8, fill: 'var(--color-chart-5)' },
]

const employeePerformance = [
  { id: 1, name: 'Team A', attendance: 94, productivity: 88, satisfaction: 85 },
  { id: 2, name: 'Team B', attendance: 92, productivity: 82, satisfaction: 80 },
  { id: 3, name: 'Team C', attendance: 96, productivity: 91, satisfaction: 88 },
  { id: 4, name: 'Team D', attendance: 89, productivity: 85, satisfaction: 78 },
  { id: 5, name: 'Team E', attendance: 95, productivity: 89, satisfaction: 87 },
]

const reports = [
  { id: 1, title: 'Monthly Attendance Report', type: 'PDF', generated: '2024-01-15', status: 'ready' },
  { id: 2, title: 'Payroll Summary Report', type: 'XLSX', generated: '2024-01-14', status: 'ready' },
  { id: 3, title: 'Employee Performance Analysis', type: 'PDF', generated: '2024-01-13', status: 'ready' },
  { id: 4, title: 'Department Budget Report', type: 'XLSX', generated: '2024-01-12', status: 'generating' },
  { id: 5, title: 'Turnover Analysis Report', type: 'PDF', generated: '2024-01-10', status: 'ready' },
]

export default function ReportsPage() {
  const [reportType, setReportType] = useState<string>('attendance')
  const [dateRange, setDateRange] = useState<string>('month')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Reports & Analytics</h2>
          <p className="text-muted-foreground mt-1">Comprehensive system analytics and reporting</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 gap-2">
          <Download className="w-4 h-4" />
          Generate Custom Report
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border p-4">
        <div className="flex gap-4 flex-wrap">
          <div>
            <Label className="text-foreground text-sm font-medium">Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="mt-2 w-48 bg-secondary border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-border">
                <SelectItem value="attendance">Attendance</SelectItem>
                <SelectItem value="payroll">Payroll</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="department">Department</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-foreground text-sm font-medium">Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="mt-2 w-48 bg-secondary border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-border">
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Attendance Trend by Month</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={attendanceByMonth}>
              <defs>
                <linearGradient id="colorOnTime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" />
              <YAxis stroke="rgba(255,255,255,0.6)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(22, 28, 45, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
              />
              <Legend />
              <Area type="monotone" dataKey="onTime" stackId="1" stroke="var(--color-chart-1)" fill="url(#colorOnTime)" name="On Time" />
              <Area type="monotone" dataKey="late" stackId="1" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.3} name="Late" />
              <Area type="monotone" dataKey="absent" stackId="1" stroke="var(--color-chart-3)" fill="var(--color-chart-3)" fillOpacity={0.3} name="Absent" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-card border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Salary Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salaryDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="range" stroke="rgba(255,255,255,0.6)" />
              <YAxis stroke="rgba(255,255,255,0.6)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(22, 28, 45, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
              />
              <Bar dataKey="count" fill="var(--color-chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Department Metrics Table */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Department Metrics</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Department</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Employees</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Avg Attendance</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Avg Salary</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Productivity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {departmentMetrics.map(dept => (
                <tr key={dept.department} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{dept.department}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{dept.employees}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${dept.avgAttendance}%` }}
                        />
                      </div>
                      <span className="text-foreground font-medium">{dept.avgAttendance.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">${dept.avgSalary.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="font-medium">{dept.productivity}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Generated Reports */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Generated Reports</h3>
        <div className="space-y-3">
          {reports.map(report => (
            <div key={report.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{report.title}</p>
                  <p className="text-xs text-muted-foreground">Generated: {report.generated} • {report.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={
                  report.status === 'ready' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                    'bg-blue-500/20 text-blue-300 border-blue-500/30'
                }>
                  {report.status === 'ready' ? 'Ready' : 'Generating'}
                </Badge>
                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/20">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
