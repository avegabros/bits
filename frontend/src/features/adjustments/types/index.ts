export interface Adjustment {
    id: number;
    attendanceId: number;
    originalCheckIn: string | null;
    originalCheckOut: string | null;
    requestedCheckIn: string | null;
    requestedCheckOut: string | null;
    reason: string;
    type?: 'UPDATE' | 'DELETE';
    status: string;
    rejectionReason: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    attendance: {
        date: string;
        employee: {
            firstName: string;
            lastName: string;
            middleName?: string | null;
            suffix?: string | null;
            Branch: { name: string } | null;
            Department?: { name: string } | null;
        };
    };
    submittedBy: { firstName: string; lastName: string };
    reviewedBy: { firstName: string; lastName: string } | null;
    submittedById: number;
}
