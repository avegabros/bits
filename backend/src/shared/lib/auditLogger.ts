import { prisma } from './prisma';
import { Prisma } from '@prisma/client';
import { AuditAction, AuditEntity, AuditCategory, AuditSource } from '../types/auditTypes';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface AuditLogPayload {
    action: AuditAction;
    entityType: AuditEntity;
    category?: AuditCategory;
    entityId?: number;
    performedBy?: number;
    source?: AuditSource;
    level?: LogLevel;
    details?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string;
}

const ENTITY_TO_CATEGORY: Record<string, AuditCategory> = {
    'Account': 'auth',
    'User Account': 'auth',
    'Attendance': 'attendance',
    'Device': 'device',
    'Employee': 'employee',
    'Shift': 'config',
    'Department': 'config',
    'Branch': 'config',
    'Holiday': 'config',
    'System': 'system',
};

/** Keys that must never be persisted in audit log metadata */
const METADATA_DENY_LIST = [
    'password', 'refreshToken', 'accessToken', 'token',
    'body', 'userAgent',
    'category',  // already stored as top-level column
] as const;

/** Internal ID keys — strip to prevent auto-increment ID exposure */
const INTERNAL_ID_KEYS = [
    'employeeId', 'deviceId', 'zkId', 'departmentId',
    'branchId', 'adjustmentId', 'attendanceId',
] as const;

/**
 * Strips sensitive and internal keys from metadata before saving to DB
 */
function sanitizeMetadata(
    raw: Record<string, unknown> | undefined | null
): Record<string, unknown> | null {
    if (!raw) return null;

    // Fast check: if empty, return null
    if (Object.keys(raw).length === 0) return null;

    // Shallow copy to avoid mutating the caller's object
    const cleaned = { ...raw };

    for (const key of METADATA_DENY_LIST) {
        delete cleaned[key];
    }
    for (const key of INTERNAL_ID_KEYS) {
        delete cleaned[key];
    }

    // After cleanup, if it's empty, return null
    if (Object.keys(cleaned).length === 0) return null;
    
    return cleaned;
}

/**
 * Centralized Audit Logger Utility
 * Records system events, user actions, and errors to the database.
 * This function is fire-and-forget to prevent blocking main execution paths.
 */
export const audit = async (payload: AuditLogPayload): Promise<void> => {
    try {
        // 1. Derive category if not explicitly provided
        const category = payload.category
            || (payload.metadata as any)?.category
            || ENTITY_TO_CATEGORY[payload.entityType as string]
            || 'system';

        // 2. Clean metadata
        const cleanMeta = sanitizeMetadata(payload.metadata);

        await prisma.auditLog.create({
            data: {
                level: payload.level || 'INFO',
                action: payload.action,
                entityType: payload.entityType,
                entityId: payload.entityId,
                performedBy: payload.performedBy,
                source: payload.source || 'system',
                details: payload.details,
                metadata: (cleanMeta as Prisma.InputJsonValue) || Prisma.JsonNull,
                category,
                correlationId: payload.correlationId,
            }
        });
    } catch (error) {
        // We log to console rather than throwing to avoid breaking the application
        // if the audit log system encounters a transient DB issue
        console.error('[AuditLogger] Failed to write audit log:', error, payload);
    }
};
