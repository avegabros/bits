"use client"
import React, { useState } from 'react';
import { UserPlus, Mail, MapPin, Search, Filter, MoreVertical, Briefcase, ChevronRight, History, BadgeCheck } from 'lucide-react';

export default function EmployeesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [branchFilter, setBranchFilter] = useState("All Branches");

  const employees = [
    { id: "EMP-001", name: "Mark Anthony", dept: "Purchasing", branch: "Cebu City", email: "mark@biptip.com", status: "Active" },
    { id: "EMP-002", name: "Sarah Jenkins", dept: "Human Resources", branch: "Manila", email: "sarah@biptip.com", status: "Active" },
    { id: "EMP-003", name: "John Doe", dept: "I.T.", branch: "Tayud", email: "john@biptip.com", status: "Inactive" },
    { id: "EMP-004", name: "Jane Smith", dept: "Accounting", branch: "Cebu City", email: "jane@biptip.com", status: "Active" },
    { id: "EMP-005", name: "Robert Lim", dept: "Engineering & Maintenance", branch: "Tayud", email: "robert@biptip.com", status: "Active" },
  ];

  const departments = [
    "All Departments",
    "Purchasing",
    "Finance",
    "I.T.",
    "Accounting",
    "Human Resources",
    "Engineering & Maintenance",
    "Office of the SVP - Corporate Services",
    "Marketing and Operations"
  ];
  
  const branches = ["All Branches", "Cebu City", "Tayud", "Manila"];

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = emp.status === statusFilter;
    const matchesDept = deptFilter === "All Departments" || emp.dept === deptFilter;
    const matchesBranch = branchFilter === "All Branches" || emp.branch === branchFilter;

    return matchesSearch && matchesStatus && matchesDept && matchesBranch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Employee Directory</h1>
          <p className="text-slate-500 text-sm font-medium">Manage and register your workforce</p>
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
          <button className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95">
            <UserPlus size={18} /> Register Employee
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-8 h-12">
          {["Active", "Inactive"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`relative h-full text-[11px] font-black uppercase tracking-widest transition-all ${
                statusFilter === status 
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
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-slate-400" />
            </div>
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
            <div className="flex items-center gap-2">
              <Briefcase size={14} className="text-slate-400" />
            </div>
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
              <th className="px-6 py-4 w-16">ID</th>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Department</th>
              <th className="px-6 py-4">Branch</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp, index) => (
                <tr key={emp.id} className="hover:bg-red-50/50 transition-colors duration-200 group">
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">
                    {String(index + 1).padStart(2, '0')}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-700">{emp.name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-500">{emp.dept}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-500">{emp.branch}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-3">
                      <button className="px-4 py-1.5 text-[10px] font-black uppercase bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all active:scale-95 shadow-sm shadow-red-600/10">
                        View 
                      </button>
                    </div>
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