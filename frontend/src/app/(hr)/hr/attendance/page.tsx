"use client"
import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Calendar as CalendarIcon, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Edit2, 
  X, 
  AlertCircle 
} from 'lucide-react';

export default function AttendancePage() {
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [editingLog, setEditingLog] = useState<any>(null); // State for Modal
  const [showSuccessToast, setShowSuccessToast] = useState(false); // State for Toast
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Toast Auto-hide logic
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const attendanceData = [
    { id: "EMP001", name: "Mark Anthony", date: getTodayDate(), in: "07:45 AM", out: "05:00 PM", status: "Present", day: "Monday" },
    { id: "EMP002", name: "Sarah Jenkins", date: getTodayDate(), in: "08:15 AM", out: "05:30 PM", status: "Late", day: "Monday" },
    { id: "EMP003", name: "John Doe", date: "2024-05-21", in: "---", out: "---", status: "Absent", day: "Tuesday" },
    { id: "EMP004", name: "Ariadne Arsolon", date: "2024-05-22", in: "07:50 AM", out: "05:10 PM", status: "Present", day: "Wednesday" },
  ];

  const filteredData = attendanceData.filter(row => {
    const matchesDate = row.date === selectedDate;
    const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          row.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All Status" || row.status === statusFilter;
    return matchesDate && matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Attendance Logs</h1>
        
        <div className="flex gap-2 relative">
          <input 
            type="date"
            ref={dateInputRef}
            className="absolute opacity-0 pointer-events-none"
            onChange={(e) => setSelectedDate(e.target.value)}
            value={selectedDate}
          />
          
          <button 
            onClick={() => dateInputRef.current?.showPicker()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-red-200 transition-all shadow-sm"
          >
            <CalendarIcon size={16} className="text-red-500" />
            <span>
              {selectedDate === getTodayDate() 
                ? `Today, ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` 
                : new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 outline-none" 
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none cursor-pointer"
        >
          <option>All Status</option>
          <option>Present</option>
          <option>Late</option>
          <option>Absent</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Clock In</th>
              <th className="px-6 py-4">Clock Out</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.length > 0 ? (
              filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-red-50/20 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-700 group-hover:text-red-600 transition-colors">{row.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{row.id}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium">{row.date}</td>
                  <td className="px-6 py-4 font-mono text-emerald-600 font-bold">{row.in}</td>
                  <td className="px-6 py-4 font-mono text-slate-600 font-bold">{row.out}</td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 font-black text-[10px] uppercase px-3 py-1 rounded-full border w-fit ${
                      row.status === 'Present' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 
                      row.status === 'Late' ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-red-600 bg-red-50 border-red-100'
                    }`}>
                      {row.status === 'Present' && <CheckCircle size={12} />}
                      {row.status === 'Late' && <Clock size={12} />}
                      {row.status === 'Absent' && <XCircle size={12} />}
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setEditingLog(row)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Edit2 size={16} /> 
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  No matching logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MATCHED MODAL FROM DASHBOARD */}
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
                <textarea placeholder="Enter specific reason..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-24 text-sm outline-none focus:ring-2 focus:ring-red-500/20 resize-none" />
              </div>
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <strong>Warning:</strong> These changes will be logged under your account (mwehehe) for audit purposes.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button onClick={() => setEditingLog(null)} className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 hover:text-slate-700">Discard</button>
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

      {/* ALERT CHUCHU */}
      {showSuccessToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-emerald-500 p-1 rounded-full">
            <CheckCircle size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight ">Record corrected and logged successfully!</span>
        </div>
      )}
    </div>
  );
}