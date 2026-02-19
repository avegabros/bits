"use client"

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Search, 
  Calendar as CalendarIcon, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Edit2, 
  X, 
  AlertCircle,
  MapPin,
  Briefcase,
  Download
} from 'lucide-react';

export default function AttendancePage() {
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [branchFilter, setBranchFilter] = useState("All Branches");
  const [editingLog, setEditingLog] = useState<any>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false); 
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const departments = [
    "All Departments", 
    "Purchasing", 
    "Human Resources", 
    "I.T.", 
    "Engineering"
  ];

  const branches = [
    "All Branches", 
    "Cebu City", 
    "Tayud", 
    "Manila"
  ];

  const attendanceData = [
    { id: "EMP001", name: "Mark Anthony", branch: "Cebu City", dept: "Purchasing", date: getTodayDate(), in: "07:45 AM", out: "05:00 PM", status: "Present", day: "Monday", remarks: "On Time" },
    { id: "EMP002", name: "Sarah Jenkins", branch: "Manila", dept: "Human Resources", date: getTodayDate(), in: "08:15 AM", out: "05:30 PM", status: "Present", day: "Monday", remarks: "Late (15 mins)" },
    { id: "EMP003", name: "John Doe", branch: "Tayud", dept: "I.T.", date: "2024-05-21", in: "---", out: "---", status: "Absent", day: "Tuesday", remarks: "Absent" },
    { id: "EMP004", name: "Ariadne Arsolon", branch: "Cebu City", dept: "Engineering", date: "2024-05-22", in: "07:50 AM", out: "12:00 PM", status: "Present", day: "Wednesday", remarks: "Half-day" },
  ];

  const filteredData = attendanceData.filter(row => {
    const matchesDate = row.date === selectedDate;
    const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          row.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = deptFilter === "All Departments" || row.dept === deptFilter;
    const matchesBranch = branchFilter === "All Branches" || row.branch === branchFilter;

    let matchesStatus = true;
    if (statusFilter === "Present") {
      matchesStatus = row.status === "Present";
    } else if (statusFilter === "Absent") {
      matchesStatus = row.status === "Absent";
    } else if (statusFilter === "Late") {
      matchesStatus = row.remarks.includes("Late");
    } else if (statusFilter === "Half-day") {
      matchesStatus = row.remarks === "Half-day";
    }
      
    return matchesDate && matchesSearch && matchesStatus && matchesDept && matchesBranch;
  });

  const exportToExcel = () => {
    const excelData = filteredData.map(row => ({
      'ID': row.id, 
      'Employee Name': row.name, 
      'Branch': row.branch, 
      'Department': row.dept, 
      'Date': row.date, 
      'Clock In': row.in, 
      'Clock Out': row.out, 
      'Status': row.status, 
      'Remarks': row.remarks
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    
    const wscols = [
      {wch: 10}, {wch: 25}, {wch: 15}, {wch: 20}, 
      {wch: 12}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 20}
    ];
    worksheet['!cols'] = wscols;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Logs");
    XLSX.writeFile(workbook, `Attendance_Report_${selectedDate}.xlsx`);
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Attendance Logs</h1>
          <p className="text-slate-500 text-sm font-medium">Monitor and manage daily employee time records</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto relative">
          <input 
            type="date" 
            ref={dateInputRef} 
            className="absolute opacity-0 pointer-events-none" 
            onChange={(e) => setSelectedDate(e.target.value)} 
            value={selectedDate} 
          />
          
          <button 
            onClick={() => dateInputRef.current?.showPicker()} 
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-red-200 transition-all shadow-sm w-full sm:w-auto"
          >
            <CalendarIcon size={16} className="text-red-500" />
            <span>
              {selectedDate === getTodayDate() 
                ? `Today, ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` 
                : new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </button>

          <button 
            onClick={exportToExcel} 
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95 w-full sm:w-auto"
          >
            <Download size={16} /> 
            <span>Export Log</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search employees..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-60 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 outline-none" 
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            
            <select 
              value={branchFilter} 
              onChange={(e) => setBranchFilter(e.target.value)} 
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none cursor-pointer hover:border-red-200 transition-colors"
            >
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            
            <select 
              value={deptFilter} 
              onChange={(e) => setDeptFilter(e.target.value)} 
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none cursor-pointer hover:border-red-200 transition-colors"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)} 
            className="px-6 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none cursor-pointer hover:border-red-200 transition-colors"
          >
            <option value="All Status">All Status</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Half-day">Half-day</option>
            <option value="Absent">Absent</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr><th className="px-6 py-4 w-16">ID</th><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Branch</th><th className="px-6 py-4">Department</th><th className="px-6 py-4">Clock In</th><th className="px-6 py-4">Clock Out</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-center">Remarks</th><th className="px-6 py-4 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.length > 0 ? (
              filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-red-100 transition-colors duration-200 group cursor-default">
                  <td className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] tracking-widest">{row.id}</td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-700 underline decoration-red-100 underline-offset-4">{row.name}</p>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-500">{row.branch}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-500">{row.dept}</td>
                  <td className="px-6 py-4 font-mono text-emerald-600 font-bold">{row.in}</td>
                  <td className="px-6 py-4 font-mono text-slate-600 font-bold">{row.out}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <span className={`flex items-center gap-1.5 font-black text-[10px] uppercase px-3 py-1 rounded-full border ${
                        row.status === 'Present' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'
                      }`}>
                        {row.status === 'Present' ? <CheckCircle size={12} /> : <XCircle size={12} />} {row.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md border ${row.remarks.includes("Late") || row.remarks === "Absent" ? "bg-red-50 text-red-700 border-red-100" : row.remarks === "Half-day" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-slate-50 text-slate-600 border-slate-100"}`}>{row.remarks}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setEditingLog(row)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No matching logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editingLog && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
            <div className="p-5 bg-red-600 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg leading-tight tracking-tight">Manual Time Changes</h3>
                <p className="text-[10px] text-red-100 opacity-90 uppercase font-black tracking-widest mt-0.5">Adjusting Record: {editingLog.id}</p>
              </div>
                          </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-sm font-bold text-slate-800 leading-none">{editingLog.name}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{editingLog.dept} • {editingLog.branch}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Attendance Status</label>
                  <select className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"><option value="Present">Present</option><option value="Absent">Absent</option></select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Remarks Type</label>
                  <select className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"><option value="On Time">On Time</option><option value="Late">Late</option><option value="Half-day">Half-day</option></select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><Clock size={10} className="text-emerald-500" /> Clock In</label>
                  <input type="time" defaultValue="08:00" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><Clock size={10} className="text-red-500" /> Clock Out</label>
                  <input type="time" defaultValue="17:00" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Reason</label>
                <textarea placeholder="Reason for adjustment..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-16 text-xs outline-none focus:ring-2 focus:ring-red-500/20 resize-none" />
              </div>

              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3 shadow-sm shadow-amber-600/5">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                  <strong className="block mb-0.5 tracking-tight uppercase">Audit Log Notice</strong>
                  <strong>Warning:</strong> These changes will be logged under your account (mwehehe) for audit purposes.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 flex gap-3 shrink-0">
              <button onClick={() => setEditingLog(null)} className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800">Discard</button>
              <button onClick={() => { setShowSuccessToast(true); setEditingLog(null); }} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95">Apply Changes</button>
            </div>
          </div>
        </div>
      )}

      {showSuccessToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-[110]">
          <span className="text-sm font-bold tracking-tight">Record corrected and logged successfully!</span>
        </div>
      )}
    </div>
  );
}