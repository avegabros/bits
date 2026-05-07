import { prisma } from '../../../shared/lib/prisma';
import { ZKDriver } from '../../../shared/lib/zk-driver';
import { getDriver, connectWithRetry, zkErrMsg } from './zk-connection.service';
let _registrationMutexBusy = false;
const _registrationMutexQueue: Array<() => void> = [];
interface DeviceLockState { busy: boolean; interactivePending: boolean; queue: Array<() => void>; timeoutHandle: ReturnType<typeof setTimeout> | null; }
const _deviceLocks = new Map<number, DeviceLockState>();
const LOCK_TIMEOUT_MS = 90_000;


export async function acquireRegistrationMutex(): Promise<() => void> {
    return new Promise((resolve) => {
        const release = () => {
            const next = _registrationMutexQueue.shift();
            if (next) {
                setTimeout(next, 50);
            } else {
                _registrationMutexBusy = false;
            }
        };

        if (!_registrationMutexBusy) {
            _registrationMutexBusy = true;
            resolve(release);
        } else {
            _registrationMutexQueue.push(() => {
                _registrationMutexBusy = true;
                resolve(release);
            });
        }
    });
}

function getDeviceLockState(deviceId: number): DeviceLockState {
    if (!_deviceLocks.has(deviceId)) {
        _deviceLocks.set(deviceId, {
            busy: false,
            interactivePending: false,
            queue: [],
            timeoutHandle: null,
        });
    }
    return _deviceLocks.get(deviceId)!;
}

export function acquireInteractiveDeviceLock(deviceId: number): Promise<void> {
    const state = getDeviceLockState(deviceId);
    state.interactivePending = true;
    return new Promise((resolve) => {
        if (!state.busy) {
            state.busy = true;
            console.log(`[ZK] Interactive lock acquired for device ${deviceId}.`);
            resolve();
        } else {
            console.log(`[ZK] Device ${deviceId} busy — interactive request jumping to front of queue...`);
            state.queue.unshift(() => {
                state.busy = true;
                resolve();
            });
        }
    });
}

export function acquireDeviceLock(deviceId: number): Promise<void> {
    const state = getDeviceLockState(deviceId);
    return new Promise((resolve) => {
        if (!state.busy) {
            state.busy = true;
            state.timeoutHandle = setTimeout(() => {
                console.warn(`[ZK] ⚠ Lock auto-released after timeout (90s) for device ${deviceId}.`);
                releaseDeviceLock(deviceId);
            }, LOCK_TIMEOUT_MS);
            resolve();
        } else {
            console.log(`[ZK] Device ${deviceId} busy — queuing background request...`);
            state.queue.push(() => {
                state.busy = true;
                state.timeoutHandle = setTimeout(() => {
                    console.warn(`[ZK] ⚠ Lock auto-released after timeout (90s) for device ${deviceId}.`);
                    releaseDeviceLock(deviceId);
                }, LOCK_TIMEOUT_MS);
                resolve();
            });
        }
    });
}

export function releaseDeviceLock(deviceId: number): void {
    const state = getDeviceLockState(deviceId);
    if (state.timeoutHandle) {
        clearTimeout(state.timeoutHandle);
        state.timeoutHandle = null;
    }
    const next = state.queue.shift();
    if (next) {
        setTimeout(next, 500);
    } else {
        state.busy = false;
        state.interactivePending = false;
    }
}

export function tryAcquireDeviceLock(deviceId: number): boolean {
    const state = getDeviceLockState(deviceId);
    if (state.busy || state.interactivePending) {
        return false;
    }
    state.busy = true;
    state.timeoutHandle = setTimeout(() => {
        console.warn(`[ZK] ⚠ Cron lock auto-released after timeout (90s) for device ${deviceId}.`);
        releaseDeviceLock(deviceId);
    }, LOCK_TIMEOUT_MS);
    return true;
}

export function forceReleaseLock(deviceId?: number): void {
    if (deviceId !== undefined) {
        console.warn(`[ZK] Force-releasing device lock for device ${deviceId} via API.`);
        const state = getDeviceLockState(deviceId);
        state.queue.length = 0;
        if (state.timeoutHandle) { clearTimeout(state.timeoutHandle); state.timeoutHandle = null; }
        state.busy = false;
        state.interactivePending = false;
    } else {
        console.warn(`[ZK] Force-releasing ALL device locks via API.`);
        _deviceLocks.forEach((state, id) => {
            state.queue.length = 0;
            if (state.timeoutHandle) { clearTimeout(state.timeoutHandle); state.timeoutHandle = null; }
            state.busy = false;
            state.interactivePending = false;
        });
    }
}




