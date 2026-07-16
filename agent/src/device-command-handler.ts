import { ZKDriver } from './zk-driver';
import { DeviceQueue } from './device-queue';
import { deviceRegistry } from './device-registry';

export type AgentCommand =
    | { action: 'TEST_CONNECTION'; deviceIp: string; devicePort: number }
    | { action: 'PULL_ATTENDANCE'; deviceIp: string; devicePort: number; since?: string }
    | { action: 'WRITE_FINGERPRINT'; deviceIp: string; devicePort: number; zkId: number; fingerIndex: number; templateData: Buffer }
    | { action: 'READ_FINGERPRINT'; deviceIp: string; devicePort: number; zkId: number; fingerIndex: number }
    | { action: 'READ_ALL_FINGERPRINTS'; deviceIp: string; devicePort: number; zkId: number }
    | { action: 'UPSERT_USER'; deviceIp: string; devicePort: number; zkId: number; name: string; card: number; role: number }
    | { action: 'DELETE_USER'; deviceIp: string; devicePort: number; zkId: number }
    | { action: 'DELETE_FINGER'; deviceIp: string; devicePort: number; zkId: number; fingerIndex: number }
    | { action: 'SET_TIME'; deviceIp: string; devicePort: number; utcTime: string }
    | { action: 'GET_USERS'; deviceIp: string; devicePort: number }
    | { action: 'CLEAR_ATTENDANCE_LOGS'; deviceIp: string; devicePort: number }
    | { action: 'GET_USER_FINGERS_STATUS'; deviceIp: string; devicePort: number; zkId: number }
    | { action: 'START_ENROLLMENT'; deviceIp: string; devicePort: number; zkId: string; fingerIndex: number }
    | { action: 'PING_DEVICE'; deviceIp: string; devicePort: number }
    | { action: 'GET_DEVICE_INFO'; deviceIp: string; devicePort: number };

export interface CommandResult {
    success: boolean;
    data?: any;
    error?: string;
}

export function parseTemplateData(data: any): Buffer {
    if (Buffer.isBuffer(data)) {
        return data;
    }
    if (data && typeof data === 'object') {
        if (data.type === 'Buffer' && Array.isArray(data.data)) {
            return Buffer.from(data.data);
        }
        if (Array.isArray(data)) {
            return Buffer.from(data);
        }
        if (data.buffer instanceof ArrayBuffer || data instanceof Uint8Array) {
            return Buffer.from(data.buffer || data);
        }
    }
    return Buffer.from(data);
}


export async function handleCommand(command: AgentCommand, deviceQueue: DeviceQueue): Promise<CommandResult> {
    const { action, deviceIp, devicePort } = command;
    const port = devicePort || 4370;

    if (action === 'PING_DEVICE') {
        console.log(`[Handler] Probing "${action}" on ${deviceIp}:${port}...`);
        for (let attempt = 1; attempt <= 2; attempt++) {
            const probeDriver = new ZKDriver(deviceIp, port, 10000);
            try {
                await probeDriver.connect();
                await probeDriver.disconnect();
                deviceRegistry.markOnline(deviceIp);
                return { success: true, data: { status: 'ONLINE' } };
            } catch (error: unknown) {
                await probeDriver.disconnect().catch(() => {});
                if (attempt < 2) {
                    console.log(`[Handler] Probe attempt ${attempt} failed, retrying in 2s...`);
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    deviceRegistry.markOffline(deviceIp);
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    return { success: false, error: errorMsg };
                }
            }
        }
        return { success: false, error: 'Probe failed' };
    }

    const status = deviceRegistry.getStatus(deviceIp);
    if (status === 'OFFLINE') {
        console.log(`[Handler] Skipping "${action}" on ${deviceIp}:${port} — device is OFFLINE. Waiting for health check.`);
        return { success: false, error: 'DEVICE_OFFLINE' };
    }

    return deviceQueue.enqueue(deviceIp, async (): Promise<CommandResult> => {
        const driver = new ZKDriver(deviceIp, port);
        let timeoutId: NodeJS.Timeout | null = null;

        const executionPromise = (async (): Promise<CommandResult> => {
            try {
                console.log(`[Handler] Executing "${action}" on ${deviceIp}:${port}...`);
                await driver.connect();

                let data: any = null;

                switch (command.action) {
                    case 'TEST_CONNECTION':
                        let serialNumber = 'N/A';
                        let userCount = 0;
                        try {
                            const info = await driver.getInfo();
                            serialNumber = info.serialNumber || 'N/A';
                        } catch { /* ignore */ }
                        try {
                            const users = await driver.getUsers();
                            userCount = users.length;
                        } catch { /* ignore */ }
                        data = {
                            status: 'ONLINE',
                            serialNumber,
                            userCount
                        };
                        break;

                    case 'PULL_ATTENDANCE':
                        const allLogs = await driver.getLogs();
                        const sinceFilter = command.since ? new Date(command.since) : null;
                        if (sinceFilter) {
                            const filtered = allLogs.filter(log => new Date(log.recordTime) > sinceFilter);
                            console.log(`[Handler] Filtered ${allLogs.length} total logs to ${filtered.length} (since ${sinceFilter.toISOString()})`);
                            data = filtered;
                        } else {
                            data = allLogs;
                        }
                        break;

                    case 'WRITE_FINGERPRINT':
                        await driver.setFingerTemplate(
                            command.zkId,
                            command.fingerIndex,
                            parseTemplateData(command.templateData)
                        );
                        data = { status: 'SUCCESS' };
                        break;

                    case 'READ_FINGERPRINT':
                        const template = await driver.getFingerTemplate(command.zkId, command.fingerIndex);
                        data = template ? template : null;
                        break;

                    case 'READ_ALL_FINGERPRINTS':
                        const templates = await driver.readAllFingerprintTemplates(command.zkId);
                        data = templates;
                        break;

                    case 'UPSERT_USER':
                        await driver.setUser(
                            command.zkId,
                            command.name,
                            "",
                            command.role,
                            command.card
                        );
                        await driver.refreshData();
                        data = { status: 'SUCCESS' };
                        break;

                    case 'DELETE_USER':
                        await driver.clearUserFingerprints(command.zkId).catch(() => {});
                        await driver.deleteUser(command.zkId);
                        await driver.refreshData();
                        data = { status: 'SUCCESS' };
                        break;

                    case 'DELETE_FINGER':
                        await driver.deleteFingerTemplate(command.zkId, command.fingerIndex);
                        data = { status: 'SUCCESS' };
                        break;

                    case 'SET_TIME':
                        await driver.setTime(new Date(command.utcTime));
                        data = { status: 'SUCCESS' };
                        break;

                    case 'GET_USERS':
                        const users = await driver.getUsers();
                        data = users;
                        break;

                    case 'CLEAR_ATTENDANCE_LOGS':
                        await driver.clearAttendanceLogs();
                        data = { status: 'SUCCESS' };
                        break;

                    case 'GET_USER_FINGERS_STATUS':
                        const enrolledFingers: number[] = [];
                        for (let finger = 0; finger <= 2; finger++) {
                            const hasTemplate = await driver.hasFingerTemplate(command.zkId, finger);
                            if (hasTemplate) {
                                enrolledFingers.push(finger);
                            }
                            await new Promise(r => setTimeout(r, 50));
                        }
                        data = { enrolledFingers };
                        break;

                    case 'START_ENROLLMENT':
                        await driver.startEnrollment(String(command.zkId), command.fingerIndex);
                        data = { status: 'SUCCESS' };
                        break;

                    case 'GET_DEVICE_INFO':
                        const info = await driver.getInfo();
                        const time = await driver.getTime();
                        data = { info, time };
                        break;

                    default:
                        const cmd = command as Record<string, unknown>;
                        throw new Error(`Unsupported action type: ${cmd.action}`);
                }

                await driver.disconnect();
                return { success: true, data };
            } catch (error: unknown) {
                await driver.disconnect().catch(() => {});
                throw error;
            }
        })();

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('DEVICE_COMMAND_TIMEOUT'));
            }, 180000); // 3 minutes timeout to handle large backlog downloads
        });

        try {
            const result = await Promise.race([executionPromise, timeoutPromise]);
            if (timeoutId) clearTimeout(timeoutId);
            if (result.success) {
                deviceRegistry.markOnline(deviceIp);
            }
            return result;
        } catch (error: unknown) {
            if (timeoutId) clearTimeout(timeoutId);
            console.error(`[Handler] Command "${action}" failed:`, error);
            await driver.disconnect().catch(() => {});
            if (deviceRegistry.isConnectionError(error)) {
                deviceRegistry.markOffline(deviceIp);
            }
            const errorMsg = error instanceof Error ? error.message : String(error);
            return { success: false, error: errorMsg };
        }
    });
}
