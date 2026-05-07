'use client'

import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, Clock, UserCircle } from 'lucide-react'
import { BaseSidebar, useSidebarCollapsed } from './shared/BaseSidebar'
import { SidebarNavItem } from './shared/SidebarNavItem'

interface EmployeeSidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

export function EmployeeSidebar({ isOpen, isCollapsed, onClose, onToggleCollapse }: EmployeeSidebarProps) {
  const pathname = usePathname()
  const { collapsed, labelStyle } = useSidebarCollapsed(isCollapsed)

  const navItems = [
    { label: 'Dashboard', href: '/employee/dashboard', icon: LayoutDashboard },
    { label: 'My Attendance', href: '/employee/attendance', icon: CalendarDays },
    { label: 'My Shift', href: '/employee/shift', icon: Clock },
    { label: 'My Profile', href: '/employee/profile', icon: UserCircle },
  ]

  const activeIndex = navItems.findIndex(item => pathname.startsWith(item.href))

  return (
    <BaseSidebar
      isOpen={isOpen}
      isCollapsed={isCollapsed}
      onClose={onClose}
      onToggleCollapse={onToggleCollapse}
      title="My Portal"
      activeIndex={activeIndex}
      expandedWidth="lg:w-64"
    >
      {navItems.map((item) => (
        <SidebarNavItem
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={pathname.startsWith(item.href)}
          collapsed={collapsed}
          labelStyle={labelStyle}
          onClick={onClose}
        />
      ))}
    </BaseSidebar>
  )
}
