'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Clock, FileText, Settings, LayoutDashboard, X, ChevronLeft, ChevronRight, UserCog } from 'lucide-react'
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

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Employees',
      href: '/employees',
      icon: Users,
    },
    {
      label: 'Attendance',
      href: '/attendance',
      icon: Clock,
    },
    {
      label: 'Reports',
      href: '/admin/reports',
      icon: FileText,
    },
    {
      label: 'User Accounts',
      href: '/admin/user-accounts',
      icon: UserCog,
    },
  ]

  const activeIndex = navItems.findIndex(item => pathname === item.href)

  const updateIndicator = useCallback(() => {
    if (listRef.current && activeIndex >= 0) {
      const items = listRef.current.querySelectorAll<HTMLLIElement>(':scope > li')
      const activeLi = items[activeIndex]
      if (activeLi) {
        const link = activeLi.querySelector('a')
        if (link) {
          setIndicator({
            top: activeLi.offsetTop,
            height: link.offsetHeight,
          })
        }
      }
    }
  }, [activeIndex])

  useEffect(() => {
    updateIndicator()
    // Enable transitions only after the first position is set
    const timer = setTimeout(() => setHasMounted(true), 50)
    return () => clearTimeout(timer)
  }, [updateIndicator])

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen bg-[#E60000] flex flex-col cursor-pointer ${isOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 ${isCollapsed ? 'md:w-20' : 'w-60'}`}
        onClick={onToggleCollapse}
        style={{ transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms ease-in-out' }}
      >
        {/* Brand Area */}
        <div className="p-4 flex items-center overflow-hidden" style={{ transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <div className="flex items-center gap-3">
            <Image
              src="/images/av.jpg"
              alt="Logo"
              width={48}
              height={48}
              className="object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect fill="%23E60000" width="48" height="48" rx="8"/%3E%3Ctext x="50%" y="50%" fontSize="16" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold"%3EB%3C/text%3E%3C/svg%3E'
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
        </div >

        {/* Navigation */}
        <nav className="flex-1 mt-6" onClick={(e) => e.stopPropagation()}>
          <ul ref={listRef} className="relative">
            {/* Sliding active indicator */}
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
                {/* Top Inverted Curve */}
                <div
                  className="absolute right-0 -top-[30px] w-[30px] h-[30px] bg-gray-50"
                  style={{ opacity: isCollapsed ? 0 : 1 }}
                >
                  <div className="absolute inset-0 bg-[#E60000] rounded-br-[30px]" />
                </div>
                {/* Bottom Inverted Curve */}
                <div
                  className="absolute right-0 -bottom-[30px] w-[30px] h-[30px] bg-gray-50"
                  style={{ opacity: isCollapsed ? 0 : 1 }}
                >
                  <div className="absolute inset-0 bg-[#E60000] rounded-tr-[30px]" />
                </div>
              </div>
            )}

            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <li
                  key={item.href}
                  className="relative"
                  style={{ padding: '0 0 0 16px', overflow: 'visible' }}
                >
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-4 py-3 relative z-10 ${isActive
                      ? 'text-[#E60000]'
                      : 'text-white/60 hover:text-white'
                      }`}
                    style={{
                      paddingLeft: '12px',
                      paddingRight: isCollapsed ? '12px' : '24px'
                    }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon size={22} className={`shrink-0 ${isActive ? 'text-[#E60000]' : 'text-white'}`} />
                    <span
                      className={`font-bold text-lg whitespace-nowrap ${isActive ? 'text-[#E60000]' : 'text-gray'}`}
                      style={{
                        opacity: isCollapsed ? 0 : 1,
                        width: isCollapsed ? 0 : 'auto',
                        overflow: 'hidden',
                        transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav >


      </aside >
    </>
  )
}
