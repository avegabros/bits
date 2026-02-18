"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Clock, FileText, X } from 'lucide-react';
import Image from 'next/image';

export default function Sidebar({ isMobileOpen, setIsMobileOpen }: any) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', href: '/hr/dashboard', icon: LayoutDashboard },
    { name: 'Attendance', href: '/hr/attendance', icon: Clock },
    { name: 'Employees', href: '/hr/employees', icon: Users },
    { name: 'Reports', href: '/hr/reports', icon: FileText },
  ];

  // Calculate the active index to determine the glide position
  const activeIndex = menuItems.findIndex(item => item.href === pathname);

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
          className="flex items-center gap-3 active:scale-95 transition-transform duration-200"
        >
          <div className="rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
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

      <nav className="flex-1 mt-10 relative">
        {/* The Gliding Background */}
        {activeIndex !== -1 && (
          <div 
            className="absolute left-6 right-0 bg-white rounded-l-[30px] transition-all duration-500 ease-in-out z-0"
            style={{ 
              height: '52px', // Height of one menu item
              top: `${activeIndex * 56}px`, // index * (height + space-y)
            }}
          >
            {/* Inverted Curve Top */}
            <div className="absolute right-0 -top-10 w-10 h-10 bg-white pointer-events-none before:content-[''] before:absolute before:inset-0 before:bg-[#E60000] before:rounded-br-[30px]" />
            {/* Inverted Curve Bottom */}
            <div className="absolute right-0 -bottom-10 w-10 h-10 bg-white pointer-events-none before:content-[''] before:absolute before:inset-0 before:bg-[#E60000] before:rounded-tr-[30px]" />
          </div>
        )}

        <ul className="space-y-1 relative z-10">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <li key={item.name} className="pl-6">
                <Link
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-4 px-6 h-[52px] transition-colors duration-300 ${
                    isActive ? 'text-[#E60000]' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <item.icon size={22} className="transition-transform duration-300" />
                  <span className="font-bold text-lg">
                    {item.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-8 mt-auto flex flex-col items-center" />
    </aside>
  );
}