export type EmployeeShift = {
  id: number;
  name: string;
  startTime: string; // e.g. "08:00"
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  workDays: string;
  halfDays: string;
  breaks?: string;
};

export type AttendanceRecord = {
  id: number;
  employeeId: number;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  status: string;
  notes?: string | null;
  totalHours?: number;
  lateMinutes?: number;
  overtimeMinutes?: number;
  undertimeMinutes?: number;
  isAnomaly?: boolean;
  isEarlyOut?: boolean;
  shiftCode?: string | null;
  isShiftActive?: boolean;
  gracePeriodApplied?: boolean;
  checkin_updated?: string | null;
  checkout_updated?: string | null;
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    departmentId: number | null;
    Department?: { name: string } | null;
    branchId: number | null;
    Branch?: { name: string } | null;
    Shift?: EmployeeShift | null;
  };
};

export type ReportRow = {
  id: number;
  name: string;
  employeeNumber: string | null;
  zkId: number | null;
  department: string;
  branch: string;
  totalDays: number;
  present: number;
  late: number;
  lateMinutes: number;
  overtime: number;
  undertime: number;
  totalHours: number;
  shift: EmployeeShift | null;
  hasAnomaly: boolean;
  hasMissingCheckout: boolean;
  missingCheckoutsCount: number;
};
