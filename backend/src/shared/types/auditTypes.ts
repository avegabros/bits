// ── Action Types ─────────────────────────────────────────────────────────
export type AuditAction =
    // CRUD
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'STATUS_CHANGE'
    // Auth
    | 'LOGIN'
    | 'LOGOUT'
    | 'FAILED_LOGIN'
    | 'PASSWORD_CHANGE'
    | 'PASSWORD_RESET'
    // Attendance
    | 'CHECK_IN'
    | 'CHECK_OUT'
    | 'AUTO_CHECKOUT'
    | 'ATTENDANCE_OVERRIDE'
    | 'ATTENDANCE_DELETE'
    | 'ADJUSTMENT_SUBMIT'
    | 'ADJUSTMENT_APPROVE'
    | 'ADJUSTMENT_REJECT'
    | 'ADJUSTMENT_CANCEL'
    | 'ADJUSTMENT_REOPEN'
    | 'FLAG_MISSING_CHECKOUT'
    // Device / Sync
    | 'SYNC'
    | 'MANUAL_SYNC'
    | 'DEVICE_SYNC'
    | 'DUPLICATE_PUNCH'
    | 'DEVICE_CONNECT'
    | 'DEVICE_DISCONNECT'
    | 'DEVICE_LOG_BUFFER_CLEAR'
    | 'SYNC_QUEUE_FAIL'
    | 'SYNC_QUEUE_SUCCESS'
    | 'RECONCILE'
    // System
    | 'CONFIG_UPDATE'
    | 'EXPORT'
    | 'BULK_IMPORT'
    | 'EMAIL_SENT'
    | 'EMAIL_FAILED'
    | 'MANAGER_DEPARTMENT_UPDATE'
    | 'BIOMETRIC_EXCLUSION_ADD'
    | 'BIOMETRIC_EXCLUSION_REMOVE';

// ── Entity Types ─────────────────────────────────────────────────────────
export type AuditEntity =
    | 'Employee'
    | 'Device'
    | 'Attendance'
    | 'Shift'
    | 'Department'
    | 'Branch'
    | 'Company'
    | 'Holiday'
    | 'Account'
    | 'System'
    | 'OvertimeRequest';

// ── Categories ───────────────────────────────────────────────────────────
export type AuditCategory =
    | 'auth'
    | 'attendance'
    | 'device'
    | 'employee'
    | 'config'
    | 'system';

// ── Sources ──────────────────────────────────────────────────────────────
export type AuditSource =
    | 'admin-panel'
    | 'api'
    | 'cron'
    | 'device-sync'
    | 'health-check'
    | 'startup-repair'
    | 'sync-queue'
    | 'system'
    | 'bulk-import';
