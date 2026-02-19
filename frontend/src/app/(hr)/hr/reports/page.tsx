"use client"
import React, { useState } from 'react';
import { Download, Search, ChevronRight, X, Clock, AlertTriangle, CalendarCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-01-30");
  const [viewingDetails, setViewingDetails] = useState<any>(null);

  const reportData = [
    { id: "EMP-001", name: "Mark Anthony", totalLeave: 0, totalAbsents: 0, totalHours: 176.00, totalOvertime: 5.5, totalUndertime: 0, totalLates: 0, 
      details: [
        { date: "2026-01-05", type: "Overtime", duration: "2h", remark: "Project Deadline" },
        { date: "2026-01-12", type: "Overtime", duration: "3.5h", remark: "System Audit" }
      ]
    },
    { id: "EMP-002", name: "Sarah Jenkins", totalLeave: 2, totalAbsents: 1, totalHours: 152.50, totalOvertime: 0, totalUndertime: 2.5, totalLates: 3,
      details: [
        { date: "2026-01-08", type: "Late", duration: "15m", remark: "Traffic" },
        { date: "2026-01-10", type: "Absent", duration: "1 Day", remark: "No Call No Show" },
        { date: "2026-01-15", type: "Leave", duration: "2 Days", remark: "Sick Leave" }
      ]
    },
    { id: "EMP-003", name: "Ariadne Arsolon", totalLeave: 1, totalAbsents: 0, totalHours: 168.00, totalOvertime: 2.0, totalUndertime: 0.5, totalLates: 1,
      details: [
        { date: "2026-01-03", type: "Late", duration: "10m", remark: "Biometric Error" },
        { date: "2026-01-20", type: "Leave", duration: "1 Day", remark: "Vacation" }
      ]
    },
  ];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleExport = () => {
    const excelData = reportData.map(row => ({
      'Employee ID': row.id,
      'Employee Name': row.name,
      'Total Leave Days': row.totalLeave,
      'Total Absents': row.totalAbsents,
      'Total Lates': row.totalLates,
      'Total Overtime (Hrs)': row.totalOvertime,
      'Total Undertime (Hrs)': row.totalUndertime,
      'Total Rendered Hours': row.totalHours
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Summary");
    XLSX.writeFile(workbook, `Attendance_Summary_${fromDate}_to_${toDate}.xlsx`);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden space-y-4 pb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Attendance Reports</h1>
          <p className="text-slate-500 text-[11px] font-medium mt-1">Generate and export historical employee records</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-lg shadow-red-600/20 hover:bg-red-700 active:scale-95 transition-all">
          <Download size={16} /> Export {formatDate(fromDate)} - {formatDate(toDate)}
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Department</label>
            <select className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none"><option>All Departments</option></select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder="Search employees..." className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preview: {formatDate(fromDate)} — {formatDate(toDate)}</span>
          <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-black uppercase tracking-tighter">{reportData.length} Records Found</span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
             <thead className="bg-white text-slate-400 text-[9px] uppercase font-bold tracking-widest border-b border-slate-100 sticky top-0 z-10">
               <tr>
                 <th className="px-6 py-3 bg-white">ID</th>
                 <th className="px-6 py-3 bg-white">Employee</th>
                 <th className="px-6 py-3 text-center bg-white">Leave</th>
                 <th className="px-6 py-3 text-center bg-white">Absents</th>
                 <th className="px-6 py-3 text-center bg-white">Lates</th>
                 <th className="px-6 py-3 text-center bg-white">OT</th>
                 <th className="px-6 py-3 text-center bg-white">UT</th>
                 <th className="px-6 py-3 text-center bg-white">Total (Hrs)</th>
                 <th className="px-6 py-3 text-right bg-white">Action</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {reportData.map((emp) => (
                  <tr key={emp.id} className="hover:bg-red-50/30 transition-colors group cursor-default">
                    <td className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest">{emp.id}</td>
                    <td className="px-6 py-3 font-bold text-slate-700 underline decoration-red-100 underline-offset-4">{emp.name}</td>
                    <td className="px-6 py-3 text-center font-medium text-slate-500">{emp.totalLeave}</td>
                    <td className="px-6 py-3 text-center font-medium text-red-500">{emp.totalAbsents}</td>
                    <td className="px-6 py-3 text-center font-medium text-orange-500">{emp.totalLates}</td>
                    <td className="px-6 py-3 text-center font-bold text-blue-600">+{emp.totalOvertime}h</td>
                    <td className="px-6 py-3 text-center font-bold text-amber-600">-{emp.totalUndertime}h</td>
                    <td className="px-6 py-3 text-center font-mono text-slate-600 font-bold">{emp.totalHours.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => setViewingDetails(emp)} className="p-1.5 text-slate-300 group-hover:text-red-600 transition-colors">
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
             </tbody>
          </table>
        </div>
      </div>

      {viewingDetails && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm leading-tight tracking-tight">{viewingDetails.name}</h3>
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-0.5">{viewingDetails.id} • Activity Breakdown</p>
              </div>
              <button onClick={() => setViewingDetails(null)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors"><X size={18} /></button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Leave", val: viewingDetails.totalLeave, color: "text-slate-600" },
                  { label: "Absent", val: viewingDetails.totalAbsents, color: "text-red-600" },
                  { label: "Lates", val: viewingDetails.totalLates, color: "text-orange-600" },
                  { label: "OT/UT", val: `${viewingDetails.totalOvertime}/${viewingDetails.totalUndertime}`, color: "text-blue-600" }
                ].map((stat) => (
                  <div key={stat.label} className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">{stat.label}</p>
                    <p className={`text-xs font-bold ${stat.color}`}>{stat.val}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Historical Logs</p>
                <div className="space-y-1.5">
                  {viewingDetails.details.map((detail: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${detail.type === 'Leave' ? 'bg-blue-100 text-blue-600' : detail.type === 'Absent' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                          {detail.type === 'Leave' ? <CalendarCheck size={14} /> : <AlertTriangle size={14} />}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-700">{detail.type}: {detail.duration}</p>
                          <p className="text-[9px] text-slate-400 font-medium">{detail.date}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{detail.remark}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            
          </div>
        </div>
      )}
    </div>
  );
}