// ─── Shared Mock Data ────────────────────────────────────────────
// Single source of truth for employees, attendance, branches, and departments.
// All admin pages import from here so numbers stay consistent.

export const branches = ['MAIN OFFICE', 'CEBU BRANCH', 'MAKATI BRANCH'] as const
export const departments = ['Engineering', 'Design', 'HR', 'Finance', 'Marketing', 'Operations'] as const

export type Branch = (typeof branches)[number]
export type Department = (typeof departments)[number]

// ─── Employees ───────────────────────────────────────────────────

export interface Employee {
  id: number
  name: string
  contactNumber: string
  department: Department
  position: string
  branch: Branch
  status: 'active' | 'inactive'
  joinDate: string
}

export const employees: Employee[] = [
  { id: 1, name: 'John Doe', contactNumber: '+63-934-567-8901', department: 'Engineering', position: 'Senior Developer', branch: 'MAIN OFFICE', status: 'active', joinDate: '2022-03-15' },
  { id: 2, name: 'Jane Smith', contactNumber: '+63-934-567-8902', department: 'Design', position: 'UI/UX Designer', branch: 'CEBU BRANCH', status: 'active', joinDate: '2022-06-20' },
  { id: 3, name: 'Mike Johnson', contactNumber: '+63-934-567-8903', department: 'Engineering', position: 'Frontend Developer', branch: 'MAIN OFFICE', status: 'active', joinDate: '2023-01-10' },
  { id: 4, name: 'Sarah Williams', contactNumber: '+63-934-567-8904', department: 'HR', position: 'HR Manager', branch: 'MAKATI BRANCH', status: 'active', joinDate: '2021-05-01' },
  { id: 5, name: 'Robert Brown', contactNumber: '+63-934-567-8905', department: 'Finance', position: 'Accountant', branch: 'MAIN OFFICE', status: 'inactive', joinDate: '2022-11-15' },
  { id: 6, name: 'Emily Davis', contactNumber: '+63-934-567-8906', department: 'Marketing', position: 'Marketing Manager', branch: 'CEBU BRANCH', status: 'active', joinDate: '2023-02-28' },
  { id: 7, name: 'Alex Turner', contactNumber: '+63-934-567-8907', department: 'Operations', position: 'Operations Lead', branch: 'MAKATI BRANCH', status: 'active', joinDate: '2023-04-12' },
  { id: 8, name: 'Maria Santos', contactNumber: '+63-934-567-8908', department: 'HR', position: 'HR Specialist', branch: 'CEBU BRANCH', status: 'active', joinDate: '2023-06-01' },
]

// ─── Attendance Records ──────────────────────────────────────────

export interface AttendanceRecord {
  id: number
  employeeName: string
  branch: Branch
  department: Department
  date: string
  checkIn: string
  checkOut: string
  status: 'present' | 'late' | 'absent'
  hours: number
  overtime: number
  undertime: number
}

export const attendanceRecords: AttendanceRecord[] = [
  { id: 1, employeeName: 'John Doe', branch: 'MAIN OFFICE', department: 'Engineering', date: '2024-01-15', checkIn: '08:15 AM', checkOut: '05:45 PM', status: 'present', hours: 9.5, overtime: 1.5, undertime: 0 },
  { id: 2, employeeName: 'Jane Smith', branch: 'CEBU BRANCH', department: 'Design', date: '2024-01-15', checkIn: '08:02 AM', checkOut: '05:30 PM', status: 'present', hours: 9.47, overtime: 1.47, undertime: 0 },
  { id: 3, employeeName: 'Mike Johnson', branch: 'MAIN OFFICE', department: 'Engineering', date: '2024-01-15', checkIn: '08:42 AM', checkOut: '05:50 PM', status: 'late', hours: 9.13, overtime: 1.13, undertime: 0 },
  { id: 4, employeeName: 'Sarah Williams', branch: 'MAKATI BRANCH', department: 'HR', date: '2024-01-15', checkIn: '-', checkOut: '-', status: 'absent', hours: 0, overtime: 0, undertime: 8 },
  { id: 5, employeeName: 'Robert Brown', branch: 'MAIN OFFICE', department: 'Finance', date: '2024-01-15', checkIn: '08:10 AM', checkOut: '03:00 PM', status: 'present', hours: 6.83, overtime: 0, undertime: 1.17 },
  { id: 6, employeeName: 'Emily Davis', branch: 'CEBU BRANCH', department: 'Marketing', date: '2024-01-15', checkIn: '08:20 AM', checkOut: '05:40 PM', status: 'present', hours: 9.33, overtime: 1.33, undertime: 0 },
  { id: 7, employeeName: 'Alex Turner', branch: 'MAKATI BRANCH', department: 'Operations', date: '2024-01-15', checkIn: '07:55 AM', checkOut: '06:10 PM', status: 'present', hours: 10.25, overtime: 2.25, undertime: 0 },
  { id: 8, employeeName: 'Maria Santos', branch: 'CEBU BRANCH', department: 'HR', date: '2024-01-15', checkIn: '09:05 AM', checkOut: '05:00 PM', status: 'late', hours: 7.92, overtime: 0, undertime: 0.08 },
]

// ─── Helper Functions ────────────────────────────────────────────

/** Overall employee stats */
export function getEmployeeStats() {
  const total = employees.length
  const active = employees.filter(e => e.status === 'active').length
  const inactive = total - active
  const byDepartment = departments.map(dept => ({
    department: dept,
    count: employees.filter(e => e.department === dept).length,
  }))
  const byBranch = branches.map(b => ({
    branch: b,
    count: employees.filter(e => e.branch === b).length,
  }))
  return { total, active, inactive, byDepartment, byBranch }
}

/** Attendance stats for today's records */
export function getAttendanceStats(records: AttendanceRecord[] = attendanceRecords) {
  const totalPresent = records.filter(r => r.status === 'present').length
  const totalLate = records.filter(r => r.status === 'late').length
  const totalAbsent = records.filter(r => r.status === 'absent').length
  const working = records.filter(r => r.hours > 0)
  const avgHours = working.length > 0
    ? +(working.reduce((s, r) => s + r.hours, 0) / working.length).toFixed(1)
    : 0
  const totalOvertime = +records.reduce((s, r) => s + r.overtime, 0).toFixed(1)
  const totalUndertime = +records.reduce((s, r) => s + r.undertime, 0).toFixed(1)
  return { totalPresent, totalLate, totalAbsent, avgHours, totalOvertime, totalUndertime }
}

/** Department breakdown with employee count and attendance rate */
export function getDepartmentBreakdown() {
  return departments.map(dept => {
    const deptEmployees = employees.filter(e => e.department === dept)
    const deptRecords = attendanceRecords.filter(r => r.department === dept)
    const present = deptRecords.filter(r => r.status === 'present' || r.status === 'late').length
    const rate = deptRecords.length > 0 ? Math.round((present / deptRecords.length) * 100) : 0
    return {
      department: dept,
      employeeCount: deptEmployees.length,
      attendanceRate: rate,
    }
  })
}

/** Weekly trend data for charts (mock — simulates Mon–Fri) */
export function getWeeklyTrend() {
  return [
    { day: 'Mon', present: 6, late: 1, absent: 1 },
    { day: 'Tue', present: 7, late: 1, absent: 0 },
    { day: 'Wed', present: 6, late: 1, absent: 1 },
    { day: 'Thu', present: 7, late: 0, absent: 1 },
    { day: 'Fri', present: 5, late: 2, absent: 1 },
  ]
}

/** Recent activity entries (derived from attendance) */
export function getRecentActivity() {
  return attendanceRecords.map(r => ({
    id: r.id,
    employee: r.employeeName,
    action: r.status === 'absent' ? 'Absent' : r.checkOut !== '-' ? 'Checked Out' : 'Checked In',
    time: r.status === 'absent' ? 'N/A' : r.checkIn,
    status: r.status === 'present' ? 'on-time' : r.status,
    department: r.department,
  }))
}

/** Aggregate per-employee report data for reports page */
export function getReportData() {
  return employees.map(emp => {
    const records = attendanceRecords.filter(r => r.employeeName === emp.name)
    const totalDays = 22 // working days in month
    const present = records.filter(r => r.status === 'present').length
    const late = records.filter(r => r.status === 'late').length
    const absent = records.filter(r => r.status === 'absent').length
    const totalHours = records.reduce((s, r) => s + r.hours, 0)
    return {
      id: emp.id,
      name: emp.name,
      department: emp.department,
      branch: emp.branch,
      totalDays,
      present,
      late,
      absent,
      totalHours: +totalHours.toFixed(2),
    }
  })
}
