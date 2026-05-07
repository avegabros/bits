export interface CreateShiftRequest {
    shiftCode: string;
    name: string;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    graceMinutes?: number;
    breakMinutes?: number;
    isNightShift?: boolean;
    isActive?: boolean;
    description?: string;
    workDays?: string[]; // Array of Mon, Tue etc.
    halfDays?: string[]; 
    halfDayHours?: number | null; // When set, half-day = this many hours; null = use midpoint
    breaks?: string;     // JSON string or structured object depending on usage
}

export type UpdateShiftRequest = Partial<CreateShiftRequest>;

export interface ShiftQueryFilter {
    isActive?: boolean | string;
    search?: string;
}
