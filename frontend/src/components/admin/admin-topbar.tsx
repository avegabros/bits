'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { User, Menu, Settings, LogOut, ChevronDown } from 'lucide-react'
import Image from 'next/image'

interface AdminTopbarProps {
  onMenuClick: () => void
  isCollapsed?: boolean
}

export function AdminTopbar({ onMenuClick, isCollapsed = false }: AdminTopbarProps) {
  const router = useRouter()
  const [time, setTime] = useState(new Date())
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    try {
      const employee = localStorage.getItem('employee')
      if (employee) {
        const parsed = JSON.parse(employee)
        setUserName(`${parsed.firstName} ${parsed.lastName}`)
      }
    } catch {
      setUserName('Admin')
    }

    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('employee')
    router.push('/login')
  }

  return (
    <header className={`fixed top-0 right-0 h-16 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4 md:px-8 z-40 transition-all duration-300 ${isCollapsed ? 'md:left-20' : 'md:left-60'
      } left-0`}>
      <div className="flex items-center gap-3 flex-1">
        {/* Mobile Menu Button + Logo */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/images/av.jpg"
              alt="Logo"
              width={32}
              height={32}
              className="object-contain"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect fill="%23E60000" width="32" height="32" rx="8"/%3E%3Ctext x="50%" y="50%" fontSize="14" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold"%3EB%3C/text%3E%3C/svg%3E'
              }}
            />
            <span className="text-[#E60000] font-bold text-lg tracking-tight uppercase">BITS</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        {/* System Status */}
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">System Online</span>
        </div>

        {/* System Time */}
        <div className="hidden sm:block text-right border-l pl-6 border-gray-200">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">System Time</p>
          <p className="text-sm font-black text-gray-700 font-mono tracking-tighter">{time.toLocaleTimeString()}</p>
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 group p-1 rounded-full hover:bg-gray-50 transition-colors"
          >
            <div className="h-9 w-9 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-200 group-hover:scale-105 transition-transform overflow-hidden">
              {profileImage ? (
                <img src={profileImage || "/placeholder.svg"} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User size={18} />
              )}
            </div>
            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in duration-200">
              <div className="px-4 py-3 border-b border-gray-50 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-100 mx-auto mb-2 overflow-hidden border-2 border-white shadow-sm">
                  {profileImage ? (
                    <img src={profileImage || "/placeholder.svg"} className="h-full w-full object-cover" alt="Profile" />
                  ) : (
                    <User className="mx-auto mt-2 text-gray-300" />
                  )}
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Signed in as</p>
                <p className="text-sm font-black text-gray-800 tracking-tight">{userName || 'Admin'}</p>
              </div>
              <div className="p-1">
                <a href="/settings" onClick={() => setIsProfileOpen(false)} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors">
                  <Settings size={16} /> Account Settings
                </a>
              </div>
              <div className="p-1 border-t border-gray-50 mt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
