export interface OvertimeRequest {
  id: number;
  employeeId: number;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    employeeNumber?: string;
    Department?: { name: string } | null;
  };
  reviewedBy?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
}
