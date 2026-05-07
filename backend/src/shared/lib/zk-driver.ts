import { prisma } from './prisma';

export interface DeviceInfo {
    serialNumber: string;
    version?: string;
}

export interface DeviceTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

export interface DeviceUser {
    uid: number;
    userId: string;
    name: string;
    password?: string;
    role?: number;
    cardno?: number;
}

export interface DeviceLog {
    deviceUserId: string;
    recordTime: Date;
    status: number;
}

export class ZKDriver {
    private ip: string;
    private port: number;
    private timeout: number;
    private zkInstance: {
        createSocket: () => Promise<void>;
        connect: () => Promise<void>;
        disconnect: () => Promise<void>;
        getInfo: () => Promise<DeviceInfo>;
        getTime: () => Promise<DeviceTime>;
        getUsers: () => Promise<{ data?: unknown[] } | unknown[]>;
        getAttendances: () => Promise<{ data?: unknown[] } | unknown[]>;
        executeCmd: (cmd: number, data: Buffer | string) => Promise<Buffer>;
        clearAttendanceLog: () => Promise<void>;
        connectionType?: string;
    } | null = null;

    constructor(ip: string = '192.168.1.201', port: number = 4370, timeout: number = 30000) {
        this.ip = ip;
        this.port = port;
        this.timeout = timeout;
    }

    /**
     * Connect to the device using TCP only.
     * We bypass node-zklib's auto-fallback logic (which goes to UDP when TCP's
     * protocol handshake times out) by directly instantiating ZKLibTCP instead
     * of the combined ZKLib class.
     */
    async connect(): Promise<void> {
        const ZKLibTCP = require('node-zklib/zklibtcp');
        this.zkInstance = new ZKLibTCP(this.ip, this.port, this.timeout);

        await this.zkInstance!.createSocket();
        await this.zkInstance!.connect();

        // Expose a connectionType so functionWrapper-style calls still work
        // if any internal node-zklib helpers check for it.
        this.zkInstance!.connectionType = 'tcp';

        console.log(`[ZKDriver] Connected to ${this.ip}:${this.port} (TCP)`);
    }

    /**
     * Disconnect from device
     */
    async disconnect(): Promise<void> {
        if (this.zkInstance) {
            await this.zkInstance.disconnect();
            this.zkInstance = null;
        }
    }

    /**
     * Clear all attendance logs from the device
     * WARNING: This is permanent and cannot be undone!
     */
    async clearAttendanceLogs(): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');

        try {
            await this.zkInstance.clearAttendanceLog();
            console.log('[ZKDriver] Attendance logs cleared from device');
        } catch (error) {
            console.error('[ZKDriver] Error clearing attendance logs:', error);
            throw error;
        }
    }

    /**
     * Get device information
     */
    async getInfo(): Promise<DeviceInfo> {
        if (!this.zkInstance) throw new Error('Not connected');
        return await this.zkInstance.getInfo();
    }

    /**
     * Get device time
     */
    async getTime(): Promise<DeviceTime> {
        if (!this.zkInstance) throw new Error('Not connected');
        return await this.zkInstance.getTime();
    }

    /**
     * Set device time to align with the server clock.
     * @param date Plain UTC Date object (e.g. new Date()). The PHT offset is
     *             applied internally here — callers must NOT pre-shift the date.
     */
    async setTime(date: Date): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');

        // Always use UTC accessors. The caller passes a plain UTC Date object.
        // We add 8 hours here to convert to PHT — this is the ONLY place that
        // offset is applied. Using getUTC* prevents the server's OS timezone
        // (TZ=Asia/Manila) from accidentally adding another +8 on top.
        const pht = new Date(date.getTime() + 8 * 60 * 60 * 1000);

        const year   = pht.getUTCFullYear();
        const month  = pht.getUTCMonth() + 1;
        const day    = pht.getUTCDate();
        const hour   = pht.getUTCHours();
        const minute = pht.getUTCMinutes();
        const second = pht.getUTCSeconds();

        // Encode exactly as pyzk/zklib does:
        // ((year-2000)*12*31 + ((month-1)*31) + day-1) * (24*60*60) + (hour*60+minute)*60 + second
        const timeInt =
            ((year - 2000) * 12 * 31 + (month - 1) * 31 + day - 1) * (24 * 60 * 60) +
            (hour * 60 + minute) * 60 + second;

        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(timeInt, 0);

        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_SET_TIME, buf);
            await this.refreshData();
        } catch (error: unknown) {
            throw new Error(`Failed to set device time: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get all users from device
     */
    async getUsers(): Promise<DeviceUser[]> {
        if (!this.zkInstance) throw new Error('Not connected');
        const result = await this.zkInstance.getUsers();
        const users = Array.isArray(result) ? result : (result as { data?: unknown[] }).data ?? result;

        if (!Array.isArray(users)) {
            throw new Error('Invalid user data received from device');
        }

        return (users as Record<string, unknown>[]).map((u) => ({
            uid: parseInt(String(u.uid)),
            userId: (u.userId || u.user_id) as string,
            name: (u.name || u.userName) as string,
            password: u.password as string | undefined,
            role: u.role as number | undefined,
            cardno: u.cardno as number | undefined
        }));
    }

    /**
     * Get the count of enrolled fingerprint templates for a given UID.
     * Returns 0–10. A user with 0 fingerprints exists on device but cannot scan.
     * Uses CMD_DELETE_USERTEMP packets to probe each slot — non-destructively
     * queries by catching the "not found" response (device errors = not enrolled).
     *
     * NOTE: This is best-effort. Some firmware versions always ACK the probe
     * command even for empty slots. Use this as a hint, not a guarantee.
     */
    async getFingerCount(uid: number): Promise<number> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');
        let count = 0;
        // CMD_USERTEMP_RRQ = read fingerprint template for a UID+finger slot
        for (let finger = 0; finger <= 9; finger++) {
            try {
                const buf = Buffer.alloc(3);
                buf.writeUInt16LE(uid, 0);
                buf.writeUInt8(finger, 2);
                const result = await this.zkInstance.executeCmd(COMMANDS.CMD_USERTEMP_RRQ, buf);
                // If the reply has data beyond the header, a template exists
                if (result && result.length > 8) count++;
            } catch {
                // Slot empty or not supported — skip
            }
        }
        return count;
    }

    /**
     * Refresh device data — commits newly written users/templates to active memory.
     * Must be called after setUser so CMD_STARTENROLL can find the new user.
     */
    async refreshData(): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');
        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
        } catch {
            // Non-critical — device may not ACK this command but the data is still written
        }
    }

    /**
     * Set a user on the device
     */
    async setUser(zkId: number, name: string, password: string = "", role: number = 0, cardno: number = 0, userId: string = ""): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');

        // Manual implementation since node-zklib v1.x lacks setUser
        const { COMMANDS } = require('node-zklib/constants');

        // Create 72-byte buffer for user data (standard ZK format)
        const buf = Buffer.alloc(72);

        // 1. UID (2 bytes) - Internal Index
        buf.writeUInt16LE(zkId, 0);

        // 2. Role (1 byte) - 0=User, 14=Admin
        buf.writeUInt8(role, 2);

        // 3. Password (8 bytes)
        buf.write(password, 3, 8, 'ascii');

        // 4. Name (24 bytes)
        const nameBuf = Buffer.alloc(24);
        nameBuf.write(name, 0, 24, 'ascii');
        nameBuf.copy(buf, 11);

        // 5. Card Number (4 bytes)
        buf.writeUInt32LE(cardno, 35); // Offset 35 based on utils.js

        // 6. User ID (String, 9 bytes) - The visible ID on screen
        // Offset 48 based on utils.js (decodeUserData72)
        const visibleId = userId || zkId.toString();
        buf.write(visibleId, 48, 9, 'ascii');

        // Send command
        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_USER_WRQ, buf);
        } catch (error: unknown) {
            throw new Error(`Failed to set user: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Delete a user from the device
     */
    async deleteUser(uid: number): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');

        const { COMMANDS } = require('node-zklib/constants');

        // CMD_DELETE_USER = 18
        // Packet: 2 bytes (UID in little endian)
        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(uid, 0);

        console.log(`[ZKDriver] Deleting user UID: ${uid}...`);

        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_DELETE_USER, buf);
            console.log(`[ZKDriver] User ${uid} deleted.`);
        } catch (error: unknown) {
            // If user doesn't exist, it might throw error, we can ignore or rethrow
            throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Delete a single fingerprint template for a specific finger slot.
     * @param uid  Internal device UID (NOT the visible userId string)
     * @param fingerIndex  0-9
     */
    async deleteFingerTemplate(uid: number, fingerIndex: number): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');

        const buf = Buffer.alloc(3);
        buf.writeUInt16LE(uid, 0);
        buf.writeUInt8(fingerIndex, 2);

        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_DELETE_USERTEMP, buf);
            console.log(`[ZKDriver] Deleted template for UID=${uid}, finger=${fingerIndex}.`);
        } catch {
            // Template may not exist — not an error
        }
    }

    /**
     * Clear ALL fingerprint templates for a given device UID.
     *
     * ZKTeco stores user records (CMD_USER_WRQ) and fingerprint templates
     * (CMD_USERTEMP_WRQ) in SEPARATE tables on the device.
     * Deleting a user with CMD_DELETE_USER removes only the user record —
     * the fingerprint templates remain on the same UID slot.
     *
     * If that UID slot is later reused for a NEW employee, the new employee
     * will appear as "already enrolled" because the old template is still there.
     *
     * This method sends CMD_DELETE_USERTEMP for each of the 10 possible finger
     * slots (0-9) to guarantee a clean slate before writing a new user.
     *
     * @param uid  Internal device UID (NOT the visible userId string)
     */
    async clearUserFingerprints(uid: number): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');

        const { COMMANDS } = require('node-zklib/constants');

        // CMD_DELETE_USERTEMP = 19
        // Packet format: 2 bytes UID (little-endian) + 1 byte finger index
        for (let finger = 0; finger <= 9; finger++) {
            try {
                const buf = Buffer.alloc(3);
                buf.writeUInt16LE(uid, 0);
                buf.writeUInt8(finger, 2);
                await this.zkInstance.executeCmd(COMMANDS.CMD_DELETE_USERTEMP, buf);
            } catch {
                // A missing template is not an error — skip silently
            }
        }
        console.log(`[ZKDriver] Fingerprint templates cleared for UID: ${uid}.`);
    }

    /**
     * Internal utility to accurately extract the raw binary footprint of a fingerprint template
     * from the various ZKTeco payload responses (CMD_DATA vs CMD_PREPARE_DATA).
     */
    private extractRawTemplate(execCmdResponse: Buffer): Buffer {
        const CMD_DATA_ID = 0x05DD;
        const CMD_PREPARE_DATA_ID = 0x05DC;
        const TCP_MAGIC = Buffer.from([0x50, 0x50, 0x82, 0x7d]);

        const firstCmdId = execCmdResponse.readUInt16LE(0);
        let templateStart = 8; // fallback assuming standard 8-byte ZK header

        if (firstCmdId === CMD_DATA_ID) {
            // Direct CMD_DATA response — template immediately follows 8-byte header
            templateStart = 8;
        } else if (firstCmdId === CMD_PREPARE_DATA_ID) {
            // CMD_PREPARE_DATA pattern — template is nested inside a secondary packet
            for (let i = 8; i < execCmdResponse.length - 16; i++) {
                if (execCmdResponse.compare(TCP_MAGIC, 0, 4, i, i + 4) === 0) {
                    if (i + 16 <= execCmdResponse.length && execCmdResponse.readUInt16LE(i + 8) === CMD_DATA_ID) {
                        templateStart = i + 16; // Skip inner TCP(8) + ZK_DATA(8)
                        break;
                    }
                }
            }
        }

        // Search backward to chop off any trailing TCP ACK packets
        let templateEnd = execCmdResponse.length;
        for (let i = execCmdResponse.length - 20; i >= templateStart; i--) {
            if (i + 4 <= execCmdResponse.length && execCmdResponse.compare(TCP_MAGIC, 0, 4, i, i + 4) === 0) {
                templateEnd = i;
                break;
            }
        }

        return execCmdResponse.subarray(templateStart, templateEnd);
    }

    /**
     * Get a specific fingerprint template for a given UID and finger index.
     * Returns the raw buffer data if found, otherwise null.
     */
    async getFingerTemplate(uid: number, fingerIndex: number): Promise<Buffer | null> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');

        const buf = Buffer.alloc(3);
        buf.writeUInt16LE(uid, 0);
        buf.writeUInt8(fingerIndex, 2);

        try {
            const result = await this.zkInstance.executeCmd(COMMANDS.CMD_USERTEMP_RRQ, buf);
            
            // Valid templates are usually large (e.g. 500+ bytes for VX10)
            // Anything less or equal to ~100 bytes is typically an error framework packet
            if (result && result.length > 100) {
                const rawTemplate = this.extractRawTemplate(result as Buffer);

                // ZKTeco template entries often include a 6-byte header inside the DATA packet:
                // [TotalSize(2)] [UID(2)] [FID(1)] [Flag(1)] [RawTemplate(N)]
                // We need to strip this before pushing to another device, otherwise
                // setFingerTemplate() will wrap it again causing a "double-header" corruption.
                if (rawTemplate.length > 6) {
                    const reportedSize = rawTemplate.readUInt16LE(0);
                    const reportedUid = rawTemplate.readUInt16LE(2);
                    const reportedFinger = rawTemplate.readUInt8(4);
                    const reportedFlag = rawTemplate.readUInt8(5);

                    if (
                        reportedSize <= rawTemplate.length &&
                        reportedUid === uid &&
                        reportedFlag === 1
                    ) {
                        // reportedSize is the biometric payload size (excluding header).
                        // Slice precisely to drop both the 6-byte header and trailing TCP padding.
                        const strippedTemplate = rawTemplate.subarray(6, 6 + reportedSize);
                        console.log(
                            `[ZKDriver] getFingerTemplate: Stripped 6-byte entry header ` +
                            `(hdr finger=${reportedFinger}, queried finger=${fingerIndex}). ` +
                            `Biometric payload: ${strippedTemplate.length} bytes / ` +
                            `Raw buffer: ${rawTemplate.length} bytes.`
                        );
                        return strippedTemplate;
                    }
                }

                return rawTemplate;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Read all enrolled fingerprint templates for a given UID.
     * Returns an array of { finger, data } for every occupied slot (0-9).
     *
     * Reuses getFingerTemplate() which handles both CMD_DATA and
     * CMD_PREPARE_DATA response formats via extractRawTemplate().
     *
     * SECURITY: Caller MUST zero the returned Buffer data after use
     * by calling `data.fill(0)` on every returned template.
     */
    async readAllFingerprintTemplates(
        uid: number
    ): Promise<{ finger: number; data: Buffer }[]> {
        const templates: { finger: number; data: Buffer }[] = [];
        for (let finger = 0; finger <= 9; finger++) {
            const data = await this.getFingerTemplate(uid, finger);
            if (data && data.length > 0) {
                templates.push({ finger, data });
                console.log(`[ZKDriver] readAllFingerprintTemplates — UID=${uid} slot ${finger}: ${data.length} bytes`);
            }
        }
        console.log(`[ZKDriver] readAllFingerprintTemplates — UID=${uid}: ${templates.length} occupied slot(s) found.`);
        return templates;
    }

    /**
     * Set a fingerprint template directly using its raw buffer data.
     * Implements the ZKTeco multi-step upload protocol (PREPARE -> DATA -> CHECKSUM -> TMP_WRITE).
     */
    async setFingerTemplate(uid: number, fingerIndex: number, templateData: Buffer): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');

        console.log(`[ZKDriver] Pushing fingerprint template to UID: ${uid}, Finger: ${fingerIndex} (Size: ${templateData.length} bytes)`);

        try {
            const templateSize = templateData.length;
            
            // The templateData MUST be the pure biometric data (starting with magic bytes like SS21),
            // WITHOUT a 6-byte template entry header. The metadata (UID, FID, Size) is provided
            // entirely within the tmpWritePayload envelope.
            const prepPayload = Buffer.alloc(4);
            prepPayload.writeUInt16LE(templateSize, 0); // bytes 2-3 are 0x00

            const tmpWritePayload = Buffer.alloc(6);
            tmpWritePayload.writeUInt16LE(uid, 0);
            tmpWritePayload.writeUInt8(fingerIndex, 2);
            tmpWritePayload.writeUInt8(1, 3); // 1 = valid template
            tmpWritePayload.writeUInt16LE(templateSize, 4);

            const zkInfo = this.zkInstance;

            // Step 1: Lock the machine
            await zkInfo.executeCmd(COMMANDS.CMD_DISABLEDEVICE, Buffer.from([0x00, 0x00, 0x00, 0x00]));

            // Step 2: Delete existing template on target slot
            const delBuf = Buffer.alloc(3);
            delBuf.writeUInt16LE(uid, 0);
            delBuf.writeUInt8(fingerIndex, 2);
            await zkInfo.executeCmd(COMMANDS.CMD_DELETE_USERTEMP, delBuf).catch(() => {});

            // Step 3-7: The official upload data exchange handshake
            await zkInfo.executeCmd(COMMANDS.CMD_PREPARE_DATA, prepPayload);
            await zkInfo.executeCmd(COMMANDS.CMD_DATA, templateData);
            await zkInfo.executeCmd(COMMANDS.CMD_CHECKSUM_BUFFER, '');
            await zkInfo.executeCmd(COMMANDS.CMD_TMP_WRITE, tmpWritePayload);
            await zkInfo.executeCmd(COMMANDS.CMD_FREE_DATA, '');

            // Step 8: Refresh internal maps
            await zkInfo.executeCmd(COMMANDS.CMD_REFRESHDATA, '');

            // Step 9: Unlock machine
            await zkInfo.executeCmd(COMMANDS.CMD_ENABLEDEVICE, '');

            console.log(`[ZKDriver] Successfully synchronized fingerprint for UID: ${uid}`);
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`[ZKDriver] Failed to push template UID ${uid}:`, errMsg);
            // Attempt to re-enable device on failure to un-brick user interface
            await this.zkInstance!.executeCmd(COMMANDS.CMD_ENABLEDEVICE, '').catch(() => {});
            throw new Error(`Failed to set fingerprint template: ${errMsg}`);
        }
    }

    /**
     * Get attendance logs
     */
    async getLogs(): Promise<DeviceLog[]> {
        if (!this.zkInstance) throw new Error('Not connected');
        const result = await this.zkInstance.getAttendances();
        const rawResult = Array.isArray(result) ? result : (result as { data?: unknown[] });
        const logs = Array.isArray(rawResult) ? rawResult : rawResult.data;

        if (!Array.isArray(logs)) {
            return [];
        }
        return this.parseLogs(logs as Record<string, unknown>[]);
    }

    /**
     * Start fingerprint enrollment.
     * @param visibleUserId  The badge/visible user ID string (e.g. "2") — NOT the internal UID.
     *                       CMD_STARTENROLL TCP format expects the same string that was stored
     *                       in the userId field when the user was written with CMD_USER_WRQ.
     * @param fingerIndex    0-9 (see FINGER_MAP for mapping)
     */
    async startEnrollment(visibleUserId: string, fingerIndex: number): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');

        const { COMMANDS } = require('node-zklib/constants');

        // Cancel any pending capture first to clear device state
        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_CANCELCAPTURE, '');
        } catch (e) {
            // Ignore — device may not have a pending capture
        }

        // TCP Format (from pyzk):
        //   pack('<24sbb', str(user_id).encode(), temp_id, 1)
        //   - 24 bytes: visible userId string (same as badge number stored on device)
        //   - 1 byte:   finger index (0-9)
        //   - 1 byte:   flag — 1 = allow overwrite existing template

        const enrollData = Buffer.alloc(26); // 24 + 1 + 1
        enrollData.write(visibleUserId, 0, 24, 'ascii');  // visible userId, NOT internal UID
        enrollData.writeInt8(fingerIndex, 24);
        enrollData.writeInt8(1, 25); // overwrite flag

        console.log(`[ZKDriver] Sending CMD_STARTENROLL (TCP). visibleUserId="${visibleUserId}", Finger: ${fingerIndex}`);

        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_STARTENROLL, enrollData);
        } catch (error: unknown) {
            throw new Error(`Failed to start enrollment: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private parseLogs(logs: Record<string, unknown>[]): DeviceLog[] {
        return logs
            .filter((log) => log.deviceUserId && log.recordTime)
            .map((log) => ({
                deviceUserId: String(log.deviceUserId),
                recordTime: new Date(log.recordTime as string | number),
                status: (log.status as number) || 0
            }));
    }
}
