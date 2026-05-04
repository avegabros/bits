'use client'
import { useEffect, useRef } from 'react'

/**
 * Proactively refreshes the access token ~10 minutes before it expires,
 * so the user never hits a 401 mid-session.
 *
 * Access token TTL = 60 min → refresh every 50 min.
 * Also refreshes when a hidden tab becomes visible again, with a random
 * jitter delay (0–2500ms) so multiple tabs don't hammer the refresh
 * endpoint simultaneously and trigger rate-limit (429) errors.
 */
const REFRESH_INTERVAL_MS = 50 * 60 * 1000 // 50 minutes
const VISIBILITY_JITTER_MAX_MS = 2500       // Spread tab refreshes over 2.5s

export function useTokenRefresh() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const jitterRef   = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const doRefresh = async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        })
        // Only treat a true 401 as a dead session.
        // 429 (rate-limit) and other transient errors are skipped —
        // the reactive fetch interceptor in client.ts handles the next
        // real API call if the token truly expired.
        if (res.status === 401) {
          window.dispatchEvent(new CustomEvent('session-expired'))
        }
      } catch {
        // Network error — skip this cycle; do not expire the session.
      }
    }

    // Start the proactive refresh interval
    intervalRef.current = setInterval(doRefresh, REFRESH_INTERVAL_MS)

    // When a tab becomes visible again the browser may have throttled or
    // skipped interval ticks, so we refresh — but with a random jitter so
    // multiple open tabs don't all call the endpoint at the exact same time.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const jitter = Math.random() * VISIBILITY_JITTER_MAX_MS
        jitterRef.current = setTimeout(doRefresh, jitter)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (jitterRef.current)   clearTimeout(jitterRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])
}
