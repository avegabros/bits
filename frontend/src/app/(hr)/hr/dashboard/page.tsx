"use client"
import React from 'react';
import { 
  Users, 
  UserCheck, 
  MapPin, 
  Fingerprint,
  Activity,
  AlertCircle,
  Zap,
  ShieldCheck,
  CalendarDays
} from 'lucide-react';

export default function HRDashboard() {
  const stats = [
    { label: "Total Employees", value: "150", sub: "Active", icon: <Users size={20} />, color: "bg-red-500" },
    { label: "Total Present", value: "138", sub: "Live", icon: <UserCheck size={20} />, color: "bg-emerald-500" },
    { label: "Total Lates", value: "12", sub: "Today", icon: <AlertCircle size={20} />, color: "bg-amber-500" },
    { label: "Total On Leave", value: "5", sub: "Approved", icon: <CalendarDays size={20} />, color: "bg-blue-500" },
  ];

  const branchPresence = [
    { name: "Cebu City Branch", percentage: 94, color: "bg-emerald-500" },
    { name: "Tayud Branch", percentage: 88, color: "bg-red-500" },
    { name: "Makati Branch", percentage: 91, color: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-6">
    
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Dashboard</h1>
        
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-red-500 transition-all cursor-default">
            <div className={`absolute top-0 right-0 w-24 h-24 ${stat.color} opacity-[0.03] -mr-8 -mt-8 rounded-full group-hover:opacity-[0.08] transition-all`} />
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} text-white p-3 rounded-2xl shadow-lg`}>
                {stat.icon}
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.sub}</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
            <p className="text-4xl font-black text-slate-800 mt-2 tracking-tighter">{stat.value}</p>
          </div>
        ))}
      </div>

      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8">
            <div className="relative shrink-0">
              <div className="w-32 h-32 rounded-full border-[12px] border-slate-50 flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full border-[12px] border-red-500 border-t-transparent -rotate-45" />
                <p className="text-2xl font-black text-slate-800">92%</p>
              </div>
            </div>
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Today's Punctuality</h3>
                <p className="text-sm text-slate-400 font-medium tracking-tight leading-relaxed">
                  An overview of workforce clock-in trends and biometric compliance for the current shift.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1.5 bg-slate-50 text-[9px] font-black uppercase text-slate-500 rounded-xl border border-slate-100">138 Present</span>
                <span className="px-3 py-1.5 bg-slate-50 text-[9px] font-black uppercase text-red-500 rounded-xl border border-slate-100">12 Late</span>
              </div>
            </div>
            <div className="hidden xl:block">
               <Fingerprint size={48} className="text-slate-100" />
            </div>
          </div>

          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {branchPresence.map((branch) => (
              <div key={branch.name} className="bg-slate-900 p-6 rounded-[2.5rem] text-white flex flex-col justify-between h-44 shadow-xl">
                <div className="flex justify-between items-center">
                  <div className="flex justify-between items-center">
                  <div className="p-2.5 bg-white/10 rounded-2xl">
                    <MapPin size={18} className="text-red-400" />
                  </div>
                </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-1">{branch.name}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tighter">{branch.percentage}%</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Present</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${branch.color}`} style={{ width: `${branch.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Zap size={18} className="text-amber-500 fill-amber-500" />
            <h3 className="font-black text-[10px] text-slate-800 uppercase tracking-[0.2em]">Live Logs</h3>
          </div>
          
          <div className="space-y-4 flex-1 overflow-hidden">
            {[
              { label: "Mark Anthony", action: "Clocked In", time: "2m ago" },
              { label: "Scanner 02", action: "System Sync", time: "15m ago" },
              { label: "Sarah Jenkins", action: "Clocked Out", time: "1h ago" },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 font-black text-xs text-slate-400 uppercase">
                  {item.label.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tighter leading-none">{item.label}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">{item.action}</p>
                  <p className="text-[9px] text-slate-300 font-medium uppercase mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center gap-3">
             <ShieldCheck size={20} className="text-emerald-500" />
             <p className="text-[9px] text-emerald-700 font-black uppercase leading-tight tracking-wider">
               Secure Connection<br/>Active
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}