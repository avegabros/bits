// ── System Configuration Boundaries ─────────────────────────
// These constants define the valid ranges for all system settings.
// They are used by:
//   - Backend Zod validation schema (system.controller.ts)
//   - Frontend DurationInput constraints (via API or shared import)

export const SYNC_LIMITS = {
    DEFAULT_INTERVAL_MIN_SEC: 10,
    DEFAULT_INTERVAL_MAX_SEC: 86400, // 24 hours
    HIGH_FREQ_INTERVAL_MIN_SEC: 10,
    HIGH_FREQ_INTERVAL_MAX_SEC: 86400, // 24 hours
    LOW_FREQ_INTERVAL_MIN_SEC: 60,
    LOW_FREQ_INTERVAL_MAX_SEC: 86400, // 24 hours
    TIME_SYNC_INTERVAL_MIN_SEC: 300,
    TIME_SYNC_INTERVAL_MAX_SEC: 86400, // 24 hours
    HEALTH_CHECK_INTERVAL_MIN_SEC: 15,
    HEALTH_CHECK_INTERVAL_MAX_SEC: 86400, // 24 hours
    SHIFT_BUFFER_MIN: 30,
    SHIFT_BUFFER_MAX: 180,
    MIN_CHECKOUT_MIN: 15,
    MIN_CHECKOUT_MAX_MIN: 720, // 12 hours
    MAINTENANCE_HOUR_MIN: 0,
    MAINTENANCE_HOUR_MAX: 23,
    LOW_INTERVAL_WARNING_THRESHOLD: 30,
} as const;

export const USER_LIMITS = {
    PASSWORD_MIN: 8,
    PASSWORD_MAX: 128,
    NAME_MAX: 100,
    CONTACT_MAX: 20,
} as const;

export const ATTENDANCE_LIMITS = {
    DEFAULT_SHIFT_START_HOUR: 8, // 8:00 AM
    DEFAULT_EXPECTED_HOURS: 8,
    ANOMALY_THRESHOLD_MINS: 240, // 4 hours
    AUTO_CHECKOUT_FALLBACK_HOUR: 17, // 5:00 PM
} as const;
