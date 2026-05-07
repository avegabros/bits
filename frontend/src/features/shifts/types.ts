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
  isActive: boolean
  description: string | null
  workDays: string
  halfDays: string
  halfDayHours: number | null
  breaks: string
  _count: { Employee: number }
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export const emptyForm = {
  shiftCode: '',
  name: '',
  startTime: '',
  endTime: '',
  graceMinutes: 0,
  breakMinutes: 60,
  isNightShift: false,
  description: '',
  workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
  halfDays: [] as string[],
  halfDayHours: null as number | null,
  breaks: [] as { start: string; end: string; name: string }[],
}

export type ShiftFormData = typeof emptyForm
