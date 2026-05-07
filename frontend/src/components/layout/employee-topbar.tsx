'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { User, Menu, Settings, LogOut, ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { useServerTime } from '@/hooks/useServerTime'

interface EmployeeTopbarProps {
  onMenuClick: () => void
}

export function EmployeeTopbar({ onMenuClick }: EmployeeTopbarProps) {
  const router = useRouter()
  const { serverTime: time } = useServerTime(1000)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const emp = data.employee ?? data
          setUserName(`${emp.firstName}${emp.middleName ? ` ${emp.middleName[0]}.` : ''} ${emp.lastName}${emp.suffix ? ` ${emp.suffix}` : ''}`)
        }
      } catch {
        // Fallback or ignore
      }
    }
    fetchUser()
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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="h-16 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4 md:px-8 fixed top-0 left-0 right-0 z-70">
      <div className="flex items-center gap-4 flex-1">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Image
            src="/images/av.jpg"
            alt="Logo"
            width={52}
            height={52}
            className="object-contain rounded-md border border-red-700"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="44" height="44"%3E%3Crect fill="%23E60000" width="44" height="44" rx="6"/%3E%3Ctext x="50%25" y="50%25" fontSize="16" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold"%3EB%3C/text%3E%3C/svg%3E'
            }}
          />
          <h1 className="text-brand font-black text-2xl tracking-tighter uppercase whitespace-nowrap">BITS</h1>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        {/* System Time */}
        <div className="hidden sm:block text-right border-l pl-6 border-gray-200">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">System Time</p>
          <p className="text-sm font-black text-gray-700 font-mono tracking-tighter">{time ? time.toLocaleTimeString() : '\u00A0'}</p>
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 group p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <div className="h-9 w-9 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-200 group-hover:scale-105 transition-transform overflow-hidden">
              <User size={18} />
            </div>
            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in duration-200">
              <div className="px-4 py-3 border-b border-gray-50 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-100 mx-auto mb-2 overflow-hidden border-2 border-white shadow-sm flex items-center justify-center">
                  <User size={24} className="text-gray-400" />
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Signed in as</p>
                <p className="text-sm font-black text-gray-800 tracking-tight">{userName}</p>
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
