'use client'
import React, { useEffect, useState } from 'react'
import { activityBus } from '@/lib/auth/activityBus'

export function SessionExpiringWarning() {
  const [isOpen, setIsOpen] = useState(false)
  const [timeLeft, setTimeLeft] = useState(120) // 2 minutes

  useEffect(() => {
    const handleWarning = () => {
      setIsOpen(true)
      setTimeLeft(120)
    }
    
    window.addEventListener('session-expiring-warning', handleWarning)
    
    // Close the modal if activity is detected (e.g. from another tab)
    const handleActivity = () => {
      setIsOpen(false)
    }
    window.addEventListener('session-activity-resumed', handleActivity)

    return () => {
      window.removeEventListener('session-expiring-warning', handleWarning)
      window.removeEventListener('session-activity-resumed', handleActivity)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsOpen(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen])

  if (!isOpen) return null

  const handleExtend = () => {
    activityBus.signal()
    setIsOpen(false)
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
          <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <h3 className="text-lg font-bold text-slate-900">Session Expiring Soon</h3>
          <p className="mt-2 text-sm text-slate-500">
            You will be logged out in {minutes}:{seconds.toString().padStart(2, '0')} due to inactivity.
          </p>
        </div>
        <div className="mt-6">
          <button
            onClick={handleExtend}
            className="flex w-full items-center justify-center rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  )
}
