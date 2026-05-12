export interface AttendanceRecord {
  id: number | string;
  employeeId: number;
  employeeName: string;
  profilePicture?: string | null;
  department: string;
  branchName: string;
  companyName?: string | null;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  notes?: string;
  isEarlyPunch?: boolean;
  isMissingCheckout?: boolean;
  lateMinutes: number;
  totalHours: number;
  overtimeMinutes: number;
  undertimeMinutes: number;
  shiftId: number | null;
  shiftCode: string | null;
  shiftName: string | null;
  shiftStartTime?: string;
  shiftEndTime?: string;
  isNightShift: boolean;
  isAnomaly?: boolean;
  isEarlyOut?: boolean;
  isShiftActive?: boolean;
  gracePeriodApplied?: boolean;
  displayStatus?: string;
  checkInDevice?: string | null;
  checkOutDevice?: string | null;
  checkoutSource?: string | null;
  isEdited?: boolean;
  isPending?: boolean;
  isMerged?: boolean;
  subRecords?: AttendanceRecord[];
}

export interface AttendanceStats {
  totalEmployees: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  incomplete: number;
}
