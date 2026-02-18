"use client"
import React, { useState, useEffect } from 'react';
import { UserPlus, Search, MapPin, Briefcase } from 'lucide-react';

interface Employee {
  id: number;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  department: string | null;
  branch: string | null;
  position: string | null;
  employmentStatus: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
}

export default function EmployeesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [branchFilter, setBranchFilter] = useState("All Branches");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { window.location.href = '/login'; return; }

      const res = await fetch('/api/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees || data.data || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Derive unique departments and branches from data
  const departments = ["All Departments", ...Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[]];
  const branches = ["All Branches", ...Array.from(new Set(employees.map(e => e.branch).filter(Boolean))) as string[]];

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = `${emp.firstName} ${emp.lastName} ${emp.employeeNumber || ''}`.toLowerCase().includes(searchQuery.toLowerCase());
    const empStatus = emp.employmentStatus === 'ACTIVE' ? 'Active' : 'Inactive';
    const matchesStatus = empStatus === statusFilter;
    const matchesDept = deptFilter === "All Departments" || emp.department === deptFilter;
    const matchesBranch = branchFilter === "All Branches" || emp.branch === branchFilter;
    return matchesSearch && matchesStatus && matchesDept && matchesBranch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Employee Directory</h1>
          <p className="text-slate-500 text-sm font-medium">
            {loading ? 'Loading...' : `${employees.length} employees total`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-red-500/20 outline-none w-64 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-8 h-12">
          {["Active", "Inactive"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`relative h-full text-[11px] font-black uppercase tracking-widest transition-all ${statusFilter === status
                  ? 'text-slate-800'
                  : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              <div className="flex items-center gap-2">
                {status}
              </div>
              {statusFilter === status && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 rounded-t-full animate-in fade-in duration-300" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <MapPin size={14} className="text-slate-400" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer hover:border-red-200 transition-colors"
            >
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Briefcase size={14} className="text-slate-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-1 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer hover:border-red-200 transition-colors"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 w-16">#</th>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Department</th>
              <th className="px-6 py-4">Branch</th>
              <th className="px-6 py-4">Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold text-xs">
                  Loading employees...
                </td>
              </tr>
            ) : filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp, index) => (
                <tr key={emp.id} className="hover:bg-red-50/50 transition-colors duration-200 group">
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-700">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-slate-400">{emp.email || '—'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-500">{emp.department || '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-500">{emp.branch || '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-500">{emp.position || '—'}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                  No matching employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}