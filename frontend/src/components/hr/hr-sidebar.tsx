"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  FileText, 
  X, 
  Settings, 
  Menu 
} from 'lucide-react';

export default function Sidebar({ isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed }: any) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', href: '/hr/dashboard', icon: LayoutDashboard },
    { name: 'Attendance', href: '/hr/attendance', icon: Clock },
    { name: 'Employees', href: '/hr/employees', icon: Users },
    { name: 'Reports', href: '/hr/reports', icon: FileText },
  ];

  const allItems = [...menuItems, { name: 'Settings', href: '/hr/settings', icon: Settings }];
  const activeIndex = allItems.findIndex(item => item.href === pathname);

  return (
    <aside className={`
      fixed top-24 bottom-4 left-4 z-[60] bg-[#E60000] flex flex-col transition-all duration-300 ease-in-out overflow-hidden
      rounded-[20px]
      ${isMobileOpen ? 'translate-x-0' : '-translate-x-[120%]'} 
      lg:translate-x-0
      ${isCollapsed ? 'lg:w-20' : 'lg:w-63'}
    `}>

      <div className="flex items-center h-20 shrink-0 px-7 justify-start relative">
        <div className="w-6 flex items-center justify-center shrink-0">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-white hover:bg-white/10 p-2 rounded-xl transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>
        
        <button 
          onClick={() => setIsMobileOpen(false)} 
          className="lg:hidden absolute right-8 text-white p-2"
        >
          <X size={24} />
        </button>
      </div>

      <nav className="flex-1 mt-2 relative flex flex-col h-full">
        {activeIndex !== -1 && (
          <div 
            className="absolute right-0 bg-slate-50 rounded-l-[30px] transition-all duration-500 ease-in-out z-0 hidden lg:block"
            style={{ 
              height: '56px', 
              top: activeIndex === 4 
                ? `calc(100% - 96px)` 
                : `${activeIndex * 60}px`, 
              left: '14px' 
            }}
          >
            <div className="absolute right-0 -top-10 w-10 h-10 bg-slate-50 pointer-events-none before:content-[''] before:absolute before:inset-0 before:bg-[#E60000] before:rounded-br-[30px]" />
            <div className="absolute right-0 -bottom-10 w-10 h-10 bg-slate-50 pointer-events-none before:content-[''] before:absolute before:inset-0 before:bg-[#E60000] before:rounded-tr-[30px]" />
          </div>
        )}

        <ul className="space-y-1 relative z-10">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name} className="flex justify-start">
                <Link
                  href={item.href}
                  className={`flex items-center h-[56px] w-full transition-all duration-300 rounded-l-[30px] px-7 gap-6
                    ${isActive ? 'text-[#E60000]' : 'text-white/60 hover:text-white'}
                  `}
                >
                  <div className="w-6 h-6 flex items-center justify-center shrink-0 relative">
                    {isActive && (
                      <div className="absolute inset-[-8px] bg-red-400/40 rounded-full animate-in fade-in zoom-in duration-300" />
                    )}
                    <item.icon size={22} className="relative z-10" />
                  </div>
                  <span className={`font-bold text-lg tracking-tight whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    {item.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto px-7 mb-3">
            <div className={`h-[1.5px] bg-white/30 rounded-full transition-all duration-300 ${isCollapsed ? 'w-6' : 'w-full'}`} />
        </div>

        <div className="mb-10 relative z-10 flex justify-start">
          <Link 
            href="/hr/settings" 
            className={`flex items-center h-[56px] w-full transition-all duration-300 rounded-l-[30px] px-7 gap-6
              ${pathname === '/hr/settings' ? 'text-[#E60000]' : 'text-white/60 hover:text-white'}
            `}
          >
            <div className="w-6 h-6 flex items-center justify-center shrink-0 relative">
              {pathname === '/hr/settings' && (
                <div className="absolute inset-[-8px] bg-red-400/40 rounded-full animate-in fade-in zoom-in duration-300" />
              )}
              <Settings size={22} className="relative z-10" />
            </div>
            <span className={`font-bold text-lg tracking-tight whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              Settings
            </span>
          </Link>
        </div>
      </nav>
    </aside>
  );
}