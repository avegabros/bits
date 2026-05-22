/**
 * Shared Refresh Token Lock
 *
 * Single source of truth for ALL token refresh calls across the app.
 * Prevents the race condition where multiple code paths (proactive timer,
 * visibility-change handler, global fetch interceptor) simultaneously
 * call /api/auth/refresh and collide on the backend's one-time-use
 * token rotation logic.
 *
 * Features:
 *   - Promise-based deduplication: concurrent calls share one in-flight request
 *   - Post-success cooldown: prevents rapid-fire refreshes within COOLDOWN_MS
 */

/** Minimum time between successful refreshes (ms) */
const COOLDOWN_MS = 30_000 // 30 seconds

let refreshPromise: Promise<boolean> | null = null
let lastSuccessfulRefreshMs = 0

/**
 * Attempt to refresh the auth token.
 *
 * - If a refresh is already in-flight, returns the existing promise (dedup).
 * - If a refresh succeeded within the last COOLDOWN_MS, returns true immediately.
 * - Otherwise, calls /api/auth/refresh and returns whether it succeeded.
 *
 * @returns true if the token was refreshed (or recently refreshed), false if refresh failed
 */
export async function tryRefreshToken(): Promise<boolean> {
  // Cooldown — skip if we refreshed very recently
  if (Date.now() - lastSuccessfulRefreshMs < COOLDOWN_MS) {
    return true
  }

  // Dedup — share the in-flight promise
  if (refreshPromise) return refreshPromise

  refreshPromise = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })
    .then(res => {
      if (res.ok) {
        lastSuccessfulRefreshMs = Date.now()
        return true
      }
      return false
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}
