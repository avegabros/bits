'use client'

import { useState, useEffect, useCallback } from 'react'
import { Employee } from '../utils/employee-types'

interface UseEmployeeProfileResult {
  employee: Employee | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useEmployeeProfile(id: number): UseEmployeeProfileResult {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEmployee = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/employees/${id}`, { credentials: 'include' })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const data = await res.json()
      if (data.success) {
        setEmployee(data.employee)
      } else {
        setError(data.message || 'Failed to load employee')
      }
    } catch (err) {
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) fetchEmployee()
  }, [id, fetchEmployee])

  return { employee, loading, error, refresh: fetchEmployee }
}
