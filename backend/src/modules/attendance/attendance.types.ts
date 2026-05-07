export interface AttendanceFilters {
    startDate?: Date;
    endDate?: Date;
    employeeId?: number;
    status?: string;
    branchId?: number;
    departmentId?: number;
    departmentName?: string;
    managerDepartmentIds?: number[];
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
