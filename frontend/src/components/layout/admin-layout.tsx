'use client'

import React, { useState } from "react"
import { useAuth } from '@/hooks/useAuth'
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout'
import { useTokenRefresh } from '@/hooks/useTokenRefresh'
import { SessionExpiredModal } from './shared/SessionExpiredModal'
import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'

export function AdminLayout({ children }: { children: React.ReactNode }) {
    const { isLoading, isAuthenticated } = useAuth('ADMIN')
    useInactivityTimeout()
    useTokenRefresh()
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
        <div className="h-screen bg-gray-50 overflow-hidden relative">
            <SessionExpiredModal />
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-brand focus:font-bold"
            >
                Skip to main content
            </a>

            {/* Top Bar - full width, above everything */}
            <AdminTopbar onMenuClick={() => setSidebarOpen(true)} />

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <AdminSidebar
                isOpen={sidebarOpen}
                isCollapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content Area */}
            <div className={`flex-1 transition-all duration-300 min-h-0 bg-gray-50 ${sidebarCollapsed ? 'lg:ml-[6rem]' : 'lg:ml-[17rem]'}`}>
                <main id="main-content" className="h-[calc(100vh-4rem)] mt-16 overflow-y-auto scrollbar-light p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}