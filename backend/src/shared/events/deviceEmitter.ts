import { EventEmitter } from 'events';

/**
 * Singleton EventEmitter for real-time device status events.
 *
 * WHY a singleton: Both zkServices.ts (which emits events when a device
 * goes online or offline) and device.controller.ts (which listens for
 * events to push to SSE clients) must reference the SAME EventEmitter
 * instance. Node.js module caching guarantees that importing this file
 * from multiple modules always returns the same object.
 *
 * This follows the exact same pattern as attendanceEmitter.ts — one
 * emitter per domain, each with its own file to keep concerns separate.
 */
const deviceEmitter = new EventEmitter();

// 100 listeners accommodates one SSE connection per open browser tab.
// Each admin page that uses useDeviceStream() registers one listener.
deviceEmitter.setMaxListeners(100);

export default deviceEmitter;

