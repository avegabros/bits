import { redirect } from 'next/navigation';

/**
 * The standalone "Adjustment Logs" page has been merged into the unified
 * Adjustments section. Redirect any bookmarked or direct hits to the
 * History tab inside /adjustments.
 */
export default function AdjustmentAuditLogsPage() {
    redirect('/adjustments?tab=history');
}

