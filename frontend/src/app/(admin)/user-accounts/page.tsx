import { UserAccountsDashboard } from '@/features/user-accounts/components/UserAccountsDashboard'

export const metadata = {
  title: 'User Accounts - Admin Panel',
  description: 'Manage admin and HR user accounts',
}

export default function AdminUserAccountsPage() {
  return <UserAccountsDashboard />
}
