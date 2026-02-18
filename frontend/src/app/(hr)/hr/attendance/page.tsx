"use client"
import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeNumber: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  hoursWorked: number;
}

export default function AttendancePage() {
  const getTodayDate = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { window.location.href = '/login'; return; }

      const params = new URLSearchParams({
        startDate: selectedDate,
        endDate: selectedDate,
        limit: '200',
      });

      const res = await fetch(`/api/attendance?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      const data = await res.json();
      if (data.success) {
        const mapped = (data.data || []).map((r: any) => {
          const emp = r.employee || {};
          const checkInTime = r.checkInTime ? new Date(r.checkInTime) : null;
          const checkOutTime = r.checkOutTime ? new Date(r.checkOutTime) : null;
          let hours = 0;
          if (checkInTime && checkOutTime) {
            hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
          }

          let status = 'Present';
          if (!checkInTime) {
            status = 'Absent';
          } else {
            const h = checkInTime.getHours();
            const m = checkInTime.getMinutes();
            if (h > 8 || (h === 8 && m > 0)) status = 'Late';
          }

          return {
            id: r.id,
            employeeId: r.employeeId,
            employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || `Employee #${r.employeeId}`,
            employeeNumber: emp.employeeNumber || `EMP${String(r.employeeId).padStart(3, '0')}`,
            date: selectedDate,
            checkIn: checkInTime ? checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '---',
            checkOut: checkOutTime ? checkOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '---',
            status,
            hoursWorked: Math.round(hours * 100) / 100,
          };
        });
        setRecords(mapped);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = records.filter(row => {
    const matchesSearch = row.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.employeeNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All Status" || row.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Attendance Logs</h1>

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
                ? `Today, ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
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
              <th className="px-6 py-4">Hours</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold text-xs">
                  Loading attendance data...
                </td>
              </tr>
            ) : filteredData.length > 0 ? (
              filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-red-50/20 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-700 group-hover:text-red-600 transition-colors">{row.employeeName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{row.employeeNumber}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium">{row.date}</td>
                  <td className="px-6 py-4 font-mono text-emerald-600 font-bold">{row.checkIn}</td>
                  <td className="px-6 py-4 font-mono text-slate-600 font-bold">{row.checkOut}</td>
                  <td className="px-6 py-4 font-mono text-slate-600 font-bold">{row.hoursWorked > 0 ? row.hoursWorked.toFixed(1) : '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 font-black text-[10px] uppercase px-3 py-1 rounded-full border w-fit ${row.status === 'Present' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                      row.status === 'Late' ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-red-600 bg-red-50 border-red-100'
                      }`}>
                      {row.status === 'Present' && <CheckCircle size={12} />}
                      {row.status === 'Late' && <Clock size={12} />}
                      {row.status === 'Absent' && <XCircle size={12} />}
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  No attendance records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}