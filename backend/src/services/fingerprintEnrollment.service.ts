import { ZKDriver } from "../lib/zk-driver";

/**
 * Interface for enrollment result
 */
export interface EnrollmentResult {
    success: boolean;
    message: string;
    data?: any;
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
function printJson(data: any) {
    console.log(JSON.stringify(data));
}

/**
 * Enroll a fingerprint for a user on ZKTeco device
 * 
 * @param deviceIp IP address of the device
 * @param userId User ID (zkId) 
 * @param fingerIndex Which finger to enroll (0-9)
 * @param timeout Connection timeout in seconds
 * @param port Device port (default: 4370)
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
                    "firmware_version": info.version || "N/A"
                }
            });
        } catch (error) {
            console.warn("Failed to get device info:", error);
        }

        // Check if user exists and get correct internal UID
        console.log(`[Enrollment] Verifying user with ID ${employeeId} on device...`);
        let enrollmentUid = employeeId; // Default to provided ID if lookup fails (fallback)
        let userExists = false;

        // Use provided string ID or fallback to employeeId
        const targetUserIdString = userIdString || String(employeeId);

        try {
            // Get all users from device to find the internal UID
            const employees = await zkDriver.getUsers();

            // Find user by matching the visible User ID string (badge number)
            const targetEmployee = employees.find((emp: any) => String(emp.userId) === targetUserIdString);

            if (targetEmployee) {
                // IMPORTANT: ZKTeco uses an internal 2-byte UID (uid) for enrollment commands,
                // NOT the visible User ID string (userId/badge number).
                enrollmentUid = targetEmployee.uid;
                userExists = true;
                console.log(`[Enrollment] Found User: "${targetEmployee.name}" (Badge: ${targetEmployee.userId}). Internal UID: ${enrollmentUid}`);
            } else {
                console.warn(`[Enrollment] Warning: User ID ${targetUserIdString} not found. Creating user before enrollment...`);
            }

        } catch (error) {
            console.error("[Enrollment] Failed to fetch users list.", error);
        }

        // If user does not exist, create them
        if (!userExists) {
            try {
                // IMPORTANT: Get next available UID from device to prevent ghost users
                enrollmentUid = await zkDriver.getNextUid();
                console.log(`[Enrollment] Creating user: ${name} (Badge ID: ${targetUserIdString}, Next UID: ${enrollmentUid})`);

                // Use ZKDriver's setUser method
                await zkDriver.setUser(enrollmentUid, name, "", 0, 0);

                console.log(`[Enrollment] User created successfully with UID ${enrollmentUid}.`);

            } catch (createError: any) {
                console.error(`[Enrollment] Failed to create user: ${createError.message}`);
                throw new Error(`Failed to create user on device: ${createError.message}`);
            }
        }

        // Validate finger index
        if (fingerIndex < 0 || fingerIndex > 9) {
            throw new Error(`Finger index must be between 0 and 9, got ${fingerIndex}`);
        }

        // Start enrollment
        const fingerName = FINGER_MAP[fingerIndex] || `Finger ${fingerIndex}`;

        printJson({
            "status": "enrolling",
            "message": `Please place ${fingerName} on the scanner 3 times...`,
            "finger": fingerName,
            "finger_index": fingerIndex,
            "employee_id": employeeId
        });

        // Use ZKDriver's startEnrollment method
        await zkDriver.startEnrollment(enrollmentUid, fingerIndex);

        printJson({
            "status": "success",
            "message": `Fingerprint enrolled successfully for user ${employeeId}!`,
            "employee_id": employeeId,
            "finger": fingerName,
            "finger_index": fingerIndex
        });

        // Disconnect
        await zkDriver.disconnect();

        return {
            success: true,
            message: `Enrollment started on device for user ${employeeId}. Please press finger 3 times.`,
            employee_id: employeeId,
            finger_index: fingerIndex
        };

    } catch (error: any) {
        console.error("Enrollment error:", error);

        // Try to disconnect if possible
        try {
            await zkDriver.disconnect();
        } catch (recoverError: any) {
            console.warn("Recovery error:", recoverError);
        }

        // Determine error type
        let errorType = "unknown_error";
        let errorMsg = error.message || "Unknown error";

        if (error.message?.includes("connect") || error.message?.includes("timeout") || error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
            errorType = "network_error";
            errorMsg = `Network error: Cannot connect to device at ${deviceIp}:${port}`;
        } else if (error.message?.includes("device") || error.message?.includes("command")) {
            errorType = "device_error";
        } else if (error.message?.includes("finger") || error.message?.includes("enroll")) {
            errorType = "enrollment_error";
        }

        printJson({
            "status": "error",
            "message": errorMsg,
            "error_type": errorType,
            "employee_id": employeeId,
            "finger_index": fingerIndex,
            "details": error.stack || error.message
        });

        return {
            success: false,
            message: errorMsg,
            error: error.stack || error.message,
            employee_id: employeeId,
            finger_index: fingerIndex
        };
    }
}


