"use client"
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserCheck,
  Clock,
  Calendar,
  Activity,
  Info,
  MapPin,
  Download,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface AttendanceRecord {
  id: number;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  hoursWorked: number;
}

export default function HRDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    lateArrivals: 0,
    absent: 0,
  });
  const [recentLogs, setRecentLogs] = useState<AttendanceRecord[]>([]);
  const [userName, setUserName] = useState('HR User');
  const [userRole, setUserRole] = useState('HR');

  useEffect(() => {
    // Load user info from localStorage
    try {
      const employee = localStorage.getItem('employee');
      if (employee) {
        const parsed = JSON.parse(employee);
        setUserName(`${parsed.firstName || ''} ${parsed.lastName || ''}`.trim() || 'HR User');
        setUserRole(parsed.role === 'HR' ? 'HR Payroll Officer' : parsed.role);
      }
    } catch { /* fallback defaults */ }

    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const today = new Date();
      const offset = today.getTimezoneOffset();
      const localDate = new Date(today.getTime() - (offset * 60 * 1000));
      const todayStr = localDate.toISOString().split('T')[0];

      // Fetch employees and today's attendance in parallel
      const [empRes, attRes] = await Promise.all([
        fetch('/api/employees', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/attendance?startDate=${todayStr}&endDate=${todayStr}&limit=100`, {
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

      // Count employees
      const totalStaff = empData.success ? (empData.employees || empData.data || []).length : 0;

      // Process attendance
      const records = attData.success ? (attData.data || []) : [];
      const mapped: AttendanceRecord[] = records.map((r: any) => {
        const emp = r.employee || {};
        const checkInTime = r.checkInTime ? new Date(r.checkInTime) : null;
        const checkOutTime = r.checkOutTime ? new Date(r.checkOutTime) : null;

        let hours = 0;
        if (checkInTime && checkOutTime) {
          hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        }

        let status = 'present';
        if (!checkInTime) {
          status = 'absent';
        } else {
          const checkInHour = checkInTime.getHours();
          const checkInMin = checkInTime.getMinutes();
          if (checkInHour > 8 || (checkInHour === 8 && checkInMin > 0)) {
            status = 'late';
          }
        }

        return {
          id: r.id,
          employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || `Employee #${r.employeeId}`,
          date: todayStr,
          checkIn: checkInTime ? checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '---',
          checkOut: checkOutTime ? checkOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '---',
          status,
          hoursWorked: Math.round(hours * 100) / 100,
        };
      });

      const presentCount = mapped.filter(r => r.status === 'present' || r.status === 'late').length;
      const lateCount = mapped.filter(r => r.status === 'late').length;
      const absentCount = totalStaff - presentCount;

      setStats({
        totalStaff,
        presentToday: presentCount,
        lateArrivals: lateCount,
        absent: absentCount > 0 ? absentCount : 0,
      });

      setRecentLogs(mapped.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDayName = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
  };

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const statCards = [
    { label: "Total Staff", value: stats.totalStaff.toString(), icon: <Users size={20} />, color: "text-red-600 bg-red-50 border-red-100" },
    { label: "Present Today", value: stats.presentToday.toString(), icon: <UserCheck size={20} />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    { label: "Late Arrivals", value: stats.lateArrivals.toString(), icon: <AlertCircle size={20} />, color: "text-amber-600 bg-amber-50 border-amber-100" },
    { label: "Absent", value: stats.absent.toString(), icon: <Calendar size={20} />, color: "text-slate-600 bg-slate-50 border-slate-100" },
  ];

  return (
    <div className="relative space-y-8">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-xl border ${stat.color}`}>
                {stat.icon}
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {loading ? '...' : 'Live Status'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {loading ? '—' : stat.value}
            </p>
          </div>
        ))}
      </div>


      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Info size={18} className="text-red-600" />
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Attendance Management</h3>
            </div>

            <button
              onClick={() => router.push('/hr/reports')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
            >
              <Download size={14} />
              Generate Report
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HR Timekeeper</p>
              <p className="text-sm font-bold text-slate-700 uppercase tracking-tight">{userName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</p>
              <p className="text-sm font-bold text-slate-700 flex items-center gap-1 uppercase tracking-tight">
                <Activity size={14} className="text-red-400" /> {userRole}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Period</p>
              <p className="text-sm font-bold text-slate-700 flex items-center gap-1 uppercase tracking-tight">
                <Calendar size={14} className="text-red-400" /> {currentMonth}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
              <p className="text-sm font-bold text-slate-700 flex items-center gap-1 uppercase tracking-tight">
                <MapPin size={14} className="text-red-400" />
                {loading ? '...' : `${stats.presentToday} / ${stats.totalStaff} Present`}
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
                <th className="px-6 py-4 font-black text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold text-xs">
                    Loading attendance data...
                  </td>
                </tr>
              ) : recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                    No attendance records for today
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-red-50/30 transition group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800 tracking-tight underline decoration-red-100 underline-offset-4">
                      {log.employeeName}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{log.date}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{getDayName(log.date)}</td>
                    <td className="px-6 py-4 text-sm font-mono text-emerald-600 font-bold">{log.checkIn}</td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600 font-bold">{log.checkOut}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md border ${log.status === 'late' ? "bg-red-50 text-red-700 border-red-100" :
                        log.status === 'absent' ? "bg-slate-100 text-slate-600 border-slate-200" :
                          "bg-emerald-50 text-emerald-700 border-emerald-100"
                        }`}>
                        {log.status === 'late' ? 'Late' : log.status === 'absent' ? 'Absent' : 'On Time'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}