'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Employee {
  id: number
  firstName: string
  lastName: string
  email: string
  role: 'USER' | 'ADMIN' | 'HR' | 'MANAGER'
  needsPasswordChange: boolean
}

interface AuthState {
  isLoading: boolean
  isAuthenticated: boolean
  employee: Employee | null
}

type Role = 'ADMIN' | 'HR' | 'USER' | 'MANAGER';

/**
 * Auth guard hook. Verifies session by calling /api/auth/me (reads HttpOnly cookie).
 * The actual auth token is an HttpOnly cookie — invisible to JS.
 * Redirects to /login if the session check fails or role doesn't match.
 *
 * @param requiredRole - If provided, only allows users with this role (or one of the roles if array)
 */
export function useAuth(requiredRole?: Role | Role[]): AuthState {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    employee: null,
  })

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (!res.ok) {
          router.replace('/login')
          return
        }
        const data = await res.json()
        const employee: Employee = data.employee ?? data

        if (requiredRole) {
          const isAllowed = Array.isArray(requiredRole) 
              ? requiredRole.includes(employee.role)
              : employee.role === requiredRole;
              
          if (!isAllowed) {
            router.replace('/login')
            return
          }
        }

        setState({ isLoading: false, isAuthenticated: true, employee })
      } catch {
        router.replace('/login')
      }
    }
    verify()
  }, [router, requiredRole])

  return state
}
