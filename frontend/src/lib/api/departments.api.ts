import { apiFetch, Employee, Department, Branch, Role, EmploymentStatus, AttendanceRecord, User, PaginationMeta } from './client';

// ─── Departments ─────────────────────────────────────────────────────────────

export interface GetDepartmentsResponse {
  success: boolean
  departments: Department[]
}

export const departmentsApi = {
  getAll() {
    return apiFetch<GetDepartmentsResponse>('/api/departments')
  },

  create(name: string) {
    return apiFetch<{ success: boolean; department: Department }>(
      '/api/departments',
      { method: 'POST', body: JSON.stringify({ name }) }
    )
  },

  delete(id: number) {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/departments/${id}`,
      { method: 'DELETE' }
    )
  },
}