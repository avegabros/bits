'use client'

import React, { useState } from "react"

import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
