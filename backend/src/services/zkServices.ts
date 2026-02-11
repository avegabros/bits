import { prisma } from '../lib/prisma';
import { ZKDriver } from '../lib/zk-driver';
import { enrollFingerprint, EnrollmentResult } from './fingerprintEnrollment.service';
import { processAttendanceLogs } from './attendance.service';

interface SyncResult {
    success: boolean;
    message?: string;
    error?: string;
    newLogs?: number;
    count?: number;
}

const getDriver = (): ZKDriver => {
    const ip = process.env.ZK_HOST || '192.168.1.201';
    const port = parseInt(process.env.ZK_PORT || '4370');
    return new ZKDriver(ip, port);
};

export const syncZkData = async (): Promise<SyncResult> => {
    const zk = getDriver();

    try {
        console.log(`[ZK] Connecting to device...`);
        await zk.connect();

        const info = await zk.getInfo();
        console.log(`[ZK] Connected! Serial: ${info.serialNumber}`);

        const logs = await zk.getLogs();

        // Sort: Oldest -> Newest
        logs.sort((a, b) => a.recordTime.getTime() - b.recordTime.getTime());

        let newCount = 0;

        for (const log of logs) {
            try {
                const zkUserId = parseInt(log.deviceUserId);

                if (isNaN(zkUserId)) continue;

                // 1. Ensure Employee Exists
                const employee = await prisma.employee.upsert({
                    where: { zkId: zkUserId },
                    update: {},
                    create: {
                        zkId: zkUserId,
                        firstName: `Employee`,
                        lastName: `${zkUserId}`
                    },
                });

                // 2. Fetch Last Log to prevent duplicates
                const lastLog = await prisma.attendanceLog.findFirst({
                    where: { employeeId: employee.id },
                    orderBy: { timestamp: 'desc' }
                });

                // Logic: Prevent duplicates within 1 minute (accidental double-scans)
                if (lastLog) {
                    const diffMs = log.recordTime.getTime() - lastLog.timestamp.getTime();
                    const diffMinutes = diffMs / (1000 * 60);

                    // Only skip if it's within 1 minute (likely accidental double-scan)
                    if (diffMinutes < 1) continue;
                }

                // 3. Check for exact duplicate in DB
                const exists = await prisma.attendanceLog.findUnique({
                    where: {
                        timestamp_employeeId: {
                            timestamp: log.recordTime,
                            employeeId: employee.id
                        }
                    }
                });

                if (!exists) {
                    await prisma.attendanceLog.create({
                        data: {
                            timestamp: log.recordTime,
                            employeeId: employee.id,
                            status: log.status,
                        },
                    });
                    newCount++;
                }
            } catch (error) {
                console.error(`[ZK] Error processing log:`, error);
            }
        }

        console.log(`[ZK] Sync Complete. Saved ${newCount} new logs.`);

        // Always process logs into Attendance records (handles both new and existing logs)
        console.log(`[ZK] Processing logs into attendance records...`);
        await processAttendanceLogs();

        return { success: true, newLogs: newCount };

    } catch (error: any) {
        console.error('[ZK] Error:', error);
        return {
            success: false,
            error: `Sync Error: ${error.message || error}`,
            message: 'Failed to sync attendance data'
        };
    } finally {
        await zk.disconnect();
    }
};

export const addUserToDevice = async (userId: number, name: string): Promise<SyncResult> => {
    const zk = getDriver();

    try {
        console.log(`[ZK] Adding User ${userId} (${name})...`);
        await zk.connect();
        await zk.setUser(userId, name);
        console.log(`[ZK] Added User ${userId} successfully.`);
        return { success: true, message: `User ${name} added to device.` };
    } catch (error: any) {
        console.error('[ZK] Add User Error:', error);
        throw new Error(`Failed to add employee: ${error.message || error}`);
    } finally {
        await zk.disconnect();
    }
};

export const syncEmployeesToDevice = async (): Promise<SyncResult> => {
    const zk = getDriver();

    try {
        console.log(`[ZK] Fetching DB employees...`);
        const employees = await prisma.employee.findMany({
            where: {
                zkId: { not: null },
                employmentStatus: 'ACTIVE',
            },
            select: {
                zkId: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
            }
        });

        if (employees.length === 0) {
            return { success: true, message: "No employees to sync.", count: 0 };
        }

        console.log(`[ZK] Connecting...`);
        await zk.connect();

        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        for (const employee of employees) {
            const fullName = `${employee.firstName} ${employee.lastName}`;
            try {
                const zkId = employee.zkId!;
                const displayName = employee.employeeNumber
                    ? `${fullName} (${employee.employeeNumber})`
                    : fullName;

                await zk.setUser(zkId, displayName);
                console.log(`[ZK]   ✓ Added: ${displayName}`);
                successCount++;
            } catch (error: any) {
                failedCount++;
                errors.push(`Failed ${fullName}: ${error.message}`);
                console.error(`[ZK]   ✗ Failed ${fullName}: ${error.message}`);
            }
        }

        return {
            success: successCount > 0,
            message: `Synced ${successCount}/${employees.length} employees.`,
            count: successCount,
        };

    } catch (error: any) {
        throw new Error(`Sync failed: ${error.message}`);
    } finally {
        await zk.disconnect();
    }
};

// ... enrollEmployeeFingerprint is mostly business logic invoking other services, 
// checking logic if it needs refactor.
// It uses `addUserToDevice` (refactored above) and `enrollFingerprint` (external service).
// So we can keep it as is or lightly clean it.

export const enrollEmployeeFingerprint = async (
    employeeId: number,
    fingerIndex: number = 0
): Promise<SyncResult> => {
    try {
        console.log(`[Enrollment] Starting for employee ${employeeId}...`);

        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                zkId: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                employmentStatus: true,
            }
        });

        if (!employee) return { success: false, message: 'Employee not found', error: 'not_found' };
        if (!employee.zkId) return { success: false, message: 'No zkId assigned', error: 'no_zkid' };
        if (employee.employmentStatus !== 'ACTIVE') return { success: false, message: 'Inactive employee', error: 'inactive' };

        const fullName = `${employee.firstName} ${employee.lastName}`;

        // User should already exist on device from initial sync
        // No need to call addUserToDevice() again - this was causing duplicates

        // Call Enrollment Service
        const deviceIp = process.env.ZK_HOST || '192.168.1.201';
        const result: EnrollmentResult = await enrollFingerprint(
            deviceIp,
            employee.zkId,              // Use zkId for enrollment
            fullName,
            String(employee.zkId),      // Search by zkId (matches what's on device)
            fingerIndex,
            60
        );

        if (result.success) {
            return { success: true, message: `Fingerprint enrolled for ${fullName}` };
        } else {
            return { success: false, message: result.message, error: result.error };
        }

    } catch (error: any) {
        return { success: false, message: `Enrollment error: ${error.message}`, error: 'enrollment_error' };
    }
};

export const testDeviceConnection = async (): Promise<SyncResult> => {
    const zk = getDriver();
    try {
        await zk.connect();
        const info = await zk.getInfo();
        const time = await zk.getTime();
        return { success: true, message: `Connected! Serial: ${info.serialNumber}, Time: ${JSON.stringify(time)}` };
    } catch (error: any) {
        return { success: false, error: error.message };
    } finally {
        await zk.disconnect();
    }
};

export const syncEmployeesFromDevice = async (): Promise<SyncResult> => {
    const zk = getDriver();
    try {
        await zk.connect();
        const users = await zk.getUsers();

        console.log(`[ZK] Found ${users.length} users on device.`);
        let newCount = 0;
        let updateCount = 0;

        for (const user of users) {
            const zkId = parseInt(user.userId);
            if (isNaN(zkId)) continue;

            const existing = await prisma.employee.findUnique({ where: { zkId } });

            if (existing) {
                updateCount++;
            } else {
                const nameParts = user.name.split(' ');
                const firstName = nameParts[0] || 'Device';
                const lastName = nameParts.slice(1).join(' ') || `User ${zkId}`;

                await prisma.employee.create({
                    data: {
                        zkId,
                        firstName,
                        lastName,
                        employmentStatus: 'ACTIVE'
                    }
                });
                newCount++;
            }
        }

        return { success: true, message: `Scanned ${users.length}. Created ${newCount}, Found ${updateCount}.`, count: newCount };

    } catch (error: any) {
        return { success: false, error: error.message };
    } finally {
        await zk.disconnect();
    }
};