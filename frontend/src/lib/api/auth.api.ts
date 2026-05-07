import { apiFetch, Employee, Department, Branch, Role, EmploymentStatus, AttendanceRecord, User, PaginationMeta } from './client';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  message: string
  accessToken: string
  token: string
  refreshToken: string
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'email' | 'role'>
}

export const authApi = {
  login(payload: LoginPayload) {
    return apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  register(payload: Partial<Employee> & { password: string }) {
    return apiFetch<{ success: boolean; message: string; employee: Partial<Employee> }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(payload) }
    )
  },

  refreshToken(refreshToken: string) {
    return apiFetch<{ success: boolean; accessToken: string }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
  },
}