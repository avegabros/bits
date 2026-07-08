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
    | { action: 'GET_DEVICE_INFO'; deviceIp: string; devicePort: number };

export interface CommandResult {
    success: boolean;
    data?: any;
    error?: string;
}

export async function handleCommand(command: AgentCommand, deviceQueue: DeviceQueue): Promise<CommandResult> {
    const { action, deviceIp, devicePort } = command;
    const port = devicePort || 4370;

    return deviceQueue.enqueue(deviceIp, async (): Promise<CommandResult> => {
        const driver = new ZKDriver(deviceIp, port);
        try {
            console.log(`[Handler] Executing "${action}" on ${deviceIp}:${port}...`);
            await driver.connect();

            let data: any = null;

            switch (action) {
                case 'TEST_CONNECTION':
                    await driver.getInfo();
                    data = { status: 'ONLINE' };
                    break;

                case 'PULL_ATTENDANCE':
                    const logs = await driver.getLogs();
                    data = logs;
                    break;

                case 'WRITE_FINGERPRINT':
                    const writeCmd = command as any;
                    // templateData is a Buffer received over WebSocket
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
                        "", // password
                        userCmd.role,
                        userCmd.card
                    );
                    await driver.refreshData();
                    data = { status: 'SUCCESS' };
                    break;

                case 'DELETE_USER':
                    const delCmd = command as any;
                    // Try to delete templates first to prevent orphaned templates
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
            console.error(`[Handler] Command "${action}" failed:`, error);
            await driver.disconnect().catch(() => {});
            return { success: false, error: error.message || String(error) };
        }
    });
}
