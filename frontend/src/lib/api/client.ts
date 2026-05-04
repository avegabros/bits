// ─── Centralized API Client ──────────────────────────────────────────────────
// Single source of truth for all backend API calls.
// Automatically authenticates via HttpOnly cookie (credentials: 'include').
// Backend base URL is proxied by Next.js rewrites: /api/* → http://backend:3001/api/*

import { activityBus } from '../auth/activityBus'

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

// ─── Session Error ───────────────────────────────────────────────────────────
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired. Please log in again.')
    this.name = 'SessionExpiredError'
  }
}

// ─── Refresh Lock ────────────────────────────────────────────────────────────
// Prevents multiple simultaneous refresh calls when several API requests
// all get 401 at the same time.
let refreshPromise: Promise<boolean> | null = null

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise

  refreshPromise = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
    .then(res => res.ok)
    .catch(() => false)
    .finally(() => { refreshPromise = null })

  return refreshPromise
}

// ─── Global Fetch Interceptor ────────────────────────────────────────────────
// Many components and hooks (like useDashboardData) use raw fetch() instead of apiFetch.
// This global interceptor ensures EVERY client-side fetch to our API automatically
// handles 401s, silently refreshes the token, and retries the original request.
if (typeof window !== 'undefined') {
  const win = window as any;
  if (!win.__FETCH_INTERCEPTED__) {
    win.__FETCH_INTERCEPTED__ = true;
    const originalFetch = window.fetch;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

      // Skip interception for non-API requests or the refresh route itself
      if (!url.includes('/api/') || url.includes('/api/auth/refresh')) {
        return originalFetch.apply(this, [input, init]);
      }

      // 1. Make the original request
      let response = await originalFetch.apply(this, [input, init]);

      // Step 3: API Activity Signal
      if (response.ok && !url.includes('/api/auth/')) {
        activityBus.signal();
      }

      // 2. If 401 Unauthorized, attempt a silent refresh
      if (response.status === 401) {
        const refreshed = await tryRefreshToken();
        
        if (refreshed) {
          // 3. Retry the exact same request with the new HttpOnly cookies
          // Note: If the original request consumed a ReadableStream body, retrying might 
          // fail without cloning, but 99% of our 401s are GETs or stringified JSON POSTs.
          response = await originalFetch.apply(this, [input, init]);
        } else {
          // 4. If refresh fails, session is completely dead
          window.dispatchEvent(new CustomEvent('session-expired'));
        }
      }

      return response;
    };
  }
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

  // The global fetch interceptor above automatically handles 401s for this
  const res = await fetch(path, { ...options, headers, credentials: 'include' })

  if (!res.ok) {
    if (res.status === 401) throw new SessionExpiredError()

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
