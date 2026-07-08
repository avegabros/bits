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
    verifyMode: number;
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
     */
    async connect(): Promise<void> {
        const ZKLibTCP = require('node-zklib/zklibtcp');
        this.zkInstance = new ZKLibTCP(this.ip, this.port, this.timeout);

        await this.zkInstance!.createSocket();
        await this.zkInstance!.connect();

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
     */
    async setTime(date: Date): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');

        const pht = new Date(date.getTime() + 8 * 60 * 60 * 1000);

        const year   = pht.getUTCFullYear();
        const month  = pht.getUTCMonth() + 1;
        const day    = pht.getUTCDate();
        const hour   = pht.getUTCHours();
        const minute = pht.getUTCMinutes();
        const second = pht.getUTCSeconds();

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
     */
    async getFingerCount(uid: number): Promise<number> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');
        let count = 0;
        for (let finger = 0; finger <= 2; finger++) {
            try {
                const buf = Buffer.alloc(3);
                buf.writeUInt16LE(uid, 0);
                buf.writeUInt8(finger, 2);
                const result = await this.zkInstance.executeCmd(COMMANDS.CMD_USERTEMP_RRQ, buf);
                if (result && result.length > 8) count++;
            } catch {
                // Slot empty or not supported
            }
            await new Promise(r => setTimeout(r, 50));
        }
        return count;
    }

    /**
     * Check if a specific fingerprint template is enrolled.
     */
    async hasFingerTemplate(uid: number, fingerIndex: number): Promise<boolean> {
        try {
            const template = await this.getFingerTemplate(uid, fingerIndex);
            if (template && template.length > 0) {
                template.fill(0);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    /**
     * Refresh device data
     */
    async refreshData(): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');
        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
        } catch {
            // Non-critical
        }
    }

    /**
     * Set a user on the device
     */
    async setUser(zkId: number, name: string, password: string = "", role: number = 0, cardno: number = 0, userId: string = ""): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');

        const buf = Buffer.alloc(72);
        buf.writeUInt16LE(zkId, 0);
        buf.writeUInt8(role, 2);
        buf.write(password, 3, 8, 'ascii');

        const nameBuf = Buffer.alloc(24);
        nameBuf.write(name, 0, 24, 'ascii');
        nameBuf.copy(buf, 11);

        buf.writeUInt32LE(cardno, 35);

        const visibleId = userId || zkId.toString();
        buf.write(visibleId, 48, 9, 'ascii');

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

        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(uid, 0);

        console.log(`[ZKDriver] Deleting user UID: ${uid}...`);

        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_DELETE_USER, buf);
            console.log(`[ZKDriver] User ${uid} deleted.`);
        } catch (error: unknown) {
            throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Delete a single fingerprint template.
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
            // Ignore
        }
    }

    /**
     * Clear ALL fingerprint templates for a given device UID.
     */
    async clearUserFingerprints(uid: number): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');

        for (let finger = 0; finger <= 9; finger++) {
            try {
                const buf = Buffer.alloc(3);
                buf.writeUInt16LE(uid, 0);
                buf.writeUInt8(finger, 2);
                await this.zkInstance.executeCmd(COMMANDS.CMD_DELETE_USERTEMP, buf);
            } catch {
                // Ignore
            }
        }
        console.log(`[ZKDriver] Fingerprint templates cleared for UID: ${uid}.`);
    }

    private extractRawTemplate(execCmdResponse: Buffer): Buffer {
        const CMD_DATA_ID = 0x05DD;
        const CMD_PREPARE_DATA_ID = 0x05DC;
        const TCP_MAGIC = Buffer.from([0x50, 0x50, 0x82, 0x7d]);

        const firstCmdId = execCmdResponse.readUInt16LE(0);
        let templateStart = 8;

        if (firstCmdId === CMD_DATA_ID) {
            templateStart = 8;
        } else if (firstCmdId === CMD_PREPARE_DATA_ID) {
            for (let i = 8; i < execCmdResponse.length - 16; i++) {
                if (execCmdResponse.compare(TCP_MAGIC, 0, 4, i, i + 4) === 0) {
                    if (i + 16 <= execCmdResponse.length && execCmdResponse.readUInt16LE(i + 8) === CMD_DATA_ID) {
                        templateStart = i + 16;
                        break;
                    }
                }
            }
        }

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
     * Get a specific fingerprint template.
     */
    async getFingerTemplate(uid: number, fingerIndex: number): Promise<Buffer | null> {
        if (!this.zkInstance) throw new Error('Not connected');
        const zk = this.zkInstance as any;
        const { COMMANDS } = require('node-zklib/constants');
        const { createTCPHeader, removeTcpHeader } = require('node-zklib/utils');

        const buf = Buffer.alloc(3);
        buf.writeUInt16LE(uid, 0);
        buf.writeUInt8(fingerIndex, 2);

        zk.replyId++;
        const header = createTCPHeader(COMMANDS.CMD_USERTEMP_RRQ, zk.sessionId, zk.replyId, buf);

        try {
            const combinedResponse = await new Promise<Buffer | null>((resolve) => {
                let timer: ReturnType<typeof setTimeout> | null = null;
                let socket = zk.socket;
                let replyBuffer = Buffer.alloc(0);

                const cleanup = () => {
                    if (timer) clearTimeout(timer);
                    socket.removeListener('data', handleData);
                };

                const handleData = (data: Buffer) => {
                    replyBuffer = Buffer.concat([replyBuffer, data]);
                    
                    if (replyBuffer.length >= 16) {
                        const cmdId = replyBuffer.readUInt16LE(8);
                        
                        if (cmdId === COMMANDS.CMD_PREPARE_DATA) {
                            if (timer) clearTimeout(timer);
                            timer = setTimeout(() => {
                                cleanup();
                                resolve(replyBuffer);
                            }, 200);
                            return;
                        } else {
                            cleanup();
                            resolve(null);
                        }
                    }
                };

                socket.on('data', handleData);

                timer = setTimeout(() => {
                    cleanup();
                    resolve(null);
                }, 3000);

                socket.write(header, (err: any) => {
                    if (err) {
                        cleanup();
                        resolve(null);
                    }
                });
            });

            if (combinedResponse && combinedResponse.length > 24) {
                const result = removeTcpHeader(combinedResponse);
                const rawTemplate = this.extractRawTemplate(result as Buffer);

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
                        const strippedTemplate = rawTemplate.subarray(6, 6 + reportedSize);
                        console.log(
                            `[ZKDriver] getFingerTemplate: Stripped 6-byte entry header ` +
                            `(hdr finger=${reportedFinger}, queried finger=${fingerIndex}). ` +
                            `Biometric payload: ${strippedTemplate.length} bytes.`
                        );
                        return strippedTemplate;
                    }
                }

                return rawTemplate;
            }
            return null;
        } catch (error) {
            console.error(`[ZKDriver] Error fetching template slot ${fingerIndex} for UID ${uid}:`, error);
            return null;
        }
    }

    /**
     * Read all enrolled fingerprint templates.
     */
    async readAllFingerprintTemplates(uid: number): Promise<{ finger: number; data: Buffer }[]> {
        const templates: { finger: number; data: Buffer }[] = [];
        for (let finger = 0; finger <= 9; finger++) {
            const data = await this.getFingerTemplate(uid, finger);
            if (data && data.length > 0) {
                templates.push({ finger, data });
                console.log(`[ZKDriver] readAllFingerprintTemplates — UID=${uid} slot ${finger}: ${data.length} bytes`);
            }
        }
        return templates;
    }

    /**
     * Set a fingerprint template directly.
     */
    async setFingerTemplate(uid: number, fingerIndex: number, templateData: Buffer): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');

        console.log(`[ZKDriver] Pushing fingerprint template to UID: ${uid}, Finger: ${fingerIndex} (Size: ${templateData.length} bytes)`);

        try {
            const templateSize = templateData.length;
            
            const prepPayload = Buffer.alloc(4);
            prepPayload.writeUInt16LE(templateSize, 0);

            const tmpWritePayload = Buffer.alloc(6);
            tmpWritePayload.writeUInt16LE(uid, 0);
            tmpWritePayload.writeUInt8(fingerIndex, 2);
            tmpWritePayload.writeUInt8(1, 3);
            tmpWritePayload.writeUInt16LE(templateSize, 4);

            const zkInfo = this.zkInstance;

            await zkInfo.executeCmd(COMMANDS.CMD_DISABLEDEVICE, Buffer.from([0x00, 0x00, 0x00, 0x00]));

            await zkInfo.executeCmd(COMMANDS.CMD_PREPARE_DATA, prepPayload);
            await zkInfo.executeCmd(COMMANDS.CMD_DATA, templateData);
            await zkInfo.executeCmd(COMMANDS.CMD_CHECKSUM_BUFFER, '');
            await zkInfo.executeCmd(COMMANDS.CMD_TMP_WRITE, tmpWritePayload);
            await zkInfo.executeCmd(COMMANDS.CMD_FREE_DATA, '');
            await zkInfo.executeCmd(COMMANDS.CMD_REFRESHDATA, '');
            await zkInfo.executeCmd(COMMANDS.CMD_ENABLEDEVICE, '');

            const verifySuccess = await this.hasFingerTemplate(uid, fingerIndex);
            if (!verifySuccess) {
                throw new Error(`Device rejected or failed to write fingerprint template on slot ${fingerIndex}`);
            }

            console.log(`[ZKDriver] Successfully synchronized fingerprint for UID: ${uid}`);
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`[ZKDriver] Failed to push template UID ${uid}:`, errMsg);
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
     */
    async startEnrollment(visibleUserId: string, fingerIndex: number): Promise<void> {
        if (!this.zkInstance) throw new Error('Not connected');
        const { COMMANDS } = require('node-zklib/constants');

        try {
            await this.zkInstance.executeCmd(COMMANDS.CMD_CANCELCAPTURE, '');
        } catch (e) {
            // Ignore
        }

        const enrollData = Buffer.alloc(26);
        enrollData.write(visibleUserId, 0, 24, 'ascii');
        enrollData.writeInt8(fingerIndex, 24);
        enrollData.writeInt8(1, 25);

        console.log(`[ZKDriver] Sending CMD_STARTENROLL. visibleUserId="${visibleUserId}", Finger: ${fingerIndex}`);

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
                status: (log.status as number) || 0,
                verifyMode: (log.verifyMode as number) || 0
            }));
    }
}
