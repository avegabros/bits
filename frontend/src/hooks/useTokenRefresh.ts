'use client'
import { useEffect, useRef } from 'react'

/**
 * Proactively refreshes the access token ~10 minutes before it expires,
 * so the user never hits a 401 mid-session.
 *
 * Access token TTL = 60 min → refresh every 50 min.
 * Also refreshes immediately when a hidden tab becomes visible again,
 * since the interval may have been throttled by the browser.
 */
const REFRESH_INTERVAL_MS = 50 * 60 * 1000 // 50 minutes

export function useTokenRefresh() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const doRefresh = async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        })
        if (!res.ok) {
          // Refresh token is gone / expired — notify the session-expired modal
          window.dispatchEvent(new CustomEvent('session-expired'))
        }
      } catch {
        // Network error — skip this cycle, do not expire the session.
        // The reactive interceptor in client.ts will handle it on the next API call.
      }
    }

    // Start the proactive refresh interval
    intervalRef.current = setInterval(doRefresh, REFRESH_INTERVAL_MS)

    // When the tab becomes visible again after being hidden, the browser may
    // have throttled or skipped interval ticks — refresh immediately.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        doRefresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])
}
