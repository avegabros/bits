"use client";
import React, { useState } from 'react';
import Sidebar from './hr-sidebar';
import TopBar from './hr-topbar';

export default function HRLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      
      <div className="fixed top-0 left-0 right-0 z-[70]">
        <TopBar setIsMobileOpen={setIsMobileOpen} />
      </div>

      <Sidebar 
        isMobileOpen={isMobileOpen} 
        setIsMobileOpen={setIsMobileOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      
      
      <div className={`
        transition-all duration-300 ease-in-out pt-20
        ${isCollapsed ? 'lg:pl-20' : 'lg:pl-62'}
      `}>
        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}