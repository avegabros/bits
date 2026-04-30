export interface AuditLog {
  id: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  actionType?: string;
  attendance: {
    date?: string;
    employee: {
      firstName: string;
      middleName?: string;
      lastName: string;
      suffix?: string;
      Branch?: { name: string } | null;
      role: string;
    };
  };
  adjustedBy: {
    firstName: string;
    lastName: string;
    role: string;
  };
  approvedBy?: {
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface GroupedAuditLog {
    key: string;
    logs: AuditLog[];
    createdAt: string;
    actionType?: string;
    attendanceDate?: string;
    adjusterName: string;
    approverName?: string;
    employeeName: string;
    branch: string;
    reason: string;
    first: AuditLog;
}

export const fieldLabels: Record<string, string> = {
    checkInTime: 'Time-In',
    checkOutTime: 'Time-Out',
    status: 'Status',
    record: 'Record',
};
