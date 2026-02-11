"use client"
import React from 'react';
import { UserPlus, Mail, Phone, MapPin, Search, Filter, MoreVertical } from 'lucide-react';

export default function EmployeesPage() {
  const employees = [
    { name: "Mark Anthony", role: "UI Designer", dept: "Creative", email: "mark@biptip.com", status: "Active" },
    { name: "Sarah Jenkins", role: "HR Manager", dept: "Human Resources", email: "sarah@biptip.com", status: "Active" },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Register Action */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employee Directory</h1>
          <p className="text-slate-500 text-sm font-medium">Manage and register your workforce</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search employees..."
              className="pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all w-64"
            />
          </div>
          <button className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all">
            <UserPlus size={18} />
            Register New Employee
          </button>
        </div>
      </div>

      {/* Employee List Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {employees.map((emp) => (
          <div key={emp.email} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative group hover:border-red-200 transition-colors">
            <button className="absolute top-2 right-2 text-slate-300 hover:text-slate-600">
              <MoreVertical size={14} />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center text-red-600 font-bold text-sm">
                {emp.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-slate-800 text-sm truncate" title={emp.name}>{emp.name}</h3>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">{emp.role}</p>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium truncate" title={emp.email}>
                <Mail size={12} className="text-slate-300 flex-shrink-0" /> <span className="truncate">{emp.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium truncate">
                <MapPin size={12} className="text-slate-300 flex-shrink-0" /> {emp.dept}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
              <button className="text-[10px] font-bold text-red-600 hover:underline">Profile</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}