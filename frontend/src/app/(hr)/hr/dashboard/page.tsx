"use client"
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  Clock, 
  Calendar, 
  Activity, 
  Info, 
  MapPin, 
  Edit2, 
  Download,
  AlertCircle,
  X,
  CheckCircle 
} from 'lucide-react';

export default function HRDashboard() {
  const [editingLog, setEditingLog] = useState<any>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false); 

  
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const attendanceLogs = [
    { name: "Mark Anthony", date: "2024-05-20", day: "Monday", in: "07:55 AM", out: "05:00 PM", remarks: "0 mins" },
    { name: "Sarah Jenkins", date: "2024-05-21", day: "Tuesday", in: "08:15 AM", out: "05:30 PM", remarks: "15 mins (Late)" },
    { name: "John Doe", date: "2024-05-21", day: "Tuesday", in: "07:45 AM", out: "04:45 PM", remarks: "0 mins" },
  ];

  const stats = [
    { label: "Total Staff", value: "150", icon: <Users size={20} />, color: "text-red-600 bg-red-50 border-red-100" },
    { label: "Present Today", value: "138", icon: <UserCheck size={20} />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    { label: "Late Arrivals", value: "12", icon: <AlertCircle size={20} />, color: "text-amber-600 bg-amber-50 border-amber-100" },
    { label: "On Leave", value: "5", icon: <Calendar size={20} />, color: "text-slate-600 bg-slate-50 border-slate-100" },
  ];

  return (
    <div className="relative space-y-8">
      {/* 1. KPI CARDS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-xl border ${stat.color}`}>
                {stat.icon}
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Status</span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* 2. ATTENDANCE MANAGEMENT TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Info size={18} className="text-red-600" />
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Attendance Management</h3>
            </div>
            
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
            >
              <Download size={14} />
              Generate Report
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HR Timekeeper</p>
              <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">mwehehe</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</p>
              <p className="text-sm font-bold text-slate-700 flex items-center gap-1 uppercase tracking-tight">
                <Activity size={14} className="text-red-400" /> HR Payroll Officer
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Period</p>
              <p className="text-sm font-bold text-slate-700 flex items-center gap-1 uppercase tracking-tight">
                <Calendar size={14} className="text-red-400" /> Jan 2026
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Site</p>
              <p className="text-sm font-bold text-slate-700 flex items-center gap-1 uppercase tracking-tight">
                <MapPin size={14} className="text-red-400" /> Cebu Office
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-black">Employee Name</th>
                <th className="px-6 py-4 font-black">Date</th>
                <th className="px-6 py-4 font-black">Day</th>
                <th className="px-6 py-4 font-black">Clock In</th>
                <th className="px-6 py-4 font-black">Clock Out</th>
                <th className="px-6 py-4 font-black text-center">Remarks</th>
                <th className="px-6 py-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {attendanceLogs.map((log, index) => (
                <tr key={index} className="hover:bg-red-50/30 transition group">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800 tracking-tight underline decoration-red-100 underline-offset-4">
                    {log.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{log.date}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{log.day}</td>
                  <td className="px-6 py-4 text-sm font-mono text-emerald-600 font-bold">{log.in}</td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-600 font-bold">{log.out}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md border ${
                      log.remarks.includes("Late") ? "bg-red-50 text-red-700 border-red-100" : "bg-slate-50 text-slate-600 border-slate-100"
                    }`}>
                      {log.remarks}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setEditingLog(log)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Edit2 size={16} /> 
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MANUAL CORRECTION MODAL */}
      {editingLog && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-red-600 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg leading-tight">Manual Correction</h3>
                <p className="text-xs text-red-100 opacity-80 uppercase font-bold tracking-widest mt-1">
                  Adjusting: {editingLog.name}
                </p>
              </div>
              <button onClick={() => setEditingLog(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Clock In</label>
                  <input type="time" defaultValue="08:00" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Clock Out</label>
                  <input type="time" defaultValue="17:00" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Reason for Adjustment</label>
                <textarea 
                  placeholder="Enter specific reason for documentation..." 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-24 text-sm outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <strong>Warning:</strong> These changes will be logged under your account (mwehehe) for audit purposes.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button onClick={() => setEditingLog(null)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 hover:text-slate-700">
                Discard
              </button>
              <button 
                onClick={() => {
                  setShowSuccessToast(true); 
                  setEditingLog(null);
                }}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95"
              >
                Apply Correction
              </button>
            </div>
          </div>
        </div>
      )}

     
      {showSuccessToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-emerald-500 p-1 rounded-full">
            <CheckCircle size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">Record corrected and logged successfully!</span>
        </div>
      )}
    </div>
  );
}