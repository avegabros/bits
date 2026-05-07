import { audit, AuditLogPayload } from './auditLogger';

/** Build structured diff metadata from old and new objects */
export function buildChanges(
    oldObj: Record<string, unknown>,
    newObj: Record<string, unknown>,
    fieldsToTrack: string[],
    fieldsToExclude: string[] = ['updatedAt', 'password', 'createdAt']
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
    for (const field of fieldsToTrack) {
        if (fieldsToExclude.includes(field)) continue;
        const oldVal = oldObj[field];
        const newVal = newObj[field];
        
        // Normalize Date comparison
        const oldStr = oldVal instanceof Date ? oldVal.toISOString() : oldVal;
        const newStr = newVal instanceof Date ? newVal.toISOString() : newVal;
        
        if (oldStr !== newStr) {
            changes.push({ field, oldValue: oldStr ?? null, newValue: newStr ?? null });
        }
    }
    return changes;
}

/** Audit an UPDATE action with structured before/after diffs */
export function auditUpdate(
    base: Omit<AuditLogPayload, 'action' | 'metadata'>,
    changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>,
    extra?: Record<string, unknown>
): void {
    if (changes.length === 0) return; // Nothing actually changed
    void audit({
        ...base,
        action: 'UPDATE',
        metadata: { changes, ...extra },
    });
}

/** Audit a CREATE action with a snapshot of key properties */
export function auditCreate(
    base: Omit<AuditLogPayload, 'action' | 'metadata'>,
    snapshot: Record<string, unknown>
): void {
    void audit({
        ...base,
        action: 'CREATE',
        metadata: { snapshot },
    });
}

/** Audit a DELETE action with a snapshot of what was deleted */
export function auditDelete(
    base: Omit<AuditLogPayload, 'action' | 'metadata'>,
    snapshot: Record<string, unknown>
): void {
    void audit({
        ...base,
        action: 'DELETE',
        metadata: { snapshot },
    });
}

/** Audit a batch operation (cron, sync, etc.) */
export function auditBatch(
    base: Omit<AuditLogPayload, 'metadata'>,
    batch: { affectedCount: number; affectedIds?: number[]; summary: string; [key: string]: unknown }
): void {
    void audit({
        ...base,
        metadata: batch,
    });
}
