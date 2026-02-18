"use client"
import React, { useState, useEffect } from 'react';
import { Download, Calendar, Search, ChevronRight } from 'lucide-react';

interface EmployeeReport {
  id: number;
  name: string;
  totalDays: number;
  present: number;
  late: number;
  absent: number;
  totalHours: number;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All Departments');
  const [departments, setDepartments] = useState<string[]>([]);

  // Date range — default to current month
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = (() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
  })();

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { window.location.href = '/login'; return; }

      // Fetch employees and attendance for the date range
      const [empRes, attRes] = await Promise.all([
        fetch('/api/employees', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&limit=5000`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (empRes.status === 401 || attRes.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      const empData = await empRes.json();
      const attData = await attRes.json();

      const employees = empData.success ? (empData.employees || empData.data || []) : [];
      const attendance = attData.success ? (attData.data || []) : [];

      // Extract unique departments
      const depts = Array.from(new Set(employees.map((e: any) => e.department).filter(Boolean))) as string[];
      setDepartments(depts);

      // Group attendance by employee
      const empMap = new Map<number, { name: string; dept: string; present: number; late: number; hours: number }>();

      employees.forEach((emp: any) => {
        empMap.set(emp.id, {
          name: `${emp.firstName} ${emp.lastName}`,
          dept: emp.department || '',
          present: 0,
          late: 0,
          hours: 0,
        });
      });

      attendance.forEach((r: any) => {
        const entry = empMap.get(r.employeeId);
        if (!entry) return;

        const checkIn = r.checkInTime ? new Date(r.checkInTime) : null;
        const checkOut = r.checkOutTime ? new Date(r.checkOutTime) : null;

        if (checkIn) {
          const h = checkIn.getHours();
          const m = checkIn.getMinutes();
          if (h > 8 || (h === 8 && m > 0)) {
            entry.late++;
          }
          entry.present++;
        }

        if (checkIn && checkOut) {
          entry.hours += (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        }
      });

      // Compute total working days in range
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      let workingDays = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) workingDays++;
      }

      const result: EmployeeReport[] = [];
      empMap.forEach((val, id) => {
        result.push({
          id,
          name: val.name,
          totalDays: workingDays,
          present: val.present,
          late: val.late,
          absent: workingDays - val.present,
          totalHours: Math.round(val.hours * 100) / 100,
        });
      });

      // Filter by department if applicable
      if (deptFilter !== 'All Departments') {
        const filtered = result.filter(r => {
          const emp = employees.find((e: any) => e.id === r.id);
          return emp?.department === deptFilter;
        });
        setReports(filtered);
      } else {
        setReports(result);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, deptFilter]);

  const filteredReports = reports.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = () => {
    const headers = ['Employee', 'Total Days', 'Present', 'Late', 'Absent', 'Total Hours'];
    const csvData = filteredReports.map(r =>
      [r.name, r.totalDays, r.present, r.late, r.absent, r.totalHours.toFixed(2)].join(',')
    );
    const csv = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Report_${startDate}_to_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const dateLabel = (() => {
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Attendance Reports</h1>
          <p className="text-slate-500 text-sm font-medium">Generate and export historical employee records</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all"
        >
          <Download size={18} />
          Export Report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Department</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 outline-none"
            >
              <option>All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Staff</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Employee name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Report: {dateLabel}
          </span>
          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded font-bold">
            {loading ? '...' : `${filteredReports.length} Employees`}
          </span>
        </div>
        <table className="w-full text-left">
          <thead className="bg-white text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Working Days</th>
              <th className="px-6 py-4">Present</th>
              <th className="px-6 py-4">Late</th>
              <th className="px-6 py-4">Absent</th>
              <th className="px-6 py-4">Total Hrs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold text-xs">
                  Generating report...
                </td>
              </tr>
            ) : filteredReports.length > 0 ? (
              filteredReports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{r.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{r.totalDays}</td>
                  <td className="px-6 py-4 text-sm text-emerald-600 font-bold">{r.present}</td>
                  <td className="px-6 py-4 text-sm text-amber-600 font-bold">{r.late}</td>
                  <td className="px-6 py-4 text-sm text-red-500 font-bold">{r.absent > 0 ? r.absent : 0}</td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">{r.totalHours.toFixed(2)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  No data for selected period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}