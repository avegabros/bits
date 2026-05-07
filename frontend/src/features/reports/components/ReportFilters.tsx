import React from 'react';
import { Search } from 'lucide-react';

interface ReportFiltersProps {
  variant?: 'admin' | 'hr';
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  selectedBranch: string;
  setSelectedBranch: (v: string) => void;
  branches: string[];
  selectedDept: string;
  setSelectedDept: (v: string) => void;
  departments: string[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onFilterChange: () => void; // Used to reset pagination when filters change
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  variant = 'admin',
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedBranch,
  setSelectedBranch,
  branches,
  selectedDept,
  setSelectedDept,
  departments,
  searchTerm,
  setSearchTerm,
  onFilterChange,
}) => {
  // Variant-specific styling
  const containerClass = variant === 'hr'
    ? 'bg-white rounded-2xl border border-slate-200 p-5'
    : 'bg-white rounded-2xl border border-slate-200 p-5';   // They are perfectly identical, but we allow future divergence

  return (
    <div className={containerClass}>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold block mb-1.5">
            From
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              onFilterChange();
            }}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold block mb-1.5">
            To
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              onFilterChange();
            }}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold block mb-1.5">
            Branch
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => {
              setSelectedBranch(e.target.value);
              onFilterChange();
            }}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold block mb-1.5">
            Department
          </label>
          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              onFilterChange();
            }}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold block mb-1.5">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              placeholder="Search by name, employee no., or ZK ID..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                onFilterChange();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
