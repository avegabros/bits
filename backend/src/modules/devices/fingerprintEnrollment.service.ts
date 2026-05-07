import { ZKDriver } from "../../shared/lib/zk-driver";

/**
 * Interface for enrollment result
 */
export interface EnrollmentResult {
    success: boolean;
    message: string;
    data?: unknown;
    error?: string;
    employee_id?: number;
    finger_index?: number;
}

/**
 * Interface for enrollment status updates
 */
export interface EnrollmentStatus {
    status: 'connecting' | 'connected' | 'enrolling' | 'success' | 'error' | 'info';
    message: string;
    employee_id?: number;
    finger?: string;
    finger_index?: number;
    device_info?: {
        serial_number: string;
        firmware_version: string;
        user_counts?: number;
        log_counts?: number;
        log_capacity?: number;
    };
    error_type?: string;
    details?: string;
}

// Finger index mapping (for reference - ZKTeco standard mapping)
const FINGER_MAP: { [key: number]: string } = {
    5: "Right Thumb",
    6: "Right Index Finger",
    7: "Right Middle Finger",
    8: "Right Ring Finger",
    9: "Right Little Finger",
    4: "Left Thumb",
    3: "Left Index Finger",
    2: "Left Middle Finger",
    1: "Left Ring Finger",
    0: "Left Little Finger"
};

/**
 * Print data as JSON for consumption (matches Python script behavior)
 */
function printJson(data: unknown) {
    console.log(JSON.stringify(data));
}

// ─────────────────────────────────────────────────────────────────────────────
// Device-busy lock (shared with zkServices via module-level state would be
// ideal, but this service is primarily used as a standalone CLI script via
// src/scripts/enrollFingerprint.ts — it is NOT called by the API controllers.
// The API controllers use enrollEmployeeFingerprint() in zkServices.ts instead,
// which has its own lock. This local lock protects repeated CLI invocations.
// ─────────────────────────────────────────────────────────────────────────────
let _deviceBusy = false;
const _deviceQueue: Array<() => void> = [];

function acquireDeviceLock(): Promise<void> {
    return new Promise((resolve) => {
        if (!_deviceBusy) {
            _deviceBusy = true;
            resolve();
        } else {
            console.log('[EnrollService] Device busy — queuing request...');
            _deviceQueue.push(() => {
                _deviceBusy = true;
                resolve();
            });
        }
    });
}

function releaseDeviceLock(): void {
    const next = _deviceQueue.shift();
    if (next) {
        setTimeout(next, 500);
    } else {
        _deviceBusy = false;
    }
}

/**
 * Enroll a fingerprint for a user on ZKTeco device.
 *
 * NOTE: This function is used by the standalone CLI script
 * (src/scripts/enrollFingerprint.ts) and is NOT called by the
 * API controllers. The API path uses enrollEmployeeFingerprint()
 * in zkServices.ts, which has its own device-busy lock and DB lookup.
 *
 * @param deviceIp   IP address of the device
 * @param employeeId Employee ID (for logging only)
 * @param name       Employee display name (used as fallback lookup)
 * @param userIdString  Visible userId string stored on device (= zkId as string)
 * @param fingerIndex   Which finger to enroll (0-9)
 * @param timeout       Connection timeout in seconds
 * @param port          Device port (default: 4370)
 */
export async function enrollFingerprint(
    deviceIp: string,
    employeeId: number,
    name: string = "Employee",
    userIdString: string = "",
    fingerIndex: number = 0,
    timeout: number = 60,
    port: number = 4370
): Promise<EnrollmentResult> {

    // Use ZKDriver to maintain consistency with other parts of the codebase
    const zkDriver = new ZKDriver(deviceIp, port, timeout * 1000);

    await acquireDeviceLock();

    try {
        // Connect to device
        printJson({
            "status": "connecting",
            "message": `Connecting to device at ${deviceIp}:${port}...`
        });

        await zkDriver.connect();

        printJson({
            "status": "connected",
            "message": "Connected to device",
            "device_info": {
                "serial_number": "N/A",
                "firmware_version": "N/A"
            }
        });

        // Try to get device info if supported
        try {
            const info = await zkDriver.getInfo();
            printJson({
                "status": "info",
                "message": "Device info retrieved",
                "device_info": {
                    "serial_number": info.serialNumber || "N/A",
                    "firmware_version": "N/A"
                }
            });
        } catch (error) {
            console.warn("Failed to get device info:", error);
        }

        // Check if user exists on device
        console.log(`[Enrollment] Verifying user with ID ${employeeId} on device...`);

        // The visible userId string stored on the device (= zkId, NOT the DB employee id)
        // BUG FIX: previously enrollmentUid (internal device UID, a number) was passed
        // to startEnrollment() which expects the visible userId STRING. This caused the
        // enrollment command to target the wrong user or fail silently.
        const targetUserIdString = userIdString || String(employeeId);
        let resolvedVisibleId: string = targetUserIdString; // ← always a string
        let userExists = false;

        try {
            // Get all users from device to confirm the user is there
            const deviceUsers = await zkDriver.getUsers();

            // Try multiple lookup strategies to find the user
            // 1. Match by the provided userIdString (= zkId as string)
            let targetEmployee = deviceUsers.find((emp) => String(emp.userId) === targetUserIdString);

            // 2. If not found, try matching by employeeId string
            if (!targetEmployee) {
                targetEmployee = deviceUsers.find((emp) => String(emp.userId) === String(employeeId));
            }

            // 3. If still not found, try matching by name
            if (!targetEmployee) {
                targetEmployee = deviceUsers.find((emp) => emp.name === name);
            }

            if (targetEmployee) {
                // ── KEY FIX ────────────────────────────────────────────────────────────
                // CMD_STARTENROLL (TCP format) expects the VISIBLE userId string
                // (the same string stored in the userId field via CMD_USER_WRQ),
                // NOT the internal 2-byte device UID.
                //
                // Old (broken) code:
                //   enrollmentUid = targetEmployee.uid;   // ← number (internal UID)
                //   await zkDriver.startEnrollment(enrollmentUid, fingerIndex);  // ← wrong!
                //
                // Fixed:
                //   resolvedVisibleId = targetEmployee.userId;  // ← string (visible id)
                //   await zkDriver.startEnrollment(resolvedVisibleId, fingerIndex); // ← correct
                // ───────────────────────────────────────────────────────────────────────
                resolvedVisibleId = String(targetEmployee.userId);
                userExists = true;
                console.log(`[Enrollment] Found User: "${targetEmployee.name}" (VisibleId: ${resolvedVisibleId}, InternalUID: ${targetEmployee.uid}).`);
            } else {
                console.error(`[Enrollment] User not found on device (userIdString="${targetUserIdString}", employeeId=${employeeId}, name="${name}"). Available users:`);
                deviceUsers.forEach((emp) => {
                    console.log(`[Enrollment]   UID=${emp.uid}, userId="${emp.userId}", name="${emp.name}"`);
                });
            }

        } catch (error) {
            console.error("[Enrollment] Failed to fetch users list.", error);
        }

        // If user does not exist on device, fail — addUserToDevice already handles creation
        if (!userExists) {
            throw new Error(`User ${name} (ID: ${targetUserIdString}) not found on device. Please ensure the employee was synced to the device first.`);
        }

        // Validate finger index
        if (fingerIndex < 0 || fingerIndex > 9) {
            throw new Error(`Finger index must be between 0 and 9, got ${fingerIndex}`);
        }

        // Start enrollment — pass the VISIBLE userId string, not the internal UID
        const fingerName = FINGER_MAP[fingerIndex] || `Finger ${fingerIndex}`;

        printJson({
            "status": "enrolling",
            "message": `Please place ${fingerName} on the scanner 3 times...`,
            "finger": fingerName,
            "finger_index": fingerIndex,
            "employee_id": employeeId
        });

        // ── FIXED: resolvedVisibleId is the visible userId string (e.g. "2") ──
        await zkDriver.startEnrollment(resolvedVisibleId, fingerIndex);

        printJson({
            "status": "success",
            "message": `Fingerprint enrollment command sent for user ${employeeId}!`,
            "employee_id": employeeId,
            "finger": fingerName,
            "finger_index": fingerIndex
        });

        return {
            success: true,
            message: `Enrollment started on device for user ${employeeId}. Please press finger 3 times.`,
            employee_id: employeeId,
            finger_index: fingerIndex
        };

    } catch (error: unknown) {
        console.error("Enrollment error:", error);

        // Determine error type
        let errorType = "unknown_error";
        const errObj = error instanceof Error ? error : null;
        let errorMsg = errObj?.message || "Unknown error";

        if (errObj?.message?.includes("connect") || errObj?.message?.includes("timeout") || (error as NodeJS.ErrnoException)?.code === "ETIMEDOUT" || (error as NodeJS.ErrnoException)?.code === "ECONNREFUSED") {
            errorType = "network_error";
            errorMsg = `Network error: Cannot connect to device at ${deviceIp}:${port}`;
        } else if (errObj?.message?.includes("device") || errObj?.message?.includes("command")) {
            errorType = "device_error";
        } else if (errObj?.message?.includes("finger") || errObj?.message?.includes("enroll")) {
            errorType = "enrollment_error";
        }

        printJson({
            "status": "error",
            "message": errorMsg,
            "error_type": errorType,
            "employee_id": employeeId,
            "finger_index": fingerIndex,
            "details": errObj?.stack || errObj?.message || String(error)
        });

        return {
            success: false,
            message: errorMsg,
            error: errObj?.stack || errObj?.message || String(error),
            employee_id: employeeId,
            finger_index: fingerIndex
        };
    } finally {
        // Always disconnect and release the lock, even on error
        try {
            await zkDriver.disconnect();
        } catch {
            // Ignore disconnect errors during cleanup
        }
        releaseDeviceLock();
    }
}

