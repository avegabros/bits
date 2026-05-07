import { $Enums, Prisma } from '@prisma/client';

export interface CreateEmployeeRequest {
    firstName: string;
    lastName: string;
    middleName?: string;
    suffix?: string;
    gender?: string;
    dateOfBirth?: string | Date;
    email?: string;
    password?: string;
    role?: $Enums.Role;
    employmentStatus?: $Enums.EmploymentStatus;
    departmentId?: number;
    branchId?: number;
    shiftId?: number;
    contactNumber?: string;
    employeeNumber?: string;
    hireDate?: string | Date;
}

export type UpdateEmployeeRequest = Partial<CreateEmployeeRequest> & { status?: string };

export interface SyncFromDeviceResult {
    success: boolean;
    message: string;
    error?: string;
}

export interface SyncToDeviceResult {
    success: boolean;
    count?: number;
    message?: string;
    error?: string;
}
