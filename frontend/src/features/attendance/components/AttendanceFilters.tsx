import React from 'react';
import { Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AttendanceFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  branchFilter: string;
  setBranchFilter: (val: string) => void;
  deptFilter: string;
  setDeptFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  branches: string[];
  departments: string[];
  statuses: { value: string; label: string }[];
  hideBranchFilter?: boolean;
}

export function AttendanceFilters({
  searchQuery,
  setSearchQuery,
  branchFilter,
  setBranchFilter,
  deptFilter,
  setDeptFilter,
  statusFilter,
  setStatusFilter,
  branches,
  departments,
  statuses,
  hideBranchFilter,
}: AttendanceFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-2 bg-secondary/10 p-2 rounded-2xl border border-border shadow-sm w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          placeholder="Search employee..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="flex gap-2">
        {!hideBranchFilter && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44 bg-card border-border font-bold text-xs uppercase tracking-widest text-foreground">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {branches.map(b => (
                <SelectItem key={b} value={b}>{b.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-52 bg-card border-border font-bold text-xs uppercase tracking-widest text-foreground">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {departments.map(d => (
              <SelectItem key={d} value={d}>{d.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-card border-border font-bold text-xs uppercase tracking-widest text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {statuses.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
