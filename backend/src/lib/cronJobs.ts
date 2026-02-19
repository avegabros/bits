import cron from 'node-cron';
import { syncZkData } from '../services/zkServices';
import { autoCloseIncompleteAttendance, autoCheckoutEmployees } from '../services/attendance.service';

/**
 * Initialize all cron jobs for automated attendance tracking
 */
export const startCronJobs = () => {
    console.log('[CronJobs] Initializing automated jobs...');

    // Job 1: Sync attendance logs from ZKTeco device every 1 minute
    cron.schedule('*/10 * * * * *', async () => {
        console.log('[CronJob] Running periodic attendance sync...');
        try {
            const result = await syncZkData();
            if (result.success) {
                console.log(`[CronJob] Sync completed: ${result.newLogs || 0} new logs`);
            } else {
                console.error('[CronJob] Sync failed:', result.error);
            }
        } catch (error) {
            console.error('[CronJob] Sync error:', error);
        }
    });

    // Job 2: Auto-close incomplete attendance records at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('[CronJob] Running midnight cleanup...');
        try {
            const closedCount = await autoCloseIncompleteAttendance();
            console.log(`[CronJob] Cleanup completed: ${closedCount} records marked incomplete`);
        } catch (error) {
            console.error('[CronJob] Cleanup error:', error);
        }
    });

    // Job 3: Auto-checkout employees at 11:59 PM (sets checkout to 5:00 PM)
    cron.schedule('59 23 * * *', async () => {
        console.log('[CronJob] Running automatic checkout at end of day...');
        try {
            const count = await autoCheckoutEmployees();
            console.log(`[CronJob] Auto-checkout completed: ${count} employees checked out at 5:00 PM`);
        } catch (error) {
            console.error('[CronJob] Auto-checkout error:', error);
        }
    });

    console.log('[CronJobs] ✓ Periodic sync scheduled (every 10 seconds)');
    console.log('[CronJobs] ✓ Midnight cleanup scheduled (00:00 daily)');
    console.log('[CronJobs] ✓ Auto-checkout scheduled (23:59 daily)');
};
