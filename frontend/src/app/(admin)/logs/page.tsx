import { SystemLogsDashboard } from '@/features/system-logs/components/SystemLogsDashboard'

export const metadata = {
    title: 'System Logs - Admin Panel',
    description: 'Audit trail for all system activities and administrative changes.',
}

export default function SystemLogsPage() {
    return <SystemLogsDashboard />
}