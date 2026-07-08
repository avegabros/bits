import dotenv from 'dotenv';
import path from 'path';

// Load env variables with override to prevent cached shell values from taking precedence
dotenv.config({ override: true });

export interface DeviceConfig {
    ip: string;
    port: number;
}

export interface AgentConfig {
    cloudUrl: string;
    agentToken: string;
    devices: DeviceConfig[];
    agentLabel: string;
}

function parseDevices(devicesStr?: string): DeviceConfig[] {
    if (!devicesStr) return [];
    
    return devicesStr.split(',').map(dev => {
        const parts = dev.trim().split(':');
        const ip = parts[0];
        const port = parts[1] ? parseInt(parts[1], 10) : 4370;
        return { ip, port };
    }).filter(d => d.ip);
}

const cloudUrl = process.env.BITS_CLOUD_URL || 'ws://localhost:3001';
const agentToken = process.env.AGENT_TOKEN || '';
const devices = parseDevices(process.env.DEVICES);
const agentLabel = process.env.AGENT_LABEL || 'Branch Office Agent';

if (!agentToken) {
    console.error('[Config] ERROR: AGENT_TOKEN is required. Please set it in .env');
    process.exit(1);
}

if (devices.length === 0) {
    console.warn('[Config] WARNING: No devices configured in DEVICES environment variable.');
}

export const config: AgentConfig = {
    cloudUrl,
    agentToken,
    devices,
    agentLabel,
};
