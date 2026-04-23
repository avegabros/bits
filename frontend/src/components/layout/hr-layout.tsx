'use client'

import React, { useState } from "react"
import Sidebar from './hr-sidebar'
import TopBar from './hr-topbar'

export function HRLayout({ children }: { children: React.ReactNode }) {
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)

    return (
        <div className="h-screen bg-slate-50 overflow-hidden relative">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-[#E60000] focus:font-bold"
            >
                Skip to main content
            </a>

            <header className="fixed top-0 left-0 right-0 z-40 h-16">
                <TopBar setIsMobileOpen={setIsMobileOpen} />
            </header>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            <Sidebar
                isMobileOpen={isMobileOpen}
                setIsMobileOpen={setIsMobileOpen}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
            />

            <div className={`h-[calc(100vh-4rem)] mt-16 transition-all duration-300 ${isCollapsed ? 'lg:ml-24' : 'lg:ml-68'}`}>
                <main id="main-content" className="h-full overflow-y-auto scrollbar-light p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}