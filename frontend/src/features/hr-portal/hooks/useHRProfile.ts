import { useState, useEffect } from 'react'

export interface HRProfileData {
  firstName: string
  lastName: string
  middleName: string
  suffix: string
  role: string
  email: string
  phone: string
  branch: string
  hireDate: string
}

export function useHRProfile() {
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userData, setUserData] = useState<HRProfileData>({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    role: "HR",
    email: "",
    phone: "",
    branch: "",
    hireDate: "",
  })

  useEffect(() => {
    const savedImage = localStorage.getItem('userProfileImage')
    if (savedImage) setProfileImage(savedImage)

    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const emp = data.employee ?? data
          setUserData({
            firstName: emp.firstName || '',
            lastName: emp.lastName || '',
            middleName: emp.middleName || '',
            suffix: emp.suffix || '',
            role: emp.role || 'HR',
            email: emp.email || '',
            phone: emp.contactNumber || emp.phone || '',
            branch: emp.Branch?.name || '',
            hireDate: emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '',
          })
        }
      } catch (err) {
        console.error('Error fetching HR profile:', err)
      }
    }
    fetchUser()
  }, [])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setProfileImage(base64String)
        localStorage.setItem('userProfileImage', base64String)
        window.dispatchEvent(new Event('profileUpdate'))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleClearPhoto = (showToast: (type: 'success'|'error', title: string, msg: string) => void) => {
    setProfileImage(null)
    localStorage.removeItem('userProfileImage')
    window.dispatchEvent(new Event('profileUpdate'))
    showToast('success', 'Photo Removed', 'Profile photo removed!')
  }

  const handleSave = async (showToast: (type: 'success'|'error', title: string, msg: string) => void) => {
    setSaving(true)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: userData.firstName,
          lastName: userData.lastName,
          contactNumber: userData.phone,
        })
      })

      const data = await res.json()
      if (data.success) {
        setIsEditing(false)
        showToast('success', 'Profile Updated', 'Profile updated successfully!')
      } else {
        showToast('error', 'Update Failed', data.message || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      showToast('error', 'Update Failed', 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return {
    profileImage,
    isEditing,
    setIsEditing,
    saving,
    userData,
    setUserData,
    handleImageUpload,
    handleClearPhoto,
    handleSave,
  }
}
