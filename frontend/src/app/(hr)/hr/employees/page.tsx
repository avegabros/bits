"use client"

import React, { useState, useEffect } from 'react';
import { Edit2, ChevronLeft, ChevronRight, AlertCircle, X, UserPlus } from 'lucide-react';

export default function EmployeesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [branchFilter, setBranchFilter] = useState("All Branches");
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const employees = [
    { id: "EMP-001", firstName: "Mark", lastName: "Anthony", role: "Purchasing Officer", dept: "Purchasing", branch: "Cebu City", email: "mark@biptip.com", phone: "0912-345-6789", hireDate: "2023-05-15", status: "Active" },
    { id: "EMP-002", firstName: "Sarah", lastName: "Jenkins", role: "HR Specialist", dept: "Human Resources", branch: "Manila", email: "sarah@biptip.com", phone: "0923-456-7890", hireDate: "2024-01-10", status: "Active" },
    { id: "EMP-003", firstName: "John", lastName: "Doe", role: "IT Support", dept: "I.T.", branch: "Tayud", email: "john@biptip.com", phone: "0934-567-8901", hireDate: "2023-11-20", status: "Inactive" },
    { id: "EMP-004", firstName: "Jane", lastName: "Smith", role: "Accountant", dept: "Accounting", branch: "Cebu City", email: "jane@biptip.com", phone: "0945-678-9012", hireDate: "2022-08-05", status: "Active" },
    { id: "EMP-005", firstName: "Robert", lastName: "Lim", role: "Maintenance Lead", dept: "Engineering & Maintenance", branch: "Tayud", email: "robert@biptip.com", phone: "0956-789-0123", hireDate: "2021-03-12", status: "Active" },
  ];

  const departments = [
    "Purchasing", "Finance", "I.T.", "Accounting", 
    "Human Resources", "Engineering & Maintenance", "Office of the SVP - Corporate Services", "Marketing and Operations"
  ];
  
  const branches = ["Cebu City", "Tayud", "Manila"];

  const activeCount = employees.filter(e => e.status === "Active").length;
  const inactiveCount = employees.filter(e => e.status === "Inactive").length;

  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || 
                          emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = emp.status === statusFilter;
    const matchesDept = deptFilter === "All Departments" || emp.dept === deptFilter;
    const matchesBranch = branchFilter === "All Branches" || emp.branch === branchFilter;

    return matchesSearch && matchesStatus && matchesDept && matchesBranch;
  });

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, deptFilter, branchFilter]);

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const handleUpdate = () => {
    setToastMessage("Employee profile updated successfully!");
    setShowSuccessToast(true);
    setEditingEmployee(null);
  };

  const handleRegister = () => {
    setToastMessage("New employee registered successfully!");
    setShowSuccessToast(true);
    setIsRegistering(false);
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Employee Directory</h1>
          <p className="text-slate-500 text-sm font-medium">Manage and register your workforce</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-red-500/20 outline-none w-64 transition-all"
          />
          <button 
            onClick={() => setIsRegistering(true)}
            className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95 flex items-center gap-2"
          >
            <UserPlus size={18} />
            Register Employee
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-8 h-12">
          {[
            { label: "Active", count: activeCount },
            { label: "Inactive", count: inactiveCount }
          ].map((status) => (
            <button
              key={status.label}
              onClick={() => setStatusFilter(status.label)}
              className={`relative h-full flex items-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all ${
                statusFilter === status.label ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span>{status.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                statusFilter === status.label ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {status.count}
              </span>
              {statusFilter === status.label && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-6 w-full md:w-auto">
          <select 
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer hover:border-red-200 transition-colors"
          >
            <option value="All Branches">All Branches</option>
            {branches.map(branch => (<option key={branch} value={branch}>{branch}</option>))}
          </select>
          
          <select 
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer hover:border-red-200 transition-colors"
          >
            <option value="All Departments">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 w-32">ID</th>
              <th className="px-8 py-5">Employee</th>
              <th className="px-8 py-5">Role</th>
              <th className="px-8 py-5">Department</th>
              <th className="px-8 py-5">Branch Location</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentItems.length > 0 ? (
              currentItems.map((emp) => (
                <tr key={emp.id} className="hover:bg-red-100 transition-colors duration-200 group cursor-default">
                  <td className="px-8 py-5 font-bold text-slate-400 uppercase text-[10px] tracking-widest">{emp.id}</td>
                  <td className="px-8 py-5">
                    <p className="font-bold text-slate-700 underline decoration-red-100 underline-offset-4 decoration-2">
                        {emp.firstName} {emp.lastName}
                    </p>
                  </td>
                  <td className="px-8 py-5 font-bold text-slate-600 text-xs">{emp.role}</td>
                  <td className="px-8 py-5 font-medium text-slate-500 text-xs">{emp.dept}</td>
                  <td className="px-8 py-5 font-medium text-slate-500 text-xs">{emp.branch}</td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => setEditingEmployee(emp)} 
                      className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                    >
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-8 py-24 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  No matching employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isRegistering && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-red-600 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg leading-tight tracking-tight">New Employee Registration</h3>
                <p className="text-[10px] text-red-100 opacity-90 uppercase font-black tracking-widest mt-0.5">Add biometric profile</p>
              </div>
                          </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">First Name</label>
                  <input type="text" placeholder="First Name" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Last Name</label>
                  <input type="text" placeholder="Last Name" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Email Address</label>
                  <input type="email" placeholder="Email Address" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Phone Number</label>
                  <input type="text" placeholder="Phone Number" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Department</label>
                  <select defaultValue="" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none">
                    <option value="" disabled>Assign Department</option>
                    {departments.map(d => (<option key={d} value={d}>{d}</option>))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Assigned Branch</label>
                  <select defaultValue="" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none">
                    <option value="" disabled>Assign Branch</option>
                    {branches.map(b => (<option key={b} value={b}>{b}</option>))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Job Postion</label>
                  <input type="text" placeholder="Job Position" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400">Date Hired</label>
                  <input type="date" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none" />
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50 flex gap-3 shrink-0">
              <button onClick={() => setIsRegistering(false)} className="flex-1 px-4 py-3.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Discard</button>
              <button onClick={handleRegister} className="flex-1 px-4 py-3.5 bg-red-600 text-white rounded-xl text-sm font-black shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95">Register Employee</button>
            </div>
          </div>
        </div>
      )}

      {editingEmployee && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-red-600 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg leading-tight tracking-tight">Edit Employee Profile</h3>
                <p className="text-[10px] text-red-100 opacity-90 uppercase font-black tracking-widest mt-0.5">{editingEmployee.id}</p>
              </div>
              <button onClick={() => setEditingEmployee(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">First Name</label>
                  <input type="text" defaultValue={editingEmployee.firstName} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Last Name</label>
                  <input type="text" defaultValue={editingEmployee.lastName} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Email Address</label>
                  <input type="email" defaultValue={editingEmployee.email} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Phone Number</label>
                  <input type="text" defaultValue={editingEmployee.phone} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Department</label>
                  <select defaultValue={editingEmployee.dept} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20">
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Move to Branch</label>
                  <select defaultValue={editingEmployee.branch} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20">
                    {branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Position</label>
                  <input type="text" defaultValue={editingEmployee.role} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Date Hired</label>
                  <input type="date" defaultValue={editingEmployee.hireDate} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Status</label>
                  <select defaultValue={editingEmployee.status} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3 shadow-sm shadow-amber-600/5">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <div className="text-[10px] text-amber-800 leading-relaxed font-medium">
                  <strong className="block mb-0.5 tracking-tight uppercase">Audit Log Notice</strong>
                  <strong>Warning:</strong> These changes will be logged under your account (mwehehe) for audit purposes.
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50 flex gap-3 shrink-0">
              <button onClick={() => setEditingEmployee(null)} className="flex-1 px-4 py-3.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Discard</button>
              <button onClick={handleUpdate} className="flex-1 px-4 py-3.5 bg-red-600 text-white rounded-xl text-sm font-black shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95">Update</button>
            </div>
          </div>
        </div>
      )}

      {showSuccessToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-[110] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-sm font-bold tracking-tight">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}