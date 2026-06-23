"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Menu, Settings, LogOut, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useServerTime } from '@/hooks/useServerTime';

export default function TopBar({ setIsMobileOpen }: { setIsMobileOpen: (val: boolean) => void }) {
  const router = useRouter();
  const { serverTime: time } = useServerTime(1000);
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState('');
  const [holidayName, setHolidayName] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const emp = data.employee ?? data
          setUserName(`${emp.firstName}${emp.middleName ? ` ${emp.middleName[0]}.` : ''} ${emp.lastName}${emp.suffix ? ` ${emp.suffix}` : ''}`)
          setProfileImage(emp.profilePicture || null)
        }
      } catch {
        setUserName('Manager')
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

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
      .catch(() => { })
  }, [])

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <button onClick={() => setIsMobileOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-13 overflow-hidden rounded-md border border-red-700 bg-brand-bright">
            <Image src="/images/av.jpg" alt="Logo" fill className="object-contain" priority quality={100} />
          </div>
          <h1 className="text-brand font-black text-2xl tracking-tighter uppercase whitespace-nowrap">BITS</h1>
          <span className="hidden md:inline text-gray-400 text-xs font-semibold tracking-wide whitespace-nowrap border-l border-gray-200 pl-3 ml-1">Manager Portal</span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        {/* Holiday Badge */}
        {holidayName && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full">
            <span className="text-sm">📅</span>
            <span className="text-xs font-semibold text-indigo-700">Today is {holidayName}</span>
          </div>
        )}

        <div className="hidden sm:block text-right border-l pl-6 border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">System Time</p>
          <p className="text-sm font-black text-slate-700 font-mono tracking-tighter">{mounted ? time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : ''}</p>
        </div>

        <div className="relative z-110" ref={dropdownRef}>
          <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 group p-1 rounded-full hover:bg-slate-50 transition-colors">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center transition-transform overflow-hidden relative shrink-0 ${
              profileImage 
                ? 'border-2 border-white shadow-sm bg-white' 
                : 'bg-red-600 text-white shadow-lg shadow-red-200 group-hover:scale-105'
            }`}>
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User size={18} />
              )}
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-120 origin-top-right animate-in fade-in slide-in-from-top-4 zoom-in-95 duration-200 ease-out">
              <div className="px-4 py-3 border-b border-slate-50 text-center">
                <div className="h-12 w-12 rounded-full bg-slate-100 mx-auto mb-2 overflow-hidden border-2 border-white shadow-sm flex items-center justify-center">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User size={24} className="text-slate-400" />
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signed in as</p>
                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{userName || 'Manager'}</p>
              </div>
              <div className="p-1">
                <Link href="/manager/settings" onClick={() => setIsProfileOpen(false)} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors">
                  <Settings size={16} /> Account Settings
                </Link>
              </div>
              <div className="p-1 border-t border-slate-50 mt-1">
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
