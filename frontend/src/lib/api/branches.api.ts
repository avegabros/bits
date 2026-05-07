import { apiFetch, Employee, Department, Branch, Role, EmploymentStatus, AttendanceRecord, User, PaginationMeta } from './client';

// ─── Branches ────────────────────────────────────────────────────────────────

export interface GetBranchesResponse {
  success: boolean
  branches: Branch[]
}

export const branchesApi = {
  getAll() {
    return apiFetch<GetBranchesResponse>('/api/branches')
  },

  create(name: string) {
    return apiFetch<{ success: boolean; branch: Branch }>(
      '/api/branches',
      { method: 'POST', body: JSON.stringify({ name }) }
    )
  },

  delete(id: number) {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/branches/${id}`,
      { method: 'DELETE' }
    )
  },
}