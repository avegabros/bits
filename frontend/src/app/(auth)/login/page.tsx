'use client'

import type React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email'
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
      const res = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Handle access denied (403) with specific message
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

      // Store token and employee data
      localStorage.setItem('token', data.accessToken)
      localStorage.setItem('employee', JSON.stringify(data.employee))

      // Role-based redirect
      if (data.employee.role === 'HR') {
        router.push('/hr')
      } else if (data.employee.role === 'ADMIN') {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    } catch (error: any) {
      setValidationErrors({
        ...validationErrors,
        password: 'Network error. Please check if backend is running.',
      })
      setIsLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    // Remove demo login or update it to use real credentials
    setEmail('admin@bits.com')
    setPassword('admin123')

    // Trigger form submission
    const event = { preventDefault: () => { } } as React.FormEvent
    await handleSubmit(event)
  }

  return (
    <div className="relative min-h-screen w-full overflow-y-auto">
      {/* Background Image with adjustable opacity */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(/placeholder.svg?height=1080&width=1920&query=city_skyline_background)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.3,
        }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 z-0 bg-linear-to-r from-gray-200 to-gray-900" />

      {/* Content Container - Centered Card */}
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-4">
        <div className="w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl">
          <div className="flex flex-col md:flex-row">
            {/* Left Side - Login Form */}
            <div className="flex w-full flex-col items-center justify-center bg-white/5 px-6 py-12 backdrop-blur-md md:w-1/2 md:px-9 md:py-16">
              <div className="w-full max-w-sm">
                {/* Header */}
                <div className="relative mb-9">
                  <div className="flex items-center gap-2">
                    <User className="h-7 w-7 text-red-600" />
                    <h1 className="text-2xl font-bold text-gray-700">User Login</h1>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Email Field */}
                  <div>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-600" />
                      <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (validationErrors.email)
                            setValidationErrors({
                              ...validationErrors,
                              email: '',
                            })
                        }}
                        disabled={isLoading}
                        className="w-full border-b-2 border-gray-500 bg-transparent py-3 pl-12 pr-4 text-gray-800 placeholder-gray-900 focus:border-red-600 focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    {validationErrors.email && (
                      <p className="mt-2 text-xs text-red-600">{validationErrors.email}</p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-600" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (validationErrors.password)
                            setValidationErrors({
                              ...validationErrors,
                              password: '',
                            })
                        }}
                        disabled={isLoading}
                        className="w-full border-b-2 border-gray-500 bg-transparent py-3 pl-12 pr-12 text-gray-800 placeholder-gray-900 focus:border-red-600 focus:outline-none disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-red-600 disabled:opacity-50"
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {validationErrors.password && (
                      <p className="mt-2 text-xs text-red-600">{validationErrors.password}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-center pt-6">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="inline-block rounded-full bg-red-600 px-8 py-3 font-bold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'LOGGING IN...' : 'LOG IN'}
                    </button>
                  </div>
                </form>

                {/* Footer */}
                <p className="mt-8 text-center text-xs text-gray-600">
                  Only ADMIN and HR personnel can access this system
                </p>
              </div>
            </div>

            {/* Right Side - Logo and Description (Solid Red Box) */}
            <div className="flex w-full flex-col items-center justify-center bg-gray-600 px-6 py-12 md:w-1/2 md:px-10 md:py-16">
              <div className="w-full max-w-sm text-center">
                {/* Logo Placeholder */}
                <div className="mb-8 flex h-50 w-full items-center justify-center rounded-lg bg-red">
                  <img
                    src="/images/av.jpg"
                    alt="Company Logo"
                    className="h-full w-full object-contain p-4"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23DC2626" width="200" height="200"/%3E%3Ctext x="50%" y="50%" fontSize="48" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold"%3EAB%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>

                {/* Description Text */}
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-300">AVEGA BROS.</h2>
                  <p className="text-sm leading-relaxed text-gray-300">
                    Biometric Integrated Timekeeping System
                  </p>
                  <p className="text-xs text-gray-400">© 2026 Developed by AVEGA BROS. IT Interns</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}