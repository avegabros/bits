"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Clock, FileText, LogOut, X } from 'lucide-react';
import Image from 'next/image';

export default function Sidebar({ isMobileOpen, setIsMobileOpen }: any) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', href: '/hr/dashboard', icon: LayoutDashboard },
    { name: 'Attendance', href: '/hr/attendance', icon: Clock },
    { name: 'Employees', href: '/hr/employees', icon: Users },
    { name: 'Reports', href: '/hr/reports', icon: FileText },
  ];

  return (
    <aside className={`
      fixed top-0 left-0 z-50 w-72 h-screen bg-[#E60000] flex flex-col transition-transform duration-300 ease-in-out
      ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
      lg:translate-x-0
    `}>

      <div className="p-8 flex items-center justify-between">
        <Link
          href="/hr/dashboard"
          onClick={() => setIsMobileOpen(false)}
          className="flex items-center gap-3 hover:opacity-100 transition-opacity active:scale-95 duration-200"
        >
          <div className="rounded-2xl flex items-center justify-center shadow-lg">
            <Image src="/images/av.jpg" alt="Logo" width={70} height={24} className="object-contain" />
          </div>
          <h1 className="text-white font-bold text-2xl tracking-tight uppercase">
            BITS
          </h1>
        </Link>

        <button onClick={() => setIsMobileOpen(false)} className="lg:hidden text-white p-2">
          <X size={24} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-10">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <li key={item.name} className="relative pl-6">
                <Link
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-4 px-6 py-3 relative ${isActive
                    ? 'bg-white text-[#E60000] rounded-l-[30px] z-10'
                    : 'text-white/60 hover:text-white'
                    }`}
                >

                  {isActive && (
                    <div className="absolute right-0 -top-10 w-10 h-10 bg-white before:content-[''] before:absolute before:inset-0 before:bg-[#E60000] before:rounded-br-[30px]" />
                  )}

                  <item.icon size={22} className={isActive ? 'text-[#E60000]' : 'text-white'} />
                  <span className={`font-bold text-lg ${isActive ? 'text-[#E60000]' : ''}`}>
                    {item.name}
                  </span>


                  {isActive && (
                    <div className="absolute right-0 -bottom-10 w-10 h-10 bg-white before:content-[''] before:absolute before:inset-0 before:bg-[#E60000] before:rounded-tr-[30px]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>


      <div className="p-8 mt-auto flex flex-col items-center">

      </div>
    </aside>
  );
}