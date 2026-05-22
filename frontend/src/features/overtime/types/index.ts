export interface OvertimeRequest {
  id: number;
  employeeId: number;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELETED';
  source: 'REQUESTED' | 'ASSIGNED';
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    employeeNumber?: string;
    Department?: { name: string } | null;
    profilePicture?: string | null;
  };
  reviewedBy?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
}

export interface OTSession {
  id: number;
  employee: { id: number; firstName: string; lastName: string; department: string; branch: string; profilePicture?: string | null };
  date: string;
  approved: { startTime: string; endTime: string };
  actual: { startTime: string | null; endTime: string | null };
  actualDurationMinutes: number;
  approvedDurationMinutes: number;
  sessionState: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'MISSED' | 'PARTIAL';
  device: { checkIn: string | null; checkOut: string | null };
  linkedAttendanceId: number | null;
  source: 'REQUESTED' | 'ASSIGNED';
  reason?: string;
}
