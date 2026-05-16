// ── Shifts Feature Types ──────────────────────────────────────

export interface Shift {
  id: number
  shiftCode: string
  name: string
  startTime: string
  endTime: string
  graceMinutes: number
  breakMinutes: number
  isNightShift: boolean
  description: string | null
  workDays: string
  halfDays: string
  halfDayHours: number | null
  breaks: string
  _count: { EmployeeShift: number }
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export const emptyForm = {
  shiftCode: '',
  name: '',
  startTime: '',
  endTime: '',
  graceMinutes: 0,
  breakMinutes: 0,
  isNightShift: false,
  description: '',
  workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
  halfDays: [] as string[],
  halfDayHours: null as number | null,
  breaks: [] as { start: string; end: string; name: string }[],
}

export type ShiftFormData = typeof emptyForm

export interface EmployeeConflict {
  employeeId: number
  employeeName: string
  conflictingShiftName: string
  conflictingShiftTime: string
  editedShiftTime: string
  reason: string
  commonDays: string[]
}

export interface ShiftConflictReport {
  hasConflicts: boolean
  conflicts: EmployeeConflict[]
  affectedEmployeeCount: number
  hasAttendanceRecords: boolean
}
