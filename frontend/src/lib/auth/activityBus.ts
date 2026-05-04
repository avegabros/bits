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

  constructor() {
    this.lastActivityMs = typeof Date !== 'undefined' ? Date.now() : 0;
  }

  // Initialize the bus with callbacks
  init(onTimeout: TimeoutCallback, onWarning: WarningCallback) {
    this.onTimeoutCb = onTimeout;
    this.onWarningCb = onWarning;
    this.startTimers();
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

  private startTimers() {
    this.clearTimers();
    if (!this.onTimeoutCb) return; // Not fully initialized yet

    this.warningRef = setTimeout(() => {
      if (this.onWarningCb) this.onWarningCb();
    }, this.INACTIVITY_TIMEOUT_MS - this.WARNING_LEAD_MS);

    this.timeoutRef = setTimeout(() => {
      if (this.onTimeoutCb) this.onTimeoutCb();
    }, this.INACTIVITY_TIMEOUT_MS);
  }

  private clearTimers() {
    if (this.warningRef) clearTimeout(this.warningRef);
    if (this.timeoutRef) clearTimeout(this.timeoutRef);
  }

  destroy() {
    this.clearTimers();
    this.onTimeoutCb = null;
    this.onWarningCb = null;
  }
}

export const activityBus = new ActivityBus();
