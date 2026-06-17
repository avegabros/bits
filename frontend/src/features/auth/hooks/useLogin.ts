import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function useLogin() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  const [redirectPath, setRedirectPath] = useState('')

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    const trimmed = identifier.trim()

    if (!trimmed) {
      newErrors.identifier = 'Email or Employee ID is required'
    } else if (trimmed.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        newErrors.identifier = 'Please enter a valid email address'
      }
    } else {
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(trimmed)) {
        newErrors.identifier = 'Employee ID must be 3-20 characters (letters, numbers, -, _)'
      }
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          setValidationErrors({
            ...validationErrors,
            password: data.message || 'Access denied',
          })
          setIsLoading(false)
          return
        }
        setValidationErrors({
          ...validationErrors,
          password: data.message || 'Login failed',
        })
        setIsLoading(false)
        return
      }

      // Determine redirect path
      let path = '/login'
      if (data.employee.needsPasswordChange) {
        path = '/employee/profile'
      } else if (data.employee.role === 'HR') {
        path = '/hr'
      } else if (data.employee.role === 'MANAGER') {
        path = '/manager/dashboard'
      } else if (data.employee.role === 'ADMIN') {
        path = '/dashboard'
      } else if (data.employee.role === 'USER') {
        path = '/employee'
      }

      setRedirectPath(path)
      // Show continuous loading screen during client-side transition
      setShowLoading(true)
      router.push(path)
    } catch (error: any) {
      setValidationErrors({
        ...validationErrors,
        password: 'Network error. Please check if backend is running.',
      })
      setIsLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return {
    identifier,
    setIdentifier,
    password,
    setPassword,
    showPassword,
    togglePasswordVisibility,
    validationErrors,
    setValidationErrors,
    isLoading,
    showLoading,
    handleSubmit
  }
}
