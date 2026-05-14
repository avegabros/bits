export interface AttendanceFilters {
    startDate?: Date;
    endDate?: Date;
    employeeId?: number;
    status?: string;
    branchId?: number;
    departmentId?: number;
    departmentName?: string;
    managerDepartmentIds?: number[];
    shiftId?: number;
}

export interface AttendanceQueryParams {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
    status?: string;
    branchName?: string;
    departmentId?: string;
    departmentName?: string;
    page?: string;
    limit?: string;
    shiftId?: string;
}

export interface AddUserPayload {
    userId: string;
    name: string;
}

export interface UpdateAttendancePayload {
    checkInTime?: string;
    checkOutTime?: string;
    status?: string;
    reason: string;
}

export interface ProcessResult {
    success: boolean;
    processed: number;
    created: number;
    updated: number;
}

export interface BasicAttendanceRecord {
    date: Date;
    checkInTime: Date | null;
    checkOutTime: Date | null;
    status: string | null;
}
