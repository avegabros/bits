"use client";
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from './hr-sidebar';
import TopBar from './hr-topbar';

export default function HRLayout({ children }: { children: React.ReactNode }) {
    const { isLoading, isAuthenticated } = useAuth('HR');
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const pathname = usePathname();

    // Show loading state while checking auth
    if (isLoading || !isAuthenticated) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-white overflow-hidden relative">

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 lg:ml-72 transition-all duration-300">
                <TopBar setIsMobileOpen={setIsMobileOpen} />

                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    {/* key={pathname} ensures the smooth page transition triggers on navigation */}
                    <div
                        key={pathname}
                        className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out"
                    >
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
