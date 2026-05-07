'use client'
import React, { useEffect, useState } from 'react'

export function SessionExpiredModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleExpired = () => setIsOpen(true)
    window.addEventListener('session-expired', handleExpired)
    return () => window.removeEventListener('session-expired', handleExpired)
  }, [])

  if (!isOpen) return null

  const handleLogin = async () => {
    // Optionally call logout to clear cookies before redirecting
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* ignore */ }
    window.location.href = '/login'
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <h3 className="text-lg font-bold text-slate-900">Session Expired</h3>
          <p className="mt-2 text-sm text-slate-500">
            Your session has expired or you have been logged out due to inactivity. Please log in again to continue.
          </p>
        </div>
        <div className="mt-6">
          <button
            onClick={handleLogin}
            className="flex w-full items-center justify-center rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors"
          >
            Log In Again
          </button>
        </div>
      </div>
    </div>
  )
}
