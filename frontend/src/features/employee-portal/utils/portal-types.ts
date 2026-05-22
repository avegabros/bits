export interface PortalEmployeeProfile {
  id: number
  zkId: number | null
  firstName: string
  lastName: string
  middleName: string | null
  suffix: string | null
  email: string
  role: string
  department: string | null
  position: string | null
  branch: string | null
  contactNumber: string | null
  employeeNumber: string | null
  hireDate: string | null
  employmentStatus: string
  profilePicture: string | null
  needsPasswordChange: boolean
  createdAt: string
}

export interface PortalAttendanceRecord {
  id: number
  date: string
  checkInTime: string
  checkOutTime: string | null
  status: string
  notes: string | null
  totalHours?: number // Found in detailed view
  lateMinutes?: number // Found in detailed view
  overtimeMinutes?: number // Found in detailed view
  undertimeMinutes?: number // Found in detailed view
  shiftCode?: string | null // Found in detailed view
  shiftName?: string | null // Found in detailed view
  shiftId?: number | null // Found in detailed view
  isShiftActive?: boolean // Found in detailed view
  gracePeriodApplied?: boolean // Found in detailed view
  isEdited?: boolean // True when checkin/checkout was manually adjusted
  approvedOts?: any[]
}

export interface PortalShiftData {
  id: number
  name: string
  shiftCode: string
  startTime: string
  endTime: string
  graceMinutes: number
  breakMinutes: number
  isNightShift: boolean
  workDays: string
  description: string | null
}
