'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search,
  Download,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Timer,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const branches = ['MAIN OFFICE', 'CEBU BRANCH', 'MAKATI BRANCH']
const departments = ['Engineering', 'Design', 'HR', 'Finance', 'Marketing', 'Operations']

export default function AttendancePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [selectedDept, setSelectedDept] = useState('all')

  // Default to today
  const getTodayDate = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate())

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const rowsPerPage = 10

  // Debounce search term to prevent too many API calls
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    fetchAttendance()
  }, [attendanceDate, currentPage, selectedBranch, selectedDept, selectedStatus, debouncedSearch])

  // Simple stats state
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    avgHours: '0',
    totalOvertime: '0',
    totalUndertime: '0'
  })

  const fetchAttendance = async () => {
    setLoading(true)
    setDebugInfo(null)
    try {
      const token = localStorage.getItem('token')

      // Build query params
      const params = new URLSearchParams();
      if (attendanceDate) {
        params.append('startDate', attendanceDate);
        params.append('endDate', attendanceDate);
      }
      params.append('page', currentPage.toString());
      params.append('limit', rowsPerPage.toString());

      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      // Backend doesn't support branch/dept filtering yet directly in this endpoint easily
      // without joining tables in the query, but we can add it later.
      // For now, search and basic filters.

      const res = await fetch(`/api/attendance?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
        return
      }

      const data = await res.json()

      if (data.success) {
        // Map and Calculate Hours
        const mapped = data.data.map((log: any) => {
          const checkIn = new Date(log.checkInTime)
          const checkOut = log.checkOutTime ? new Date(log.checkOutTime) : null
          let hours = 0
          if (checkOut) {
            const diffMs = checkOut.getTime() - checkIn.getTime()
            hours = diffMs / (1000 * 60 * 60)
          }

          // Simple OT/UT logic (Assuming 9 hour work day including 1hr break = 8 working hours?)
          // Let's assume 8 working hours required.
          const requiredHours = 8
          const overtime = hours > requiredHours ? hours - requiredHours : 0
          const undertime = (hours > 0 && hours < requiredHours) ? requiredHours - hours : 0

          const isLate = log.status === 'late' || checkIn.getHours() >= 9;

          const emp = log.employee || log.Employee || {};

          return {
            id: log.id,
            employeeId: log.employeeId,
            employeeName: emp.firstName ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee',
            branch: emp.branch || 'MAIN OFFICE', // Fallback
            department: emp.department || 'General',
            date: new Date(log.date).toISOString().split('T')[0],
            checkIn: log.checkInTimePH || checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            checkOut: log.checkOutTime ? (log.checkOutTimePH || checkOut?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : '-',
            status: isLate ? 'late' : (log.status || 'present'),
            hours: hours,
            overtime: overtime,
            undertime: undertime,
            ...log // keep original data for debug
          }
        })

        // Client-side text search (temporary until backend search is implemented)
        // Since we are now paginating, client-side search only works on the CURRENT page.
        // For full search, we need backend support.
        // For now, we will just display the mapped records from backend.

        setAttendanceRecords(mapped)
        setTotalPages(data.meta?.totalPages || 1)

        // Correction: Stats should ideally come from backend aggregation to be accurate across ALL pages.
        // For now, we'll hide the stats or show stats only for current page, or (better) fetch stats separately.
        // Let's calculate stats for current page for now to keep it simple, but note it as a limitation.

        const currentStats = {
          totalPresent: mapped.filter((r: any) => r.status === 'present').length,
          totalAbsent: mapped.filter((r: any) => r.status === 'absent').length,
          totalLate: mapped.filter((r: any) => r.status === 'late').length,
          avgHours: mapped.length > 0
            ? (mapped.filter((r: any) => r.hours > 0).reduce((sum: number, r: any) => sum + r.hours, 0) / mapped.filter((r: any) => r.hours > 0).length).toFixed(1)
            : '0',
          totalOvertime: mapped.reduce((sum: number, r: any) => sum + r.overtime, 0).toFixed(1),
          totalUndertime: mapped.reduce((sum: number, r: any) => sum + r.undertime, 0).toFixed(1)
        }
        setStats(currentStats)

        setDebugInfo({
          message: 'Fetch Success',
          count: data.data.length,
          total: data.meta?.total
        })
      } else {
        const errorMsg = data.message || data.error || 'Unknown server error';
        console.error("Failed to fetch records:", errorMsg)
        setDebugInfo({ error: errorMsg })
      }
    } catch (error: any) {
      console.error("Error fetching attendance records", error)
      setDebugInfo({ error: error.message || 'Unknown fetch error' })
    } finally {
      setLoading(false)
    }
  }

  // Removed client-side filtering logic since backend handles it
  const paginatedRecords = attendanceRecords;



  const handleExport = () => {
    const headers = ['Employee', 'Branch', 'Date', 'Check In', 'Check Out', 'Hours', 'Overtime', 'Undertime', 'Status']
    const rows = attendanceRecords.map(r => [
      r.employeeName,
      r.branch,
      r.date,
      r.checkIn,
      r.checkOut,
      r.hours.toFixed(2),
      r.overtime.toFixed(2),
      r.undertime.toFixed(2),
      r.status.charAt(0).toUpperCase() + r.status.slice(1)
    ])

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    const branchLabel = selectedBranch === 'all' ? 'All-Branches' : selectedBranch.replace(/\s+/g, '-')
    link.download = `Attendance_${branchLabel}_${attendanceDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const [debugInfo, setDebugInfo] = useState<any>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Attendance</h2>
          <p className="text-muted-foreground text-sm mt-1">Monitor employee check-ins, overtime, and undertime</p>
        </div>
        <Button onClick={handleExport} className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {debugInfo?.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {debugInfo.error}
          </AlertDescription>
        </Alert>
      )}

      {/* { DEBUG PANEL
      <Card className="bg-yellow-50 border-yellow-200 p-4 mb-4">
        <h3 className="font-bold text-yellow-800 mb-2">Debug Info (Technical)</h3>
        <pre className="text-xs overflow-auto max-h-40 bg-white p-2 border border-yellow-100 rounded">
          {JSON.stringify({
            loading,
            recordsCount: attendanceRecords.length,
            filteredCount: filteredRecords.length,
            firstRecord: attendanceRecords[0],
            rawEmployee: attendanceRecords[0]?.employee || 'N/A',
            filters: { searchTerm, selectedStatus, selectedBranch, selectedDept, attendanceDate },
            fetchError: debugInfo
          }, null, 2)}
        </pre> }
      </Card> */}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-card border-border p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Present</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{stats.totalPresent}</p>
            </div>
            <div className="bg-primary/20 p-2 sm:p-3 rounded-lg">
              <Users className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Late</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{stats.totalLate}</p>
            </div>
            <div className="bg-yellow-500/20 p-2 sm:p-3 rounded-lg">
              <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Absent</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{stats.totalAbsent}</p>
            </div>
            <div className="bg-red-500/20 p-2 sm:p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 sm:w-6 sm:h-6 text-red-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Avg Hours</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{stats.avgHours}h</p>
            </div>
            <div className="bg-primary/20 p-2 sm:p-3 rounded-lg">
              <Timer className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Overtime</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-400 mt-1 sm:mt-2">{stats.totalOvertime}h</p>
            </div>
            <div className="bg-green-500/20 p-2 sm:p-3 rounded-lg">
              <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border p-4 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Undertime</p>
              <p className="text-2xl sm:text-3xl font-bold text-red-400 mt-1 sm:mt-2">{stats.totalUndertime}h</p>
            </div>
            <div className="bg-red-500/20 p-2 sm:p-3 rounded-lg">
              <TrendingDown className="w-4 h-4 sm:w-6 sm:h-6 text-red-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
                className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <Input
              type="date"
              value={attendanceDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAttendanceDate(e.target.value)}
              className="bg-secondary border-border text-foreground w-full sm:w-40"
            />
            <div className="flex gap-3">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="flex-1 sm:w-40 bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-border">
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="flex-1 sm:w-40 bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-border">
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="flex-1 sm:w-40 bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-border">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Attendance Table */}
      <Card className="bg-card border-border overflow-hidden rounded-2xl shadow-lg">
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-secondary/20 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({attendanceRecords.length} records on this page)
          </p>
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 w-fit text-xs">
            {new Date(attendanceDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' })}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-secondary/50 backdrop-blur-sm">
                <th className="px-4 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Employee</th>
                <th className="px-4 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Department</th>
                <th className="px-4 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Check In</th>
                <th className="px-4 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Check Out</th>
                <th className="px-4 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Hours</th>
                <th className="px-4 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">OT</th>
                <th className="px-4 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">UT</th>
                <th className="px-4 sm:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Loading attendance data...</td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No records found.</td>
                </tr>
              ) : (
                paginatedRecords.map((record, index) => (
                  <tr
                    key={record.id}
                    className={`hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-secondary/10'}`}
                  >
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {record.employeeName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground block truncate">{record.employeeName}</span>
                          <span className="text-xs text-muted-foreground sm:hidden">{record.department}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                      <Badge variant="outline" className="bg-secondary/50 text-foreground border-border text-xs">
                        {record.department}
                      </Badge>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-foreground hidden sm:table-cell">{record.checkIn}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-foreground hidden sm:table-cell">{record.checkOut}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm font-mono text-foreground">{record.hours > 0 ? record.hours.toFixed(2) : '-'}</td>
                    <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                      <span className={`text-sm font-medium ${record.overtime > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                        {record.overtime > 0 ? `+${record.overtime.toFixed(2)}` : '-'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                      <span className={`text-sm font-medium ${record.undertime > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {record.undertime > 0 ? `-${record.undertime.toFixed(2)}` : '-'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <Badge variant="outline" className={
                        record.status === 'present' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          record.status === 'absent' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            record.status === 'late' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                              'bg-secondary/50 text-muted-foreground border-border'
                      }>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </Badge>
                    </td>
                  </tr>
                )))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 sm:px-6 py-4 bg-secondary/20 border-t border-border flex items-center justify-between">
          <span className="text-xs sm:text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 px-2 sm:px-3 border-border text-foreground hover:bg-secondary disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Previous</span>
            </Button>
            <div className="hidden sm:flex gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 p-0 ${currentPage === page ? 'bg-primary text-white' : 'border-border text-foreground hover:bg-secondary'}`}
                >
                  {page}
                </Button>
              ))}
            </div>
            <span className="sm:hidden text-xs text-muted-foreground px-2">{currentPage}/{totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="h-8 px-2 sm:px-3 border-border text-foreground hover:bg-secondary disabled:opacity-50"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
