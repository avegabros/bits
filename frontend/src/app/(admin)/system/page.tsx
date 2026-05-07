import { SystemDashboard } from '@/features/system/components/SystemDashboard';

export const metadata = {
    title: 'System Settings - Admin Panel',
    description: 'Manage background cron jobs and synchronization logic.',
};

export default function SystemSettingsPage() {
    return <SystemDashboard />;
}
