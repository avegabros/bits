'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'
import type { UserData, PasswordForm, PasswordStrength } from '../types'

const initialUserData: UserData = {
  firstName: '',
  lastName: '',
  email: '',
  role: '',
  contactNumber: '',
  branch: '',
  department: '',
  position: '',
}

export function useSettings() {
  const router = useRouter()
  const { toasts, showToast, dismissToast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  // User data from API
  const [userData, setUserData] = useState<UserData>(initialUserData)
  const [limits, setLimits] = useState<Record<string, number> | null>(null)
  // Backup for cancel
  const [originalData, setOriginalData] = useState<UserData>(initialUserData)

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current: '',
    new: '',
    confirm: '',
  })

  // Fetch real user data from API
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const [res, limitsRes] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/system/validation-limits', { credentials: 'include' }).catch(() => null)
        ])

        if (!res.ok) {
          router.replace('/login')
          return
        }

        if (limitsRes && limitsRes.ok) {
           const limitsData = await limitsRes.json()
           if (limitsData.success) {
               setLimits(limitsData.limits)
           }
        }

        const data = await res.json()
        const emp = data.employee ?? data
        const user: UserData = {
          firstName: emp.firstName || '',
          lastName: emp.lastName || '',
          email: emp.email || '',
          role: emp.role || '',
          contactNumber: emp.contactNumber || emp.phone || '',
          branch: emp.Branch?.name || '',
          department: emp.Department?.name || '',
          position: emp.position || '',
        }
        setUserData(user)
        setOriginalData(user)
      } catch {
        router.replace('/login')
      }
    }
    fetchUser()
  }, [router])

  const handleSaveProfile = async () => {
    if (!userData.firstName.trim() || !userData.lastName.trim()) {
      showToast('error', 'Validation Error', 'First name and last name are required.')
      return
    }

    if (limits) {
        if (userData.firstName.length > (limits.NAME_MAX_LENGTH ?? 50)) {
           showToast('error', 'Validation Error', `First name cannot exceed ${limits.NAME_MAX_LENGTH ?? 50} characters.`)
           return
        }
        if (userData.lastName.length > (limits.NAME_MAX_LENGTH ?? 50)) {
           showToast('error', 'Validation Error', `Last name cannot exceed ${limits.NAME_MAX_LENGTH ?? 50} characters.`)
           return
        }
        if (userData.contactNumber && userData.contactNumber.length > (limits.CONTACT_MAX_LENGTH ?? 20)) {
           showToast('error', 'Validation Error', `Contact number cannot exceed ${limits.CONTACT_MAX_LENGTH ?? 20} characters.`)
           return
        }
    }

    setIsSavingProfile(true)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: userData.firstName,
          lastName: userData.lastName,
          contactNumber: userData.contactNumber,
        }),
      })

      if (res.status === 401) {
        router.replace('/login')
        return
      }

      const data = await res.json()
      if (data.success) {
        setOriginalData(userData)
        setIsEditingProfile(false)
        showToast('success', 'Profile Updated', 'Profile updated successfully!')
        window.dispatchEvent(new Event('profileUpdate'))
      } else {
        showToast('error', 'Update Failed', data.message || 'Failed to update profile.')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      showToast('error', 'Update Failed', 'Failed to update profile.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      showToast('error', 'Validation Error', 'Please fill in all password fields.')
      return
    }

    if (passwordForm.new.length < (limits?.PASSWORD_MIN_LENGTH ?? 8)) {
      showToast('error', 'Validation Error', `New password must be at least ${limits?.PASSWORD_MIN_LENGTH ?? 8} characters.`)
      return
    }

    if (limits && passwordForm.new.length > (limits.PASSWORD_MAX_LENGTH ?? 100)) {
      showToast('error', 'Validation Error', `New password cannot exceed ${limits.PASSWORD_MAX_LENGTH ?? 100} characters.`)
      return
    }

    if (passwordForm.new !== passwordForm.confirm) {
      showToast('error', 'Validation Error', 'New passwords do not match!')
      return
    }

    setIsUpdatingPassword(true)

    try {
      const res = await fetch('/api/users/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new,
        }),
      })

      const data = await res.json()
      if (data.success) {
        showToast('success', 'Password Changed', 'Password changed successfully!')
        setPasswordForm({ current: '', new: '', confirm: '' })
      } else {
        showToast('error', 'Password Change Failed', data.message || 'Failed to change password.')
      }
    } catch (error) {
      console.error('Error changing password:', error)
      showToast('error', 'Password Change Failed', 'Failed to change password.')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const confirmCancel = () => {
    setUserData(originalData)
    setIsEditingProfile(false)
    setShowCancelModal(false)
  }

  // Password strength
  const getPasswordStrength = (pw: string): PasswordStrength => {
    if (!pw) return { label: '', color: '', width: '0%' }
    let score = 0
    if (pw.length >= (limits?.PASSWORD_MIN_LENGTH ?? 8)) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '25%' }
    if (score === 2) return { label: 'Fair', color: 'bg-yellow-500', width: '50%' }
    if (score === 3) return { label: 'Good', color: 'bg-blue-500', width: '75%' }
    return { label: 'Strong', color: 'bg-green-500', width: '100%' }
  }

  const strength = getPasswordStrength(passwordForm.new)
  const displayName = `${userData.firstName} ${userData.lastName}`.trim() || 'User'

  return {
    // User data
    userData, setUserData, originalData, displayName,
    // Profile editing
    isEditingProfile, setIsEditingProfile,
    isSavingProfile, handleSaveProfile,
    // Cancel modal
    showCancelModal, setShowCancelModal, confirmCancel,
    // Password
    passwordForm, setPasswordForm,
    showPassword, setShowPassword,
    isUpdatingPassword, handlePasswordChange,
    strength,
    // Toast
    toasts, showToast, dismissToast,
  }
}
