import { apiFetch, Employee, Department, Branch, Role, EmploymentStatus, AttendanceRecord, User, PaginationMeta } from './client';

// ─── Employees ───────────────────────────────────────────────────────────────

export interface GetEmployeesParams {
  page?: number
  limit?: number
  search?: string
}

export interface GetEmployeesResponse {
  success: boolean
  employees: Employee[]
}

export interface CreateEmployeePayload {
  firstName: string
  lastName: string
  email?: string
  employeeNumber?: string
  role?: Role
  departmentId?: number | null
  position?: string
  branchId?: number | null
  contactNumber?: string
  hireDate?: string
  employmentStatus?: EmploymentStatus
}

export interface UpdateEmployeePayload {
  firstName?: string
  lastName?: string
  email?: string
  contactNumber?: string
  position?: string
  departmentId?: number | null
  branchId?: number | null
  employmentStatus?: EmploymentStatus
}

export const employeesApi = {
  getAll(params?: GetEmployeesParams) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.search) query.set('search', params.search)
    const qs = query.toString()
    return apiFetch<GetEmployeesResponse>(`/api/employees${qs ? `?${qs}` : ''}`)
  },

  getById(id: number) {
    return apiFetch<{ success: boolean; employee: Employee }>(`/api/employees/${id}`)
  },

  create(payload: CreateEmployeePayload) {
    return apiFetch<{ success: boolean; message: string; employee: Employee; deviceSync: { success: boolean; message: string } }>(
      '/api/employees',
      { method: 'POST', body: JSON.stringify(payload) }
    )
  },

  update(id: number, payload: UpdateEmployeePayload) {
    return apiFetch<{ success: boolean; message: string; employee: Employee }>(
      `/api/employees/${id}`,
      { method: 'PUT', body: JSON.stringify(payload) }
    )
  },

  /** Soft delete — marks employee as INACTIVE */
  delete(id: number) {
    return apiFetch<{ success: boolean; message: string; employee: Partial<Employee> }>(
      `/api/employees/${id}`,
      { method: 'DELETE' }
    )
  },

  /** Reactivate an INACTIVE employee */
  reactivate(id: number) {
    return apiFetch<{ success: boolean; message: string; employee: Partial<Employee> }>(
      `/api/employees/${id}/reactivate`,
      { method: 'PATCH' }
    )
  },

  /** Permanently delete an INACTIVE employee from the database */
  permanentDelete(id: number) {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/employees/${id}/permanent`,
      { method: 'DELETE' }
    )
  },

  syncToDevice() {
    return apiFetch<{ success: boolean; message: string; count?: number }>(
      '/api/employees/sync-to-device',
      { method: 'POST' }
    )
  },

  enrollFingerprint(id: number, fingerIndex?: number) {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/employees/${id}/enroll-fingerprint`,
      { method: 'POST', body: JSON.stringify({ fingerIndex: fingerIndex ?? 0 }) }
    )
  },

  enrollCard(id: number, cardNumber: number) {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/employees/${id}/enroll-card`,
      { method: 'POST', body: JSON.stringify({ cardNumber }) }
    )
  },
}