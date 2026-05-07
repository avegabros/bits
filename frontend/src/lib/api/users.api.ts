import { apiFetch, Employee, Department, Branch, Role, EmploymentStatus, AttendanceRecord, User, PaginationMeta } from './client';

// ─── Users (ADMIN / HR accounts) ─────────────────────────────────────────────

export interface GetUsersResponse {
  success: boolean
  users: User[]
}

export interface CreateUserPayload {
  firstName: string
  lastName: string
  email: string
  password: string
  role: 'ADMIN' | 'HR'
}

export interface UpdateUserPayload {
  firstName?: string
  lastName?: string
  email?: string
  role?: 'ADMIN' | 'HR'
  password?: string
}

export interface UpdateProfilePayload {
  firstName?: string
  lastName?: string
  contactNumber?: string
}

export const usersApi = {
  getAll() {
    return apiFetch<GetUsersResponse>('/api/users')
  },

  create(payload: CreateUserPayload) {
    return apiFetch<{ success: boolean; message: string; user: User }>(
      '/api/users',
      { method: 'POST', body: JSON.stringify(payload) }
    )
  },

  update(id: number, payload: UpdateUserPayload) {
    return apiFetch<{ success: boolean; message: string; user: User }>(
      `/api/users/${id}`,
      { method: 'PUT', body: JSON.stringify(payload) }
    )
  },

  delete(id: number) {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/users/${id}`,
      { method: 'DELETE' }
    )
  },

  toggleStatus(id: number) {
    return apiFetch<{ success: boolean; message: string; user: User }>(
      `/api/users/${id}/toggle-status`,
      { method: 'PATCH' }
    )
  },

  updateProfile(payload: UpdateProfilePayload) {
    return apiFetch<{ success: boolean; message: string; employee: Partial<Employee> }>(
      '/api/users/profile',
      { method: 'PUT', body: JSON.stringify(payload) }
    )
  },

  changePassword(currentPassword: string, newPassword: string) {
    return apiFetch<{ success: boolean; message: string }>(
      '/api/users/change-password',
      { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }
    )
  },
}