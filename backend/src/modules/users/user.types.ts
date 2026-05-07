import { $Enums } from '@prisma/client';

export interface CreateUserRequest {
    firstName: string;
    lastName: string;
    email: string;
    password?: string;
    role: $Enums.Role;
    employmentStatus?: $Enums.EmploymentStatus;
    departmentId?: number;
    branchId?: number;
    employeeNumber?: string;
}

export type UpdateUserRequest = Partial<CreateUserRequest>;

export interface UpdatePasswordRequest {
    currentPassword?: string;
    newPassword?: string;
}

export interface UserQueryFilter {
    role?: $Enums.Role;
    status?: $Enums.EmploymentStatus;
    search?: string;
}
