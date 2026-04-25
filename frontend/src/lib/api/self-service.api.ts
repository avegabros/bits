import { apiFetch, Employee, Department, Branch, Role, EmploymentStatus, AttendanceRecord, User, PaginationMeta } from './client';
import { GetAttendanceResponse } from './attendance.api';

// ─── Employee Self-Service ───────────────────────────────────────────────────

export const employeeSelfApi = {
  getAttendance(startDate?: string, endDate?: string) {
    const query = new URLSearchParams()
    if (startDate) query.set('startDate', startDate)
    if (endDate) query.set('endDate', endDate)
    const qs = query.toString()
    return apiFetch<GetAttendanceResponse>(`/api/me/attendance${qs ? `?${qs}` : ''}`)
  },

  getShift() {
    return apiFetch<{ success: boolean; shift: any }>('/api/me/shift')
  },

  getProfile() {
    return apiFetch<{ success: boolean; profile: Employee }>('/api/me/profile')
  },

  changePassword(currentPassword: string, newPassword: string) {
    return apiFetch<{ success: boolean; message: string }>(
      '/api/me/password',
      { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }
    )
  },

  uploadProfilePicture(file: File) {
    const formData = new FormData()
    formData.append('file', file)

    // Using raw fetch instead of apiFetch because we need to send FormData 
    // and let the browser automatically set the correct Content-Type with boundary
    return fetch('/api/me/profile-picture', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    }).then(async res => {
      if (!res.ok) {
        let message = `Request failed: ${res.status} ${res.statusText}`
        try {
          const body = await res.json()
          if (body?.message) message = body.message
        } catch {
          // ignore
        }
        throw new Error(message)
      }
      return res.json() as Promise<{ success: boolean; profilePicture?: string; message?: string }>
    })
  },

  deleteProfilePicture() {
    return apiFetch<{ success: boolean; message?: string }>('/api/me/profile-picture', {
      method: 'DELETE'
    })
  },
}