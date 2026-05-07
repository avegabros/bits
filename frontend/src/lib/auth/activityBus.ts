export type TimeoutCallback = () => void;
export type WarningCallback = () => void;

class ActivityBus {
  private timeoutRef: NodeJS.Timeout | null = null;
  private warningRef: NodeJS.Timeout | null = null;
  private lastActivityMs: number;
  
  private onTimeoutCb: TimeoutCallback | null = null;
  private onWarningCb: WarningCallback | null = null;

  private readonly INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
  private readonly WARNING_LEAD_MS = 2 * 60 * 1000; // 2 minutes before timeout
  private readonly THROTTLE_MS = 5000; // Update at most once every 5 seconds

  /** Bound handler for visibilitychange — stored so we can remove it in destroy() */
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.lastActivityMs = typeof Date !== 'undefined' ? Date.now() : 0;
  }

  // Initialize the bus with callbacks
  init(onTimeout: TimeoutCallback, onWarning: WarningCallback) {
    this.onTimeoutCb = onTimeout;
    this.onWarningCb = onWarning;
    this.startTimers();
    this.attachVisibilityHandler();
  }

  // Signal activity from DOM, API, or Cross-Tab
  signal(broadcast = true) {
    const now = Date.now();
    if (now - this.lastActivityMs < this.THROTTLE_MS) return;
    
    this.lastActivityMs = now;
    this.startTimers();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('session-activity-resumed'));
    }

    if (broadcast) {
       // Lazy import to prevent circular dependency issues during initialization
       import('./authChannel').then(({ authChannel }) => {
           authChannel.broadcastActivity(now);
       }).catch(() => { /* ignore */ });
    }
  }

  // Handle cross-tab incoming activity without re-broadcasting
  syncActivity(timestamp: number) {
    if (timestamp > this.lastActivityMs) {
      this.lastActivityMs = timestamp;
      this.startTimers();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('session-activity-resumed'));
      }
    }
  }

  /**
   * Recalculate timers based on actual wall-clock elapsed time.
   *
   * Browsers throttle setTimeout in background tabs (delays of 1+ minute
   * are common). When the tab becomes visible again, calling this method
   * ensures timers reflect real elapsed time rather than the browser's
   * throttled schedule.
   *
   * - If the full inactivity timeout has passed → fire immediately.
   * - If only the warning threshold has passed → fire warning, set remaining timeout.
   * - Otherwise → restart timers with the correct remaining durations.
   */
  private recalculateTimers() {
    if (!this.onTimeoutCb) return;

    const now = Date.now();
    const elapsed = now - this.lastActivityMs;

    if (elapsed >= this.INACTIVITY_TIMEOUT_MS) {
      // User was genuinely inactive for the full timeout duration
      this.clearTimers();
      this.onTimeoutCb();
      return;
    }

    if (elapsed >= this.INACTIVITY_TIMEOUT_MS - this.WARNING_LEAD_MS) {
      // Past warning threshold but not yet timed out — show warning
      // and set a timer for the remaining time until full timeout.
      this.clearTimers();
      if (this.onWarningCb) this.onWarningCb();
      const remaining = this.INACTIVITY_TIMEOUT_MS - elapsed;
      this.timeoutRef = setTimeout(() => {
        if (this.onTimeoutCb) this.onTimeoutCb();
      }, remaining);
      return;
    }

    // Still within the safe window — restart timers with correct remaining durations.
    // This replaces any stale throttled timers with accurate ones.
    this.startTimers(elapsed);
  }

  /**
   * Attach a visibilitychange listener to recalculate timers when the tab
   * returns to the foreground. This is idempotent — safe to call multiple times.
   */
  private attachVisibilityHandler() {
    if (typeof document === 'undefined' || this.visibilityHandler) return;

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.recalculateTimers();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * Start the warning and timeout timers.
   *
   * @param elapsedMs - Optional. If provided, timers are set for the REMAINING
   *   duration (INACTIVITY_TIMEOUT_MS - elapsedMs) instead of the full duration.
   *   Used by recalculateTimers() to set accurate timers on tab return.
   */
  private startTimers(elapsedMs = 0) {
    this.clearTimers();
    if (!this.onTimeoutCb) return; // Not fully initialized yet

    const remainingTimeout = this.INACTIVITY_TIMEOUT_MS - elapsedMs;
    const remainingWarning = remainingTimeout - this.WARNING_LEAD_MS;

    if (remainingWarning > 0) {
      this.warningRef = setTimeout(() => {
        if (this.onWarningCb) this.onWarningCb();
      }, remainingWarning);
    }

    if (remainingTimeout > 0) {
      this.timeoutRef = setTimeout(() => {
        if (this.onTimeoutCb) this.onTimeoutCb();
      }, remainingTimeout);
    }
  }

  private clearTimers() {
    if (this.warningRef) clearTimeout(this.warningRef);
    if (this.timeoutRef) clearTimeout(this.timeoutRef);
  }

  destroy() {
    this.clearTimers();
    this.onTimeoutCb = null;
    this.onWarningCb = null;
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}

export const activityBus = new ActivityBus();
