'use client'

import React, { useState } from "react"
import { useAuth } from '@/hooks/useAuth'
import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const { isLoading, isAuthenticated } = useAuth('ADMIN')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    // Show loading state while checking auth
    if (isLoading || !isAuthenticated) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-gray-500">Loading...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <AdminSidebar
                isOpen={sidebarOpen}
                isCollapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <AdminTopbar onMenuClick={() => setSidebarOpen(true)} isCollapsed={sidebarCollapsed} />
            <main className={`mt-16 p-4 transition-all duration-300 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-60'} ml-0`}>
                {children}
            </main>
        </div>
    )
}
