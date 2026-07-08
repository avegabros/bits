import { io } from 'socket.io-client';
import { config } from './config';
import { DeviceQueue } from './device-queue';
import { handleCommand } from './device-command-handler';
import os from 'os';

const AGENT_VERSION = '1.0.0';
const HEARTBEAT_INTERVAL_MS = 30_000;

console.log(`[Agent] Starting BITS Branch Agent v${AGENT_VERSION}...`);
console.log(`[Agent] Cloud URL: ${config.cloudUrl}`);
console.log(`[Agent] Devices: ${config.devices.map(d => `${d.ip}:${d.port}`).join(', ')}`);

const socket = io(config.cloudUrl, {
    auth: { token: config.agentToken },
    reconnection: true,
    reconnectionAttempts: Infinity,    // Never give up reconnection
    reconnectionDelay: 2000,           // Start with 2s delay
    reconnectionDelayMax: 30000,       // Max delay 30s
    randomizationFactor: 0.3,          // Jitter to prevent concurrent reconnections
    transports: ['websocket'],         // Skip long-polling
    timeout: 60000,                    // 60s connection timeout to survive large log downloads
});

const deviceQueue = new DeviceQueue();

socket.on('connect', () => {
    console.log(`[Agent] ✓ Connected to cloud (socket.id=${socket.id})`);

    // Report agent metadata (identifying details resolved server-side from token)
    socket.emit('agent:announce', {
        version: AGENT_VERSION,
        devices: config.devices,
        hostname: os.hostname(),
    });
});

socket.on('disconnect', (reason) => {
    console.warn(`[Agent] Disconnected from cloud: ${reason}. Reconnecting automatically...`);
});

socket.on('connect_error', (err) => {
    console.error(`[Agent] Connection error: ${err.message}`);
});

// Periodic heartbeat
setInterval(() => {
    if (socket.connected) {
        socket.emit('agent:heartbeat', {
            timestamp: new Date().toISOString(),
            devices: config.devices,
        });
    }
}, HEARTBEAT_INTERVAL_MS);

// Command listener
socket.on('agent:command', async (command, ack) => {
    console.log(`[Agent] Received command: ${command.action} for ${command.deviceIp}`);
    try {
        const result = await handleCommand(command, deviceQueue);
        ack(result);
    } catch (err: any) {
        console.error('[Agent] Error handling command:', err);
        ack({ success: false, error: err.message || String(err) });
    }
});

// Reconnect trigger
socket.on('connect', () => {
    // Notify server we are connected/reconnected and ready to sync pending data
    socket.emit('agent:request-sync');
});
