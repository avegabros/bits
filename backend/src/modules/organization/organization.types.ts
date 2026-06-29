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
}

export type UpdateSectionRequest = Partial<Pick<CreateSectionRequest, 'name'>>;

