#!/usr/bin/env node
import { enrollFingerprint } from '../services/fingerprintEnrollment.service';

/**
 * Fingerprint Enrollment Script for ZKTeco Devices
 * Uses node-zklib library to enroll fingerprints programmatically
 * 
 * Usage:
 *     node enrollFingerprint.js <device_ip> <user_id> [finger_index] [timeout]
 * 
 * Arguments:
 *     device_ip    : IP address of ZKTeco device (e.g., 192.168.1.201)
 *     user_id      : User ID (zkId) from database
 *     finger_index : Finger index 0-9 (default: 0)
 *                    0 = Right Thumb, 1 = Right Index, etc.
 *     timeout      : Connection timeout in seconds (default: 60)
 * 
 * Example:
 *     node enrollFingerprint.js 192.168.1.201 123 0 60
 */

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log(JSON.stringify({
            "status": "error",
            "message": "Usage: node enrollFingerprint.js <device_ip> <user_id> [finger_index] [timeout]",
            "error_type": "invalid_arguments"
        }));
        process.exit(1);
    }

    // Parse arguments
    const deviceIp = args[0];

    let userId: number;
    try {
        userId = parseInt(args[1]);
    } catch (error) {
        console.log(JSON.stringify({
            "status": "error",
            "message": "User ID must be a valid integer",
            "error_type": "invalid_user_id"
        }));
        process.exit(1);
    }
    // Optional finger index (default: 0 = Right Thumb)
    let fingerIndex = 0;
    if (args.length >= 3) {
        try {
            fingerIndex = parseInt(args[2]);
            if (fingerIndex < 0 || fingerIndex > 9) {
                throw new Error("Finger index must be between 0 and 9");
            }
        } catch (error: any) {
            console.log(JSON.stringify({
                "status": "error",
                "message": error.message,
                "error_type": "invalid_finger_index"
            }));
            process.exit(1);
        }
    }

    // Optional timeout (default: 60 seconds)
    let timeout = 60;
    if (args.length >= 4) {
        try {
            timeout = parseInt(args[3]);
        } catch (error: any) {
            console.log(JSON.stringify({
                "status": "error",
                "message": "Timeout must be a valid integer",
                "error_type": "invalid_timeout"
            }));
            process.exit(1);
        }
    }

    // Run enrollment
    // Run enrollment
    const result = await enrollFingerprint(
        deviceIp,
        userId,
        "Employee",
        String(userId),
        fingerIndex,
        timeout
    );

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
}

main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
