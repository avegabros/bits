import { useState, useEffect } from 'react'
import { employeeSelfApi } from '@/lib/api'
import { PortalEmployeeProfile } from '../utils/portal-types'

export function useEmployeeProfile() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<PortalEmployeeProfile | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passMessage, setPassMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await employeeSelfApi.getProfile()
        if (res.success) {
          setProfile(res.profile as unknown as PortalEmployeeProfile)
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error(err.message)
        } else {
          console.error('An unexpected error occurred')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassMessage(null)

    if (newPassword !== confirmPassword) {
      setPassMessage({ type: 'error', text: 'New passwords do not match' })
      return
    }

    if (newPassword.length < 6) {
      setPassMessage({ type: 'error', text: 'New password must be at least 6 characters' })
      return
    }

    setPassLoading(true)
    try {
      const res = await employeeSelfApi.changePassword(currentPassword, newPassword)

      if (!res.success) {
        setPassMessage({ type: 'error', text: res.message || 'Failed to change password' })
      } else {
        setPassMessage({ type: 'success', text: 'Password changed successfully!' })
        const wasForcedChange = profile?.needsPasswordChange
        
        if (profile) {
          setProfile({ ...profile, needsPasswordChange: false })
        }
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')

        if (wasForcedChange) {
          setTimeout(() => {
            window.location.href = '/employee/dashboard'
          }, 1500)
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPassMessage({ type: 'error', text: err.message || 'An error occurred while changing password' })
      } else {
        setPassMessage({ type: 'error', text: 'An unexpected error occurred' })
      }
    } finally {
      setPassLoading(false)
    }
  }

  return {
    loading,
    profile,
    setProfile,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passLoading,
    passMessage,
    showCurrentPassword,
    setShowCurrentPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handleChangePassword
  }
}
