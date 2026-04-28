import { apiFetch, Employee, Department, Branch, Role, EmploymentStatus, AttendanceRecord, User, PaginationMeta } from './client';

// ─── Attendance ──────────────────────────────────────────────────────────────

export interface GetAttendanceParams {
  startDate?: string // YYYY-MM-DD
  endDate?: string   // YYYY-MM-DD
  employeeId?: number
  status?: string
  page?: number
  limit?: number
}

export interface GetAttendanceResponse {
  success: boolean
  data: AttendanceRecord[]
  meta: PaginationMeta
}

export interface GetTodayResponse {
  success: boolean
  count: number
  data: AttendanceRecord[]
}

export const attendanceApi = {
  getAll(params?: GetAttendanceParams) {
    const query = new URLSearchParams()
    if (params?.startDate) query.set('startDate', params.startDate)
    if (params?.endDate) query.set('endDate', params.endDate)
    if (params?.employeeId) query.set('employeeId', String(params.employeeId))
    if (params?.status) query.set('status', params.status)
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return apiFetch<GetAttendanceResponse>(`/api/attendance${qs ? `?${qs}` : ''}`)
  },

  getToday() {
    return apiFetch<GetTodayResponse>('/api/attendance/today')
  },

  getEmployeeHistory(id: number, startDate?: string, endDate?: string) {
    const query = new URLSearchParams()
    if (startDate) query.set('startDate', startDate)
    if (endDate) query.set('endDate', endDate)
    const qs = query.toString()
    return apiFetch<{ success: boolean; count: number; data: AttendanceRecord[] }>(
      `/api/attendance/employee/${id}${qs ? `?${qs}` : ''}`
    )
  },

  sync() {
    return apiFetch<{ success: boolean; message: string }>(
      '/api/attendance/sync',
      { method: 'POST' }
    )
  },

  deleteAttendance(id: number, reason: string) {
    return apiFetch<{ success: boolean; message: string; pending?: boolean }>(
      `/api/attendance/${id}`,
      { 
        method: 'DELETE',
        body: JSON.stringify({ reason })
      }
    )
  },
}