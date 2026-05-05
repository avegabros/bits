"use client";
import React, { useState, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Fingerprint,
  History,
} from 'lucide-react';
import { BaseSidebar, useSidebarCollapsed } from './shared/BaseSidebar';
import { SidebarNavItem } from './shared/SidebarNavItem';

function SidebarInner({ isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed }: any) {
  const pathname = usePathname();
  const { collapsed, labelStyle } = useSidebarCollapsed(isCollapsed);

  const isOnAdjust = pathname === '/manager/adjustments';
  const isOnAttendance = pathname === '/manager/attendance';
  const isOnDashboard = pathname === '/manager/dashboard';

  // All rendered <li> items in order for indicator measurement
  const allItems = [
    { href: '/manager/dashboard' },
    { href: '/manager/attendance' },
    { href: '/manager/adjustments' },
  ];

  const activeIndex = allItems.findIndex(item => pathname === item.href);

  const onClose = () => setIsMobileOpen(false);

  return (
    <BaseSidebar
      isOpen={isMobileOpen}
      isCollapsed={isCollapsed}
      onClose={onClose}
      onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      title="Manager Panel"
      activeIndex={activeIndex}
      indicatorDeps={[]}
      expandedWidth="lg:w-64"
    >
      {/* Dashboard */}
      <SidebarNavItem href="/manager/dashboard" label="Dashboard" icon={LayoutDashboard} active={isOnDashboard} collapsed={collapsed} labelStyle={labelStyle} onClick={onClose} />

      {/* Attendance */}
      <SidebarNavItem href="/manager/attendance" label="Attendance" icon={Fingerprint} active={isOnAttendance} collapsed={collapsed} labelStyle={labelStyle} onClick={onClose} />

      {/* Adjustment Logs */}
      <SidebarNavItem href="/manager/adjustments" label="Adjustments" icon={History} active={isOnAdjust} collapsed={collapsed} labelStyle={labelStyle} onClick={onClose} />
    </BaseSidebar>
  );
}

export default function Sidebar(props: any) {
  return (
    <Suspense fallback={null}>
      <SidebarInner {...props} />
    </Suspense>
  );
}
