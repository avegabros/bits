// ─── Centralized API Client ──────────────────────────────────────────────────
// Single source of truth for all backend API calls.
// Automatically authenticates via HttpOnly cookie (credentials: 'include').
// Backend base URL is proxied by Next.js rewrites: /api/* → http://backend:3001/api/*

// ─── Types ───────────────────────────────────────────────────────────────────
export type Role = 'ADMIN' | 'HR' | 'USER'
export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED'

export interface Branch {
  id: number
  name: string
  createdAt?: string
  updatedAt?: string
}

export interface Department {
  id: number
  name: string
  createdAt?: string
  updatedAt?: string
}

export interface Employee {
  id: number
  zkId: number | null
  cardNumber: number | null
  employeeNumber: string | null
  firstName: string
  lastName: string
  email: string | null
  role: Role
  departmentId: number | null
  Department?: { name: string } | null
  position: string | null
  branchId: number | null
  Branch?: { name: string } | null
  contactNumber: string | null
  hireDate: string | null
  employmentStatus: EmploymentStatus
  profilePicture: string | null
  createdAt: string
  updatedAt?: string
}

export interface AttendanceRecord {
  id: number
  employeeId: number
  date: string
  checkInTime: string
  checkOutTime: string | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'departmentId' | 'Department' | 'branchId' | 'Branch'>
}

export interface User {
  id: number
  firstName: string
  lastName: string
  email: string | null
  role: Role
  employmentStatus: EmploymentStatus
  status: 'active' | 'inactive'
  createdAt: string
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Core Fetch Helper ───────────────────────────────────────────────────────
export type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const res = await fetch(path, { ...options, headers, credentials: 'include' })

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

  return res.json() as Promise<T>
}
