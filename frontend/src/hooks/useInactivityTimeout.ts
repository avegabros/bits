'use client'
import { useEffect, useCallback } from 'react'
import { activityBus } from '@/lib/auth/activityBus'
import { authChannel } from '@/lib/auth/authChannel'

export function useInactivityTimeout() {
  const handleTimeout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch { /* best effort */ }
    
    // Broadcast logout to other tabs
    authChannel.broadcastLogout()
    window.dispatchEvent(new CustomEvent('session-expired'))
  }, [])

  const handleWarning = useCallback(() => {
    window.dispatchEvent(new CustomEvent('session-expiring-warning'))
  }, [])

  useEffect(() => {
    // Initialize cross-tab channel (idempotent — safe to call on remount)
    authChannel.init()

    // Re-register callbacks on the singleton bus (safe to call on remount)
    activityBus.init(handleTimeout, handleWarning)

    const handleActivity = () => {
      activityBus.signal()
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    return () => {
      // Only remove DOM listeners on cleanup.
      // Do NOT destroy the activityBus or authChannel singletons here —
      // they must survive React remounts (e.g. Next.js page navigation)
      // to keep the 30-minute idle timer and BroadcastChannel connection alive.
      events.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, [handleTimeout, handleWarning])
}
