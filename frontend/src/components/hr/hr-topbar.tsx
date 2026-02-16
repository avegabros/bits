"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, User, Menu, Settings, LogOut, ChevronDown } from 'lucide-react';

export default function TopBar({ setIsMobileOpen }: { setIsMobileOpen: (val: boolean) => void }) {
  const router = useRouter();
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updateImage = () => {
    const savedImage = localStorage.getItem('userProfileImage');
    setProfileImage(savedImage);
  };

  useEffect(() => {
    setMounted(true);
    updateImage();
    const timer = setInterval(() => setTime(new Date()), 1000);

    // Listen for image updates from the profile page
    window.addEventListener('profileUpdate', updateImage);

    return () => {
      clearInterval(timer);
      window.removeEventListener('profileUpdate', updateImage);
    };
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('employee');
    sessionStorage.removeItem('authenticated');
    sessionStorage.removeItem('userEmail');
    router.push('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
      <div className="flex items-center gap-4 flex-1">
        <button onClick={() => setIsMobileOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
          <Menu size={24} />
        </button>
        
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter">ZK-Device Online</span>
        </div>

        <div className="hidden sm:block text-right border-l pl-6 border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">System Time</p>
          <p className="text-sm font-black text-slate-700 font-mono tracking-tighter">{mounted ? time.toLocaleTimeString() : ''}</p>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 group p-1 rounded-full hover:bg-slate-50 transition-colors">
            <div className="h-9 w-9 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-200 group-hover:scale-105 transition-transform overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User size={18} />
              )}
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in duration-200">
              <div className="px-4 py-3 border-b border-slate-50 text-center">
                <div className="h-12 w-12 rounded-full bg-slate-100 mx-auto mb-2 overflow-hidden border-2 border-white shadow-sm">
                  {profileImage ? <img src={profileImage} className="h-full w-full object-cover" /> : <User className="mx-auto mt-2 text-slate-300" />}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signed in as</p>
                <p className="text-sm font-black text-slate-800 tracking-tight">mwehehe</p>
              </div>
              <div className="p-1">
                <Link href="/hr/profile" onClick={() => setIsProfileOpen(false)} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"><User size={16} /> My Profile</Link>
                <Link href="/hr/settings" onClick={() => setIsProfileOpen(false)} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"><Settings size={16} /> Account Settings</Link>
              </div>
              <div className="p-1 border-t border-slate-50 mt-1">
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"><LogOut size={16} /> Logout</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}