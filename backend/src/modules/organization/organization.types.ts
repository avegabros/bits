export interface CreateDepartmentRequest {
    name: string;
}

export type UpdateDepartmentRequest = Partial<CreateDepartmentRequest>;

export interface CreateBranchRequest {
    name: string;
}

export type UpdateBranchRequest = Partial<CreateBranchRequest>;

export interface CreateSectionRequest {
    name: string;
    departmentId: number;
}

export type UpdateSectionRequest = Partial<Pick<CreateSectionRequest, 'name'>>;

