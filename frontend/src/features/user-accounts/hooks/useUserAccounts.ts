import { useState, useCallback } from 'react'
import { UserAccount } from '../utils/user-types'
import { useToast } from '@/hooks/useToast'

interface SaveUserPayload {
  firstName: string
  lastName: string
  email: string
  role: string
  password?: string
}

export function useUserAccounts() {
  const { toasts, showToast, dismissToast } = useToast()
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users', { credentials: 'include' })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
      } else {
        console.error('Failed to fetch users:', data.message)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const saveUser = async (formData: SaveUserPayload, editingUserId: number | null) => {
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : '/api/users'
      const method = editingUserId ? 'PUT' : 'POST'
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        role: formData.role,
      }
      if (formData.password) {
        body.password = formData.password
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        await fetchUsers()
        showToast(
          'success', 
          editingUserId ? 'Account Updated' : 'Account Created', 
          editingUserId ? 'User account updated successfully' : 'User account created successfully'
        )
        return { success: true, userId: data.user?.id || editingUserId }
      } else {
        return { success: false, message: data.message || 'Failed to save user' }
      }
    } catch (error) {
      console.error('Error saving user:', error)
      return { success: false, message: 'Failed to save user' }
    }
  }

  const toggleStatus = async (userId: number, currentStatus: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/toggle-status`, {
        method: 'PATCH',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        await fetchUsers()
        showToast(
          'success', 
          'Status Updated', 
          `Account ${currentStatus === 'active' ? 'deactivated' : 'activated'} successfully`
        )
        return { success: true }
      } else {
        showToast('error', 'Toggle Failed', data.message || 'Failed to toggle status')
        return { success: false, message: data.message || 'Failed to toggle status' }
      }
    } catch (error) {
      console.error('Error toggling status:', error)
      return { success: false, message: 'Unknown error occurred' }
    }
  }

  return {
    users,
    loading,
    fetchUsers,
    saveUser,
    toggleStatus,
    toasts,
    dismissToast,
  }
}
