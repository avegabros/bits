import { ReportsDashboard } from '@/features/reports/components/ReportsDashboard'

export const metadata = {
  title: 'Attendance Reports - Admin Panel',
  description: 'Generate and export detailed attendance records for all employees.',
}

export default function ReportsPage() {
  return <ReportsDashboard />
}
