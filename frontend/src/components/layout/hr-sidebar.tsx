"use client";
import React, { useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  UserX,
  History,
  Building2,
  Fingerprint,
} from 'lucide-react';
import { BaseSidebar, useSidebarCollapsed } from './shared/BaseSidebar';
import { SidebarNavItem } from './shared/SidebarNavItem';
import { SidebarSubMenu } from './shared/SidebarSubMenu';

function SidebarInner({ isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed }: any) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { collapsed, labelStyle } = useSidebarCollapsed(isCollapsed);

  const currentStatus = searchParams.get('status') || 'Active';
  const isInactivePage = pathname === '/hr/employees' && currentStatus === 'Inactive';
  const isOnEmployees = pathname.startsWith('/hr/employees');
  const isOnReports = pathname.startsWith('/hr/reports');
  const isOnAdjust = pathname === '/hr/adjust';
  const isOnOrganization = pathname.startsWith('/hr/organization') || pathname.startsWith('/hr/branches');
  const isOnShifts = pathname.startsWith('/hr/shifts');

  const [employeesOpen, setEmployeesOpen] = useState(isOnEmployees || isInactivePage);

  // All rendered <li> items in order for indicator measurement
  const allItems = [
    { href: '/hr/dashboard' },
    { href: '/hr/attendance' },
    { href: '/hr/employees', matchPrefix: '/hr/employees' },
    { href: '/hr/shifts', matchPrefix: '/hr/shifts' },
    { href: '/hr/organization', matchFn: () => isOnOrganization },
    { href: '/hr/reports', matchFn: () => isOnReports },
    { href: '/hr/adjust' },
  ];

  const activeIndex = allItems.findIndex(item =>
    'matchFn' in item && item.matchFn ? item.matchFn() :
    'matchPrefix' in item && item.matchPrefix ? pathname.startsWith(item.matchPrefix) :
    pathname === item.href
  );

  const onClose = () => setIsMobileOpen(false);

  return (
    <BaseSidebar
      isOpen={isMobileOpen}
      isCollapsed={isCollapsed}
      onClose={onClose}
      onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      title="HR Panel"
      activeIndex={activeIndex}
      indicatorDeps={[employeesOpen]}
      expandedWidth="lg:w-63"
    >
      {/* Dashboard */}
      <SidebarNavItem href="/hr/dashboard" label="Dashboard" icon={LayoutDashboard} active={pathname === '/hr/dashboard'} collapsed={collapsed} labelStyle={labelStyle} onClick={onClose} />

      {/* Attendance */}
      <SidebarNavItem href="/hr/attendance" label="Attendance" icon={Fingerprint} active={pathname === '/hr/attendance'} collapsed={collapsed} labelStyle={labelStyle} onClick={onClose} />

      {/* Employees (with submenu) */}
      <SidebarSubMenu
        href="/hr/employees?status=Active"
        label="Employees"
        icon={Users}
        isGroupActive={isOnEmployees || isInactivePage}
        isOpen={employeesOpen}
        onToggle={() => setEmployeesOpen(o => !o)}
        collapsed={collapsed}
        labelStyle={labelStyle}
        onClose={onClose}
        subItems={[
          {
            href: '/hr/employees?status=Inactive',
            label: 'Inactive Employees',
            icon: UserX,
            isActive: isInactivePage,
          },
        ]}
      />

      {/* Shifts */}
      <SidebarNavItem href="/hr/shifts" label="Shifts" icon={Clock} active={isOnShifts} collapsed={collapsed} labelStyle={labelStyle} onClick={onClose} />

      {/* Organization */}
      <SidebarNavItem href="/hr/organization" label="Organization" icon={Building2} active={isOnOrganization} collapsed={collapsed} labelStyle={labelStyle} onClick={onClose} />

      {/* Reports */}
      <SidebarNavItem href="/hr/reports" label="Reports" icon={FileText} active={isOnReports} collapsed={collapsed} labelStyle={labelStyle} onClick={onClose} />

      {/* Adjustment Logs */}
      <SidebarNavItem href="/hr/adjust" label="Adjustments" icon={History} active={isOnAdjust} collapsed={collapsed} labelStyle={labelStyle} onClick={onClose} />
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