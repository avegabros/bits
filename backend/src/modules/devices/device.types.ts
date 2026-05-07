export interface ZkUser {
    uid: number;
    userId: string | number; // usually ZK returns string, but we cast
    name: string;
    role: number;
    password: string;
    cardno?: string | number;
}

export interface ZkAttendanceLog {
    uid?: number;
    deviceUserId?: string | number;
    recordTime: string | Date;
}

export interface SyncResult {
    success: boolean;
    message?: string;
    error?: string;
    newLogs?: number;
    count?: number;
    results?: Record<string, unknown>[];
}
