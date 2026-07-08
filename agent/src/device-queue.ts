/**
 * Maintains a per-device Promise chain to serialize all commands.
 * This prevents concurrent TCP connections to the same ZK device.
 *
 * Usage:
 *   await deviceQueue.enqueue('192.168.1.201', async () => {
 *       // this block is guaranteed to run exclusively for this device
 *       const zk = new ZKDriver('192.168.1.201', 4370);
 *       await zk.connect();
 *       // ... do work ...
 *       await zk.disconnect();
 *   });
 */
export class DeviceQueue {
    private chains: Map<string, Promise<unknown>> = new Map();

    async enqueue<T>(deviceIp: string, fn: () => Promise<T>): Promise<T> {
        const prev = this.chains.get(deviceIp) ?? Promise.resolve();
        const next = prev.then(fn, fn); // Run fn regardless of previous result
        this.chains.set(deviceIp, next.catch(() => {})); // Prevent unhandled rejections
        return next;
    }
}
