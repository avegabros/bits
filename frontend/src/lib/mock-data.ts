// mock-data.ts — Provides placeholder/mock data for frontend pages that haven't
// been wired to real API endpoints yet. This file exists so the frontend builds
// cleanly while we progressively replace mock data with real backend calls.

// ─── Shared constants ────────────────────────────────────────────────
export const branches = ['MAIN OFFICE', 'CEBU BRANCH', 'MAKATI BRANCH']
export const departments = ['Engineering', 'Design', 'HR', 'Finance', 'Marketing', 'Operations']

// ─── Employee type & data ────────────────────────────────────────────
export type Employee = {
    id: number
    name: string
    contactNumber: string
    department: string
    position: string
    branch: string
    status: 'active' | 'inactive'
    joinDate: string
    bio?: string
}

export const employees: Employee[] = [
    { id: 1, name: 'John Doe', contactNumber: '+63-912-345-6789', department: 'Engineering', position: 'Developer', branch: 'MAIN OFFICE', status: 'active', joinDate: '2025-01-15' },
    { id: 2, name: 'Jane Smith', contactNumber: '+63-923-456-7890', department: 'Design', position: 'UI Designer', branch: 'CEBU BRANCH', status: 'active', joinDate: '2025-02-01' },
    { id: 3, name: 'Mark Anthony', contactNumber: '+63-934-567-8901', department: 'HR', position: 'HR Officer', branch: 'MAIN OFFICE', status: 'active', joinDate: '2025-01-20' },
    { id: 4, name: 'Sarah Jenkins', contactNumber: '+63-945-678-9012', department: 'Finance', position: 'Accountant', branch: 'MAKATI BRANCH', status: 'active', joinDate: '2025-03-10' },
    { id: 5, name: 'Alex Rivera', contactNumber: '+63-956-789-0123', department: 'Marketing', position: 'Marketing Lead', branch: 'CEBU BRANCH', status: 'active', joinDate: '2025-02-15' },
    { id: 6, name: 'Emily Chen', contactNumber: '+63-967-890-1234', department: 'Operations', position: 'Operations Manager', branch: 'MAIN OFFICE', status: 'active', joinDate: '2025-01-05' },
]

// ─── Dashboard helpers ───────────────────────────────────────────────
export function getEmployeeStats() {
    return {
        total: employees.length,
        active: employees.filter(e => e.status === 'active').length,
        inactive: employees.filter(e => e.status === 'inactive').length,
    }
}

export function getAttendanceStats() {
    return {
        totalPresent: 4,
        totalLate: 1,
        totalAbsent: 1,
        totalOvertime: 2.5,
        totalUndertime: 0.5,
    }
}

export function getDepartmentBreakdown() {
    return departments.map(dept => {
        const empCount = employees.filter(e => e.department === dept).length
        return {
            department: dept,
            employeeCount: empCount,
            attendanceRate: Math.round(60 + Math.random() * 35), // 60-95%
        }
    })
}

export function getWeeklyTrend() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    return days.map(day => ({
        day,
        present: Math.floor(3 + Math.random() * 3),
        late: Math.floor(Math.random() * 2),
        absent: Math.floor(Math.random() * 2),
    }))
}

export function getRecentActivity() {
    return [
        { id: 1, employee: 'John Doe', department: 'Engineering', action: 'Checked In', time: '08:02 AM', status: 'on-time' },
        { id: 2, employee: 'Jane Smith', department: 'Design', action: 'Checked In', time: '08:25 AM', status: 'late' },
        { id: 3, employee: 'Mark Anthony', department: 'HR', action: 'Checked In', time: '07:55 AM', status: 'on-time' },
        { id: 4, employee: 'Sarah Jenkins', department: 'Finance', action: 'Checked In', time: '08:10 AM', status: 'on-time' },
        { id: 5, employee: 'Alex Rivera', department: 'Marketing', action: 'Absent', time: '-', status: 'absent' },
    ]
}

// ─── Reports helper ──────────────────────────────────────────────────
export function getReportData() {
    return employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        department: emp.department,
        branch: emp.branch,
        totalDays: 22,
        present: Math.floor(18 + Math.random() * 4),
        late: Math.floor(Math.random() * 3),
        absent: Math.floor(Math.random() * 3),
        totalHours: parseFloat((160 + Math.random() * 20).toFixed(2)),
    }))
}
