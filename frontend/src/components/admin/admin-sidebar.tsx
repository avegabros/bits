'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Clock, FileText, LayoutDashboard, UserCog, UserX, ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { useRef, useState, useEffect, useCallback } from 'react'

interface AdminSidebarProps {
  isOpen: boolean
  isCollapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

export function AdminSidebar({ isOpen, isCollapsed, onClose, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname()
  const listRef = useRef<HTMLUListElement>(null)
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null)
  const [hasMounted, setHasMounted] = useState(false)

  const isOnEmployees = pathname.startsWith('/employees')

  // Inactive sub-item is toggleable anytime by clicking the chevron
  const [inactiveOpen, setInactiveOpen] = useState(isOnEmployees)

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', href: '/attendance', icon: Clock },
    { label: 'Reports', href: '/admin/reports', icon: FileText },
    { label: 'User Accounts', href: '/admin/user-accounts', icon: UserCog },
  ]

  // Flat list matching rendered <li> order for indicator
  const allItems = [
    { href: '/dashboard' },
    { href: '/employees', matchPrefix: '/employees' },
    { href: '/attendance' },
    { href: '/admin/reports' },
    { href: '/admin/user-accounts' },
  ]

  const activeIndex = allItems.findIndex(item =>
    item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname === item.href
  )

  const updateIndicator = useCallback(() => {
    if (!listRef.current || activeIndex < 0) return
    const items = listRef.current.querySelectorAll<HTMLLIElement>(':scope > li')
    const activeLi = items[activeIndex]
    if (!activeLi) return
    setIndicator({ top: activeLi.offsetTop, height: activeLi.offsetHeight })
  }, [activeIndex])

  useEffect(() => {
    updateIndicator()
    const timer = setTimeout(() => setHasMounted(true), 50)
    return () => clearTimeout(timer)
  }, [updateIndicator])

  // Re-measure after sub-item animation completes
  useEffect(() => {
    const timer = setTimeout(updateIndicator, 320)
    return () => clearTimeout(timer)
  }, [inactiveOpen, isCollapsed, updateIndicator])

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen bg-[#E60000] flex flex-col cursor-pointer ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${isCollapsed ? 'md:w-20' : 'w-60'}`}
        onClick={onToggleCollapse}
        style={{ transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms ease-in-out' }}
      >
        {/* Brand */}
        <div className="p-4 flex items-center overflow-hidden" style={{ transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <div className="flex items-center gap-3">
            <Image
              src="/images/av.jpg"
              alt="Logo"
              width={48}
              height={48}
              className="object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect fill="%23E60000" width="48" height="48" rx="8"/%3E%3Ctext x="50%25" y="50%25" fontSize="16" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold"%3EB%3C/text%3E%3C/svg%3E'
              }}
            />
            <h1
              className="text-white font-bold text-2xl tracking-tight uppercase whitespace-nowrap"
              style={{
                opacity: isCollapsed ? 0 : 1,
                transform: isCollapsed ? 'translateX(-20px)' : 'translateX(0)',
                transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: isCollapsed ? 'none' : 'auto'
              }}
            >
              BITS
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-6" onClick={(e) => e.stopPropagation()}>
          <ul ref={listRef} className="relative">

            {/* Sliding indicator */}
            {indicator && activeIndex >= 0 && (
              <div
                className="absolute left-4 right-0 bg-gray-50 rounded-l-[30px] z-0"
                style={{
                  top: indicator.top,
                  height: indicator.height,
                  transition: hasMounted
                    ? 'top 350ms cubic-bezier(0.4, 0, 0.2, 1), height 350ms cubic-bezier(0.4, 0, 0.2, 1)'
                    : 'none',
                }}
              >
                <div className="absolute right-0 -top-[30px] w-[30px] h-[30px] bg-gray-50" style={{ opacity: isCollapsed ? 0 : 1 }}>
                  <div className="absolute inset-0 bg-[#E60000] rounded-br-[30px]" />
                </div>
                <div className="absolute right-0 -bottom-[30px] w-[30px] h-[30px] bg-gray-50" style={{ opacity: isCollapsed ? 0 : 1 }}>
                  <div className="absolute inset-0 bg-[#E60000] rounded-tr-[30px]" />
                </div>
              </div>
            )}

            {/* Dashboard */}
            <li className="relative" style={{ padding: '0 0 0 16px', overflow: 'visible' }}>
              <Link
                href="/dashboard"
                onClick={onClose}
                className={`flex items-center gap-4 py-3 relative z-10 ${pathname === '/dashboard' ? 'text-[#E60000]' : 'text-white/60 hover:text-white'}`}
                style={{ paddingLeft: '12px', paddingRight: isCollapsed ? '12px' : '24px' }}
                title={isCollapsed ? 'Dashboard' : undefined}
              >
                <LayoutDashboard size={22} className={`shrink-0 ${pathname === '/dashboard' ? 'text-[#E60000]' : 'text-white'}`} />
                <span className="font-bold text-lg whitespace-nowrap" style={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto', overflow: 'hidden', transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  Dashboard
                </span>
              </Link>
            </li>

            {/* Employees — link on the left, chevron toggle on the right */}
            <li className="relative" style={{ padding: '0 0 0 16px', overflow: 'visible' }}>
              <div className="flex items-center relative z-10">
                {/* The main Employees link */}
                <Link
                  href="/employees"
                  onClick={onClose}
                  className={`flex items-center gap-4 py-3 flex-1 ${isOnEmployees ? 'text-[#E60000]' : 'text-white/60 hover:text-white'}`}
                  style={{ paddingLeft: '12px' }}
                  title={isCollapsed ? 'Employees' : undefined}
                >
                  <Users size={22} className={`shrink-0 ${isOnEmployees ? 'text-[#E60000]' : 'text-white'}`} />
                  <span className="font-bold text-lg whitespace-nowrap" style={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto', overflow: 'hidden', transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                    Employees
                  </span>
                </Link>

                {/* Chevron toggle — always clickable */}
                {!isCollapsed && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setInactiveOpen(o => !o); }}
                    className={`p-2 mr-2 rounded-lg transition-colors shrink-0 ${isOnEmployees ? 'text-[#E60000]' : 'text-white/60 hover:text-white'}`}
                    title="Toggle Inactive Employees"
                  >
                    <ChevronDown
                      size={16}
                      style={{ transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)', transform: inactiveOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                )}
              </div>

              {/* Inactive sub-item — slides in/out */}
              {!isCollapsed && (
                <div
                  style={{
                    maxHeight: inactiveOpen ? '56px' : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <div className="pl-4 pr-3 pb-2 relative z-10">
                    <Link
                      href="/employees/inactive"
                      onClick={onClose}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${pathname === '/employees/inactive'
                        ? isOnEmployees
                          ? 'text-[#E60000]'
                          : 'text-white'
                        : isOnEmployees
                          ? 'text-[#E60000]/60 hover:text-[#E60000]'
                          : 'text-white/60 hover:text-white'
                        }`}
                    >
                      <UserX size={15} className="shrink-0" />
                      Inactive Employees
                    </Link>
                  </div>
                </div>
              )}
            </li>

            {/* All other nav items */}
            {navItems.slice(1).map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <li key={item.href} className="relative" style={{ padding: '0 0 0 16px', overflow: 'visible' }}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-4 py-3 relative z-10 ${active ? 'text-[#E60000]' : 'text-white/60 hover:text-white'}`}
                    style={{ paddingLeft: '12px', paddingRight: isCollapsed ? '12px' : '24px' }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon size={22} className={`shrink-0 ${active ? 'text-[#E60000]' : 'text-white'}`} />
                    <span className="font-bold text-lg whitespace-nowrap" style={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto', overflow: 'hidden', transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              )
            })}

          </ul>
        </nav>
      </aside>
    </>
  )
}
