'use client'

import React from "react"

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Search, Download, Filter } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const attendanceRecords = [
  { id: 1, employeeName: 'John Doe', date: '2024-01-15', checkIn: '08:15 AM', checkOut: '05:45 PM', status: 'present', hours: 9.5 },
  { id: 2, employeeName: 'Jane Smith', date: '2024-01-15', checkIn: '08:02 AM', checkOut: '05:30 PM', status: 'present', hours: 9.47 },
  { id: 3, employeeName: 'Mike Johnson', date: '2024-01-15', checkIn: '08:42 AM', checkOut: '05:50 PM', status: 'late', hours: 9.13 },
  { id: 4, employeeName: 'Sarah Williams', date: '2024-01-15', checkIn: '-', checkOut: '-', status: 'absent', hours: 0 },
  { id: 5, employeeName: 'Robert Brown', date: '2024-01-15', checkIn: '08:10 AM', checkOut: '-', status: 'incomplete', hours: null },
  { id: 6, employeeName: 'Emily Davis', date: '2024-01-15', checkIn: '08:20 AM', checkOut: '05:40 PM', status: 'present', hours: 9.33 },
]

const dailyAttendanceData = [
  { date: 'Jan 9', present: 145, absent: 8, late: 12 },
  { date: 'Jan 10', present: 152, absent: 5, late: 8 },
  { date: 'Jan 11', present: 148, absent: 9, late: 11 },
  { date: 'Jan 12', present: 156, absent: 3, late: 6 },
  { date: 'Jan 13', present: 158, absent: 2, late: 5 },
  { date: 'Jan 14', present: 155, absent: 4, late: 6 },
  { date: 'Jan 15', present: 151, absent: 6, late: 8 },
]

const hourlyTrendData = [
  { month: 'Week 1', avgHours: 40.2 },
  { month: 'Week 2', avgHours: 40.1 },
  { month: 'Week 3', avgHours: 39.8 },
  { month: 'Week 4', avgHours: 40.3 },
]

export default function AttendancePage() {
  const [records, setRecords] = useState(attendanceRecords)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const stats = {
    totalPresent: records.filter(r => r.status === 'present').length,
    totalAbsent: records.filter(r => r.status === 'absent').length,
    totalLate: records.filter(r => r.status === 'late').length,
    avgHours: (records.filter(r => r.hours).reduce((sum, r) => sum + (r.hours || 0), 0) / records.filter(r => r.hours).length).toFixed(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Attendance Tracking</h2>
          <p className="text-muted-foreground mt-1">Monitor employee check-ins and work hours</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border p-6">
          <p className="text-muted-foreground text-sm font-medium">Present Today</p>
          <p className="text-3xl font-bold text-foreground mt-2">{stats.totalPresent}</p>
          <p className="text-xs text-muted-foreground mt-2">Employees checked in</p>
        </Card>
        <Card className="bg-card border-border p-6">
          <p className="text-muted-foreground text-sm font-medium">Absent</p>
          <p className="text-3xl font-bold text-foreground mt-2">{stats.totalAbsent}</p>
          <p className="text-xs text-muted-foreground mt-2">No check-in record</p>
        </Card>
        <Card className="bg-card border-border p-6">
          <p className="text-muted-foreground text-sm font-medium">Late Arrivals</p>
          <p className="text-3xl font-bold text-foreground mt-2">{stats.totalLate}</p>
          <p className="text-xs text-muted-foreground mt-2">After 8:30 AM</p>
        </Card>
        <Card className="bg-card border-border p-6">
          <p className="text-muted-foreground text-sm font-medium">Avg Hours</p>
          <p className="text-3xl font-bold text-foreground mt-2">{stats.avgHours}</p>
          <p className="text-xs text-muted-foreground mt-2">Per employee today</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Daily Attendance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyAttendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
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
              <Bar dataKey="present" fill="var(--color-chart-1)" />
              <Bar dataKey="absent" fill="var(--color-chart-2)" />
              <Bar dataKey="late" fill="var(--color-chart-3)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-card border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Average Work Hours</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" />
              <YAxis domain={[39, 41]} stroke="rgba(255,255,255,0.6)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(22, 28, 45, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
              />
              <Legend />
              <Line type="monotone" dataKey="avgHours" stroke="var(--color-chart-1)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by employee name..."
                className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-48 bg-secondary border-border text-foreground">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-secondary border-border">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="late">Late</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Attendance Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Employee</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Check In</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Check Out</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Hours Worked</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRecords.map(record => (
                <tr key={record.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4 text-sm text-foreground font-medium">{record.employeeName}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{record.date}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{record.checkIn}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{record.checkOut}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{record.hours ? record.hours.toFixed(2) : '-'}</td>
                  <td className="px-6 py-4">
                    <Badge className={
                      record.status === 'present' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                        record.status === 'absent' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                          record.status === 'late' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                            'bg-gray-500/20 text-gray-300 border-gray-500/30'
                    }>
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-secondary/30 border-t border-border text-sm text-muted-foreground">
          Showing {filteredRecords.length} of {records.length} records
        </div>
      </Card>
    </div>
  )
}
