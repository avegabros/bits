import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import bcrypt from 'bcryptjs'; // Use bcryptjs for maximum compatibility across environments
import { prisma } from '../../shared/lib/prisma';
import deviceEmitter from '../../shared/events/deviceEmitter';

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
    queued?: boolean;
    message?: string;
}

export interface ConnectedAgent {
    socketId: string;
    socket: Socket;
    branchId: number;
    agentLabel: string;
    devices: Array<{ ip: string; port: number }>;
    connectedAt: Date;
    lastHeartbeatAt: Date;
}

// Live connection directory (branchId -> ConnectedAgent)
const connectedAgents = new Map<number, ConnectedAgent>();
let io: Server | null = null;

export function getConnectedAgent(branchId: number): ConnectedAgent | undefined {
    return connectedAgents.get(branchId);
}

export function getAllConnectedAgents(): ConnectedAgent[] {
    return Array.from(connectedAgents.values());
}

export function initAgentGateway(httpServer: HttpServer): Server {
    io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        },
        transports: ['websocket'],
        pingInterval: 60000,
        pingTimeout: 180000,
        maxHttpBufferSize: 50 * 1024 * 1024  // 50MB — safety net for large attendance payloads
    });

    console.log('[Gateway] Initializing Agent WebSocket Gateway...');

    // Authentication middleware
    io.use(async (socket: Socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token || typeof token !== 'string') {
            console.warn('[Gateway] Connection rejected: Missing token.');
            return next(new Error('AUTH_MISSING_TOKEN'));
        }

        try {
            // Find all enabled branch agents to check token hashes
            const agents = await prisma.branchAgent.findMany({
                where: { isEnabled: true },
                select: { id: true, branchId: true, tokenHash: true, label: true }
            });

            let matchedAgent = null;
            for (const agent of agents) {
                const isMatch = await bcrypt.compare(token, agent.tokenHash);
                if (isMatch) {
                    matchedAgent = agent;
                    break;
                }
            }

            if (!matchedAgent) {
                console.warn('[Gateway] Connection rejected: Invalid token.');
                return next(new Error('AUTH_INVALID_TOKEN'));
            }

            // Prevent multiple agents from connecting for the same branch
            if (connectedAgents.has(matchedAgent.branchId)) {
                console.warn(`[Gateway] Connection rejected: Agent for branch ${matchedAgent.branchId} already connected.`);
                return next(new Error('AUTH_BRANCH_ALREADY_CONNECTED'));
            }

            // Bind metadata to socket session
            (socket as any).agentBranchId = matchedAgent.branchId;
            (socket as any).agentLabel = matchedAgent.label;
            (socket as any).agentDbId = matchedAgent.id;

            next();
        } catch (err: any) {
            console.error('[Gateway] Authentication database error:', err);
            return next(new Error('SERVER_AUTH_ERROR'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const branchId = (socket as any).agentBranchId;
        const agentLabel = (socket as any).agentLabel;
        const agentDbId = (socket as any).agentDbId;

        console.log(`[Gateway] ✓ Agent connected: "${agentLabel}" (Branch ID: ${branchId})`);

        connectedAgents.set(branchId, {
            socketId: socket.id,
            socket,
            branchId,
            agentLabel,
            devices: [],
            connectedAt: new Date(),
            lastHeartbeatAt: new Date()
        });

        // Update DB records
        void prisma.branchAgent.update({
            where: { id: agentDbId },
            data: { lastConnectedAt: new Date() }
        }).catch(err => console.error('[Gateway] Failed to update agent connect time:', err));

        // Emit SSE event for UI updating
        deviceEmitter.emit('agent-status-change', {
            branchId,
            status: 'ONLINE',
            agentLabel
        });

        // Listen for announcements
        socket.on('agent:announce', (data: any) => {
            const agent = connectedAgents.get(branchId);
            if (agent) {
                agent.devices = data.devices || [];
            }
            void prisma.branchAgent.update({
                where: { id: agentDbId },
                data: {
                    agentVersion: data.version,
                    metadata: { hostname: data.hostname, devices: data.devices }
                }
            }).catch(err => console.error('[Gateway] Failed to update agent metadata:', err));
        });

        // Listen for heartbeats
        socket.on('agent:heartbeat', (data: any) => {
            const agent = connectedAgents.get(branchId);
            if (agent) {
                agent.lastHeartbeatAt = new Date();
                agent.devices = data.devices || agent.devices;
            }
            void prisma.branchAgent.update({
                where: { id: agentDbId },
                data: { lastHeartbeatAt: new Date() }
            }).catch(err => console.error('[Gateway] Failed to update agent heartbeat:', err));
        });

        // Handle reconnect sync triggers
        socket.on('agent:request-sync', () => {
            console.log(`[Gateway] Agent requested sync for Branch ID: ${branchId}. Flushing offline queue...`);
            void flushOfflineQueue(branchId);
            void triggerBranchAttendanceSync(branchId);
        });

        // Handle disconnects
        socket.on('disconnect', () => {
            connectedAgents.delete(branchId);
            console.warn(`[Gateway] ✗ Agent disconnected: "${agentLabel}" (Branch ID: ${branchId})`);

            void prisma.branchAgent.update({
                where: { id: agentDbId },
                data: { lastDisconnectedAt: new Date() }
            }).catch(err => console.error('[Gateway] Failed to update agent disconnect time:', err));

            deviceEmitter.emit('agent-status-change', {
                branchId,
                status: 'OFFLINE',
                agentLabel
            });
        });
    });

    return io;
}

/**
 * Dispatch command to a branch agent. If agent is offline, queues the task.
 */
export async function sendAgentCommand(
    branchId: number,
    command: AgentCommand,
    timeoutMs: number = 180_000
): Promise<CommandResult> {
    const agent = connectedAgents.get(branchId);

    if (!agent) {
        // Agent offline -> Queue the command for later
        await queueOfflineCommand(branchId, command);
        return {
            success: false,
            error: 'AGENT_OFFLINE',
            queued: true,
            message: `Agent for branch ${branchId} is offline. Command queued for delivery.`
        };
    }

    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            console.warn(`[Gateway] Command timed out for Branch ID ${branchId} after ${timeoutMs}ms.`);
            resolve({ success: false, error: 'AGENT_TIMEOUT' });
        }, timeoutMs);

        agent.socket.emit('agent:command', command, (result: CommandResult) => {
            clearTimeout(timer);
            resolve(result);
        });
    });
}

/**
 * Queue a command in the DeviceSyncTask table.
 */
async function queueOfflineCommand(branchId: number, command: AgentCommand): Promise<void> {
    const device = await prisma.device.findFirst({
        where: { ip: command.deviceIp, branchId }
    });

    if (!device) {
        console.warn(`[Gateway] Cannot queue offline command: Device with IP ${command.deviceIp} not found under Branch ID ${branchId}`);
        return;
    }

    // Reuse the existing DeviceSyncTask schema
    await prisma.deviceSyncTask.create({
        data: {
            deviceId: device.id,
            actionType: command.action,
            entityId: `AGENT_CMD_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            payload: command as any,
            status: 'PENDING'
        }
    });

    console.log(`[Gateway] Command "${command.action}" queued in DB for Branch ${branchId} (Offline).`);
}

/**
 * Flush pending commands for a reconnected agent.
 */
async function flushOfflineQueue(branchId: number): Promise<void> {
    const devices = await prisma.device.findMany({
        where: { branchId },
        select: { id: true }
    });

    const deviceIds = devices.map(d => d.id);
    if (deviceIds.length === 0) return;

    const pendingTasks = await prisma.deviceSyncTask.findMany({
        where: {
            deviceId: { in: deviceIds },
            status: 'PENDING',
            entityId: { startsWith: 'AGENT_CMD_' }
        },
        orderBy: { createdAt: 'asc' }
    });

    if (pendingTasks.length === 0) return;

    console.log(`[Gateway] Flushing ${pendingTasks.length} queued command(s) for Branch ID ${branchId}...`);

    for (const task of pendingTasks) {
        try {
            const result = await sendAgentCommand(branchId, task.payload as AgentCommand);
            await prisma.deviceSyncTask.update({
                where: { id: task.id },
                data: { status: result.success ? 'SUCCESS' : 'FAILED' }
            });
        } catch (err) {
            console.error(`[Gateway] Failed to flush queued task ${task.id}:`, err);
        }
    }
}

/**
 * Trigger sync for all devices under a branch.
 */
async function triggerBranchAttendanceSync(branchId: number): Promise<void> {
    try {
        const devices = await prisma.device.findMany({
            where: { branchId, isActive: true, syncEnabled: true }
        });

        if (devices.length === 0) return;

        console.log(`[Gateway] Triggering background attendance sync for ${devices.length} devices in Branch ${branchId}`);
        
        // Import dynamically to avoid circular dependency loops
        const { syncSingleDevice } = require('./zk/zk-sync.service');

        for (const device of devices) {
            // Run each device sync in the background
            setImmediate(async () => {
                try {
                    await syncSingleDevice(device);
                } catch (err) {
                    console.error(`[Gateway] Auto reconnect sync failed for device "${device.name}":`, err);
                }
            });
        }
    } catch (error) {
        console.error(`[Gateway] Failed to trigger branch attendance sync for branch ${branchId}:`, error);
    }
}
