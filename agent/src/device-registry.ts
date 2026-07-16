/**
 * Local device status registry — the Agent's equivalent of the DB `isActive` flag.
 *
 * Devices start as UNKNOWN (first command will probe).
 * PING_DEVICE is the sole mechanism for transitioning OFFLINE → ONLINE.
 * Any connection error during a command transitions ONLINE → OFFLINE.
 */

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

const CONNECTION_ERRORS = ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH'];

class DeviceRegistry {
    private statuses: Map<string, DeviceStatus> = new Map();

    getStatus(deviceIp: string): DeviceStatus {
        return this.statuses.get(deviceIp) ?? 'UNKNOWN';
    }

    markOnline(deviceIp: string): void {
        const prev = this.statuses.get(deviceIp);
        this.statuses.set(deviceIp, 'ONLINE');
        if (prev !== 'ONLINE') {
            console.log(`[Registry] ${deviceIp} → ONLINE`);
        }
    }

    markOffline(deviceIp: string): void {
        const prev = this.statuses.get(deviceIp);
        this.statuses.set(deviceIp, 'OFFLINE');
        if (prev !== 'OFFLINE') {
            console.log(`[Registry] ${deviceIp} → OFFLINE`);
        }
    }

    /** Check if an error is a connection/network failure */
    isConnectionError(error: unknown): boolean {
        if (!error) return false;
        
        let code = '';
        let msg = '';

        if (typeof error === 'object') {
            const err = error as Record<string, unknown>;
            if (typeof err.code === 'string') {
                code = err.code;
            } else if (typeof err.errno === 'number' || typeof err.errno === 'string') {
                code = String(err.errno);
            }
            if (typeof err.message === 'string') {
                msg = err.message.toUpperCase();
            }
        }
        
        if (!msg) {
            msg = String(error).toUpperCase();
        }

        return CONNECTION_ERRORS.some(e => code === e || msg.includes(e));
    }
}

export const deviceRegistry = new DeviceRegistry();
