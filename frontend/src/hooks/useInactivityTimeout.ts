'use client'
import { useEffect, useRef, useCallback } from 'react'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 
const THROTTLE_MS = 5000 // Update at most once per second

export function useInactivityTimeout() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const handleTimeout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch { /* best effort */ }
    window.dispatchEvent(new CustomEvent('session-expired'))
  }, [])

  const resetTimer = useCallback(() => {
    const now = Date.now()
    if (now - lastActivityRef.current < THROTTLE_MS) return
    lastActivityRef.current = now

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(handleTimeout, INACTIVITY_TIMEOUT_MS)
  }, [handleTimeout])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    
    // Set initial timer
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(handleTimeout, INACTIVITY_TIMEOUT_MS)

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [resetTimer, handleTimeout])
}
