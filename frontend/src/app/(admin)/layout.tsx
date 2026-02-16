'use client'

import { AdminLayout } from '@/components/admin/admin-layout'

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
    return <AdminLayout>{children}</AdminLayout>
}
