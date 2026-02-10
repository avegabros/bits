"use client"
import React, { useState } from 'react';
import { FileText, Download, Calendar, Filter, Search, ChevronRight } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Attendance Reports</h1>
          <p className="text-slate-500 text-sm font-medium">Generate and export historical employee records</p>
        </div>
        <button className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all">
          <Download size={18} />
          Export Master Report
        </button>
      </div>

      {/* Report Filters Area */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date Range</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 outline-none">
                <option>Current Month (Jan 2026)</option>
                <option>Last Month (Dec 2025)</option>
                <option>Custom Range...</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Department</label>
            <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 outline-none">
              <option>All Departments</option>
              <option>HR</option>
              <option>Operations</option>
              <option>Finance</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Staff</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Employee name or ID..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Generated Report Preview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Report Preview: Jan 01 - Jan 30, 2026</span>
          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded font-bold">150 Records Found</span>
        </div>
        <table className="w-full text-left">
           <thead className="bg-white text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Total Days</th>
                <th className="px-6 py-4">Present</th>
                <th className="px-6 py-4">Late</th>
                <th className="px-6 py-4">Total Rendered (Hrs)</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-slate-50">
              <tr className="hover:bg-slate-50 transition cursor-pointer">
                <td className="px-6 py-4 text-sm font-bold text-slate-700">Mark Anthony</td>
                <td className="px-6 py-4 text-sm text-slate-500">22</td>
                <td className="px-6 py-4 text-sm text-emerald-600 font-bold">22</td>
                <td className="px-6 py-4 text-sm text-slate-400">0</td>
                <td className="px-6 py-4 text-sm font-mono text-slate-600">176.00</td>
                <td className="px-6 py-4 text-right"><ChevronRight size={16} className="ml-auto text-slate-300" /></td>
              </tr>
              {/* More rows... */}
           </tbody>
        </table>
      </div>
    </div>
  );
}