'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, Menu, Settings, LogOut, ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { useServerTime } from '@/hooks/useServerTime'
import { useDeviceStream, DeviceStatusPayload, DeviceConnectedPayload } from '@/features/devices/hooks/useDeviceStream'

interface AdminTopbarProps {
  onMenuClick: () => void
}

export function AdminTopbar({ onMenuClick }: AdminTopbarProps) {
  const router = useRouter()
  const { serverTime: time, isSynced } = useServerTime(1000)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [userName, setUserName] = useState('')
  const [deviceOnline, setDeviceOnline] = useState<boolean | null>(null)
  const [holidayName, setHolidayName] = useState<string | null>(null)

  // ── SSE: real-time device status ────────────────────────────────────────
  // Replaces the previous 15-second polling interval with an SSE stream.
  const handleDeviceConnected = useCallback((payload: DeviceConnectedPayload) => {
    // On connect, the server sends the current status of all devices.
    // If ANY device is online, show online. If all are offline, show offline.
    const anyOnline = payload.devices.some(d => d.isActive)
    setDeviceOnline(anyOnline)
  }, [])

  const handleDeviceStatus = useCallback((payload: DeviceStatusPayload) => {
    // A single device changed state — update the aggregate indicator.
    setDeviceOnline(payload.isActive)
  }, [])

  useDeviceStream({
    onConnected: handleDeviceConnected,
    onStatusChange: handleDeviceStatus,
  })

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
        setUserName('Admin')
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

  // Fetch holiday name for today (fires once on mount)
  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
    const [year] = today.split('-')
    fetch(`/api/holidays?year=${year}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.holidays) {
          const match = data.holidays.find((h: { date: string; name: string }) =>
            new Date(h.date).toISOString().split('T')[0] === today
          )
          if (match) setHolidayName(match.name)
        }
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }


  return (
    <header className="h-16 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4 md:px-8 fixed top-0 left-0 right-0 z-40">
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
          <span className="hidden md:inline text-gray-400 text-xs font-semibold tracking-wide whitespace-nowrap border-l border-gray-200 pl-3 ml-1">Biometric Integrated Timekeeping System</span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        {/* Device Status
        <div className={`hidden md:flex items-center gap-3 px-3 py-1.5 border rounded-full transition-all duration-500 ${deviceOnline === null
          ? 'bg-gray-50 border-gray-200'
          : deviceOnline
            ? 'bg-emerald-50 border-emerald-100'
            : 'bg-rose-50 border-rose-100'
          }`}>
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${deviceOnline === null ? 'bg-gray-400' : deviceOnline ? 'bg-emerald-400' : 'bg-rose-400'
              }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${deviceOnline === null ? 'bg-gray-400' : deviceOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}></span>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-tighter ${deviceOnline === null ? 'text-gray-500' : deviceOnline ? 'text-emerald-700' : 'text-rose-700'
            }`}>
            {deviceOnline === null ? 'Checking...' : deviceOnline ? 'Device Online' : 'Device Offline'}
          </span>
        </div> */}

        {/* Holiday Badge */}
        {holidayName && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full">
            <span className="text-sm">📅</span>
            <span className="text-xs font-semibold text-indigo-700">Today is {holidayName}</span>
          </div>
        )}

        {/* System Time */}
        <div className="hidden sm:block text-right border-l pl-6 border-gray-200">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">System Time</p>
          <p className="text-sm font-black text-gray-700 font-mono tracking-tighter">{time ? time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '\u00A0'}</p>
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 group p-1 rounded-full hover:bg-gray-100 transition-colors"
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
                <button onClick={() => { setIsProfileOpen(false); router.push('/settings') }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors text-left">
                  <Settings size={16} /> Account Settings
                </button>
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