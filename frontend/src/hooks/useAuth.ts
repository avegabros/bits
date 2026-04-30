'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, SessionExpiredError } from '@/lib/api/client'

// Minimal employee shape returned by /api/auth/me
interface AuthEmployee {
  id: number
  firstName: string
  lastName: string
  email: string
  role: 'USER' | 'ADMIN' | 'HR'
  needsPasswordChange: boolean
}

interface AuthState {
  isLoading: boolean
  isAuthenticated: boolean
  employee: AuthEmployee | null
}

/**
 * Auth guard hook. Verifies session by calling /api/auth/me via apiFetch,
 * which automatically handles silent token refresh (including the shared
 * refreshPromise lock that prevents race conditions on simultaneous 401s).
 *
 * Redirects to /login if the session check fails or role doesn't match.
 *
 * @param requiredRole - If provided, only allows users with this role
 */
export function useAuth(requiredRole?: 'ADMIN' | 'HR' | 'USER'): AuthState {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    employee: null,
  })

  useEffect(() => {
    const verify = async () => {
      try {
        // Use apiFetch so the 401 → refresh → retry logic and the shared
        // refreshPromise lock are applied here too. This prevents the race
        // condition where useAuth and page data hooks both try to refresh
        // the (one-time-use) refresh token simultaneously.
        const data = await apiFetch<{ employee: AuthEmployee }>('/api/auth/me')
        const employee: AuthEmployee = data.employee ?? (data as unknown as AuthEmployee)

        if (requiredRole && employee.role !== requiredRole) {
          router.replace('/login')
          return
        }

        setState({ isLoading: false, isAuthenticated: true, employee })
      } catch (error) {
        if (error instanceof SessionExpiredError) {
          // All refresh attempts failed — notify any listening UI (Task 7 modal)
          window.dispatchEvent(new CustomEvent('session-expired'))
          // Do NOT redirect here, let the modal handle it gracefully
        } else {
          router.replace('/login')
        }
      }
    }
    verify()
  }, [router, requiredRole])

  return state
}
