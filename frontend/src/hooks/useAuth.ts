'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Employee {
  id: number
  firstName: string
  lastName: string
  email: string
  role: 'USER' | 'ADMIN' | 'HR'
}

interface AuthState {
  isLoading: boolean
  isAuthenticated: boolean
  employee: Employee | null
}

/**
 * Auth guard hook. Checks localStorage for token + employee data.
 * Redirects to /login if not authenticated or if role doesn't match.
 * 
 * @param requiredRole - If provided, only allows users with this role
 */
export function useAuth(requiredRole?: 'ADMIN' | 'HR'): AuthState {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    employee: null,
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    const employeeStr = localStorage.getItem('employee')

    if (!token || !employeeStr) {
      router.replace('/login')
      return
    }

    try {
      const employee: Employee = JSON.parse(employeeStr)

      // Check role if required
      if (requiredRole && employee.role !== requiredRole) {
        router.replace('/login')
        return
      }

      setState({
        isLoading: false,
        isAuthenticated: true,
        employee,
      })
    } catch {
      // Invalid data in localStorage
      localStorage.removeItem('token')
      localStorage.removeItem('employee')
      router.replace('/login')
    }
  }, [router, requiredRole])

  return state
}
