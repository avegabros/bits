export interface AuditLogQueryFilter {
    startDate?: string;
    endDate?: string;
    level?: string;
    action?: string;
    entityType?: string;
    performerId?: number;
    category?: string;
    page?: number;
    limit?: number;
}

export interface AuditLogResponse {
    success: boolean;
    data: any[]; // Kept loose for the moment, bound to AuditLog model
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
