/**
 * Attendance Service - Strategy C (Grace Period Toggle)
 * 
 * This service processes raw AttendanceLog records into clean Attendance check-in/check-out pairs.
 * 
 * Split into modular sub-services for maintainability:
 * - utils: Date/time and holiday helpers
 * - calculator: Metrics and status calculations
 * - processor: Log processing and shift resolution
 * - automation: Background cleanup and auto-checkout tasks
 * - queries: Data retrieval and history fetching
 */

export * from './attendance-utils';
export * from './attendance-calculator';
export * from './attendance-processor';
export * from './attendance-automation';
export * from './attendance-queries';
export * from './attendance.types';
export * from './attendance-conflict.service';
export * from './overtime-validation.service';
export * from './attendance-reassignment.service';
