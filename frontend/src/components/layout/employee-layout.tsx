'use client'

import React, { useState, useEffect } from "react"
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout'
import { useTokenRefresh } from '@/hooks/useTokenRefresh'
import { SessionExpiredModal } from './shared/SessionExpiredModal'
import { EmployeeSidebar } from './employee-sidebar'
import { EmployeeTopbar } from './employee-topbar'

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
    const { employee, isLoading, isAuthenticated } = useAuth('USER')
    useInactivityTimeout()
    useTokenRefresh()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const pathname = usePathname()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && isAuthenticated && employee?.needsPasswordChange) {
            if (pathname !== '/employee/profile') {
                router.replace('/employee/profile')
            }
        }
    }, [isLoading, isAuthenticated, employee, pathname, router])

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
            <EmployeeTopbar onMenuClick={() => setSidebarOpen(true)} />

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <EmployeeSidebar
                isOpen={sidebarOpen}
                isCollapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content Area */}
            <div className={`h-[calc(100vh-4rem)] mt-16 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-24' : 'lg:ml-68'}`}>
                <main id="main-content" className="h-full overflow-y-auto scrollbar-light p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
