import { ZKDriver } from './zk-driver';
import { DeviceQueue } from './device-queue';

export type AgentCommand =
    | { action: 'TEST_CONNECTION'; deviceIp: string; devicePort: number }
    | { action: 'PULL_ATTENDANCE'; deviceIp: string; devicePort: number }
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

export async function handleCommand(command: AgentCommand, deviceQueue: DeviceQueue): Promise<CommandResult> {
    const { action, deviceIp, devicePort } = command;
    const port = devicePort || 4370;

    if (action === 'PING_DEVICE') {
        if (deviceQueue.isBusy(deviceIp)) {
            console.log(`[Handler] Fast probing "${action}" on ${deviceIp}:${port} - DEVICE IS ACTIVE (Skipping TCP handshake)`);
            return { success: true, data: { status: 'ONLINE' } };
        }

        const driver = new ZKDriver(deviceIp, port);
        try {
            console.log(`[Handler] Fast probing (no queue) "${action}" on ${deviceIp}:${port}...`);
            await driver.connect();
            await driver.disconnect();
            return { success: true, data: { status: 'ONLINE' } };
        } catch (error: any) {
            await driver.disconnect().catch(() => {});
            return { success: false, error: error.message || String(error) };
        }
    }

    return deviceQueue.enqueue(deviceIp, async (): Promise<CommandResult> => {
        const driver = new ZKDriver(deviceIp, port);
        let timeoutId: NodeJS.Timeout | null = null;

        const executionPromise = (async (): Promise<CommandResult> => {
            try {
                console.log(`[Handler] Executing "${action}" on ${deviceIp}:${port}...`);
                await driver.connect();

                let data: any = null;

                switch (action) {
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
                        const logs = await driver.getLogs();
                        data = logs;
                        break;

                    case 'WRITE_FINGERPRINT':
                        const writeCmd = command as any;
                        await driver.setFingerTemplate(
                            writeCmd.zkId,
                            writeCmd.fingerIndex,
                            Buffer.from(writeCmd.templateData)
                        );
                        data = { status: 'SUCCESS' };
                        break;

                    case 'READ_FINGERPRINT':
                        const readCmd = command as any;
                        const template = await driver.getFingerTemplate(readCmd.zkId, readCmd.fingerIndex);
                        data = template ? template : null;
                        break;

                    case 'READ_ALL_FINGERPRINTS':
                        const readAllCmd = command as any;
                        const templates = await driver.readAllFingerprintTemplates(readAllCmd.zkId);
                        data = templates;
                        break;

                    case 'UPSERT_USER':
                        const userCmd = command as any;
                        await driver.setUser(
                            userCmd.zkId,
                            userCmd.name,
                            "",
                            userCmd.role,
                            userCmd.card
                        );
                        await driver.refreshData();
                        data = { status: 'SUCCESS' };
                        break;

                    case 'DELETE_USER':
                        const delCmd = command as any;
                        await driver.clearUserFingerprints(delCmd.zkId).catch(() => {});
                        await driver.deleteUser(delCmd.zkId);
                        await driver.refreshData();
                        data = { status: 'SUCCESS' };
                        break;

                    case 'DELETE_FINGER':
                        const delFingerCmd = command as any;
                        await driver.deleteFingerTemplate(delFingerCmd.zkId, delFingerCmd.fingerIndex);
                        data = { status: 'SUCCESS' };
                        break;

                    case 'SET_TIME':
                        const timeCmd = command as any;
                        await driver.setTime(new Date(timeCmd.utcTime));
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
                        const statusCmd = command as any;
                        const enrolledFingers: number[] = [];
                        for (let finger = 0; finger <= 2; finger++) {
                            const hasTemplate = await driver.hasFingerTemplate(statusCmd.zkId, finger);
                            if (hasTemplate) {
                                enrolledFingers.push(finger);
                            }
                            await new Promise(r => setTimeout(r, 50));
                        }
                        data = { enrolledFingers };
                        break;

                    case 'START_ENROLLMENT':
                        const startCmd = command as any;
                        await driver.startEnrollment(String(startCmd.zkId), startCmd.fingerIndex);
                        data = { status: 'SUCCESS' };
                        break;

                    case 'GET_DEVICE_INFO':
                        const info = await driver.getInfo();
                        const time = await driver.getTime();
                        data = { info, time };
                        break;

                    default:
                        throw new Error(`Unsupported action type: ${(command as any).action}`);
                }

                await driver.disconnect();
                return { success: true, data };
            } catch (error: any) {
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
            return result;
        } catch (error: any) {
            if (timeoutId) clearTimeout(timeoutId);
            console.error(`[Handler] Command "${action}" failed:`, error);
            await driver.disconnect().catch(() => {});
            return { success: false, error: error.message || String(error) };
        }
    });
}
