import { EventEmitter } from 'events';

/**
 * Singleton EventEmitter for real-time attendance events.
 *
 * WHY a singleton: Both attendance.service.ts (which emits events when new
 * records are created) and attendance.controller.ts (which listens for events
 * to push to SSE clients) must reference the SAME EventEmitter instance.
 * Node.js module caching guarantees that importing this file from multiple
 * modules always returns the same object.
 *
 * WHY EventEmitter and not a pub/sub library: The entire BITS system runs as
 * a single Node.js process on a Raspberry Pi 5. There is no horizontal scaling
 * or multiple processes to coordinate. A plain EventEmitter is sufficient,
 * has zero dependencies, and adds no infrastructure complexity.
 */
const attendanceEmitter = new EventEmitter();

// Increase the default max listeners from 10 to accommodate one listener
// per open browser tab. With 14 interns each potentially having the
// dashboard open, 10 is too low and would produce Node.js warnings.
attendanceEmitter.setMaxListeners(100);

export default attendanceEmitter;
