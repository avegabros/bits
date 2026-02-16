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
    private zkInstance: any;

    constructor(ip: string = '192.168.1.201', port: number = 4370, timeout: number = 5000) {
        this.ip = ip;
        this.port = port;
        this.timeout = timeout;
    }

    /**
     * Connect to the device
     */
    async connect(): Promise<void> {
        // dynamic require to match previous working code's behavior
        const ZKLib = require('node-zklib');
        this.zkInstance = new ZKLib(this.ip, this.port, this.timeout, this.timeout);

        console.log(`[ZKDriver] Initialized ZKLib. Instance has setUser? ${typeof this.zkInstance.setUser}`);

        await this.zkInstance.createSocket();
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
     * Get all users from device
     */
    async getUsers(): Promise<DeviceUser[]> {
        if (!this.zkInstance) throw new Error('Not connected');
        const result = await this.zkInstance.getUsers();
        const users = result.data || result;

        if (!Array.isArray(users)) {
            throw new Error('Invalid user data received from device');
        }

        return users.map((u: any) => ({
            uid: parseInt(u.uid),
            userId: u.userId || u.user_id,
            name: u.name || u.userName,
            password: u.password,
            role: u.role,
            cardno: u.cardno
        }));
    }

    /**
     * Get the next available UID for creating a new user
     * This ensures sequential UID assignment to prevent ghost users
     */
    async getNextUid(): Promise<number> {
        const users = await this.getUsers();
        if (!users || users.length === 0) {
            return 1;
        }
        const existingUids = users.map(u => u.uid);
        return Math.max(...existingUids) + 1;
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
        } catch (error: any) {
            throw new Error(`Failed to set user: ${error.message || error}`);
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
        } catch (error: any) {
            // If user doesn't exist, it might throw error, we can ignore or rethrow
            throw new Error(`Failed to delete user: ${error.message || error}`);
        }
    }

    /**
     * Get attendance logs
     */
    async getLogs(): Promise<DeviceLog[]> {
        if (!this.zkInstance) throw new Error('Not connected');
        const result = await this.zkInstance.getAttendances();
        const logs = result.data || result;

        if (!Array.isArray(logs)) {
            // Sometimes it returns data wrapper, sometimes not
            if (logs && Array.isArray(logs.data)) return this.parseLogs(logs.data);
            // If completely invalid
            return [];
        }
        return this.parseLogs(logs);
    }

    /**
     * Start fingerprint enrollment
     */
    async startEnrollment(uid: number, fingerIndex: number): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');

        const { COMMANDS } = require('node-zklib/constants');

        // Cancel any pending capture first to clear state
        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_CANCELCAPTURE, '');
        } catch (e) {
            // Ignore error
        }

        // IMPORTANT: node-zklib uses TCP connections by default
        // TCP format is different from UDP format!
        // 
        // TCP Format (from pyzk):
        //   pack('<24sbb', str(user_id).encode(), temp_id, 1)
        //   - 24 bytes: user_id as string
        //   - 1 byte: template/finger index
        //   - 1 byte: flag (1 = allow overwrite)
        //
        // UDP Format:
        //   pack('<Ib', int(user_id), temp_id)
        //   - 4 bytes: user_id as integer
        //   - 1 byte: template/finger index

        const enrollData = Buffer.alloc(26); // 24 + 1 + 1

        // Write user_id as string (24 bytes, ASCII)
        const userIdStr = String(uid);
        enrollData.write(userIdStr, 0, 24, 'ascii');

        // Write fingerprint index (1 byte)
        enrollData.writeInt8(fingerIndex, 24);

        // Write flag: 1 = allow overwrite (1 byte)
        enrollData.writeInt8(1, 25);

        console.log(`[ZKDriver] Sending CMD_STARTENROLL (TCP). User ID: "${userIdStr}", Finger: ${fingerIndex}`);

        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_STARTENROLL, enrollData);
        } catch (error: any) {
            throw new Error(`Failed to start enrollment: ${error.message || error}`);
        }
    }

    private parseLogs(logs: any[]): DeviceLog[] {
        return logs
            .filter((log: any) => log.deviceUserId && log.recordTime)
            .map((log: any) => ({
                deviceUserId: log.deviceUserId,
                recordTime: new Date(log.recordTime),
                status: log.status || 0
            }));
    }
}
