'use client'
import { useEffect, useRef } from 'react'
import { tryRefreshToken } from '@/lib/auth/refreshLock'

/**
 * Proactively refreshes the access token ~10 minutes before it expires,
 * so the user never hits a 401 mid-session.
 *
 * Access token TTL = 60 min → refresh every 50 min.
 *
 * Also refreshes when a hidden tab becomes visible again, with a random
 * jitter delay (0–2500ms) so multiple tabs don't hammer the refresh
 * endpoint simultaneously.
 *
 * KEY DESIGN RULE:
 *   This hook NEVER fires 'session-expired'. Proactive refreshes are
 *   best-effort — if they fail, the reactive 401 interceptor in client.ts
 *   handles it on the next real API call. This prevents false logouts
 *   when another tab already rotated the token or when a race condition
 *   causes a transient 401.
 *
 * Uses the shared tryRefreshToken() lock from refreshLock.ts to prevent
 * collisions with the global fetch interceptor's refresh path.
 */
const REFRESH_INTERVAL_MS = 50 * 60 * 1000 // 50 minutes
const VISIBILITY_JITTER_MAX_MS = 2500       // Spread tab refreshes over 2.5s

export function useTokenRefresh() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const jitterRef   = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    /** Start (or restart) the proactive refresh interval */
    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        // Fire-and-forget — tryRefreshToken handles dedup + cooldown
        void tryRefreshToken()
      }, REFRESH_INTERVAL_MS)
    }

    // Initial start
    startInterval()

    // When a tab becomes visible again the browser may have throttled or
    // skipped interval ticks, so we refresh — but with a random jitter so
    // multiple open tabs don't all call the endpoint at the exact same time.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const jitter = Math.random() * VISIBILITY_JITTER_MAX_MS
        if (jitterRef.current) clearTimeout(jitterRef.current)
        jitterRef.current = setTimeout(() => {
          // tryRefreshToken() has a 30-second cooldown built in, so if the
          // interceptor just refreshed, this is a no-op. No session-expired
          // event is fired regardless of outcome.
          void tryRefreshToken()
          // Reset the interval to count from now, preventing rapid-fire
          // refreshes if the interval was about to fire anyway.
          startInterval()
        }, jitter)
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
