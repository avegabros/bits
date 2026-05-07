import React from 'react'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { useLogin } from '../hooks/useLogin'

interface LoginFormProps {
  loginState: ReturnType<typeof useLogin>
}

export function LoginForm({ loginState }: LoginFormProps) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    togglePasswordVisibility,
    validationErrors,
    setValidationErrors,
    isLoading,
    handleSubmit
  } = loginState

  return (
    <>
      <div className="relative mb-9">
        <div className="flex items-center gap-2">
          <User className="h-7 w-7 text-red-600" />
          <h1 className="text-2xl font-bold text-gray-700">User Login</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-600" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (validationErrors.email) {
                  setValidationErrors({
                    ...validationErrors,
                    email: '',
                  })
                }
              }}
              disabled={isLoading}
              className="w-full border-b-2 border-gray-500 bg-transparent py-3 pl-12 pr-4 text-gray-800 placeholder-gray-900 focus:border-red-600 focus:outline-none disabled:opacity-50"
            />
          </div>
          {validationErrors.email && (
            <p className="mt-2 text-xs text-red-600">{validationErrors.email}</p>
          )}
        </div>

        <div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-600" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (validationErrors.password) {
                  setValidationErrors({
                    ...validationErrors,
                    password: '',
                  })
                }
              }}
              disabled={isLoading}
              className="w-full border-b-2 border-gray-500 bg-transparent py-3 pl-12 pr-12 text-gray-800 placeholder-gray-900 focus:border-red-600 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-red-600 disabled:opacity-50 cursor-pointer"
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

        <div className="flex justify-center pt-6">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-block rounded-full bg-red-600 px-8 py-3 font-bold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? 'LOGGING IN...' : 'LOG IN'}
          </button>
        </div>
      </form>

      <p className="mt-8 text-center text-xs text-gray-600">
        Biometric Integrated Timekeeping System Web Portal
      </p>
    </>
  )
}
