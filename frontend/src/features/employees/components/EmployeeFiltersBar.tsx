import React from 'react';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FilterState {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  selectedDept: string;
  setSelectedDept: (v: string) => void;
  selectedBranch: string;
  setSelectedBranch: (v: string) => void;
  selectedShift: string;
  setSelectedShift: (v: string) => void;
  selectedStatus?: string;
  setSelectedStatus?: (v: string) => void;
}

interface EmployeeFiltersBarProps {
  filters: FilterState;
  departments: { id: number; name: string }[];
  branches: { id: number; name: string }[];
  shifts: { id: number; name: string }[];
  role?: 'admin' | 'hr' | 'manager';
}

export function EmployeeFiltersBar({ filters, departments, branches, shifts, role = 'admin' }: EmployeeFiltersBarProps) {
  return (
    <Card className="bg-card border-border p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, employee no., or ZK ID..."
            className="pl-10 text-foreground"
            value={filters.searchTerm}
            onChange={e => filters.setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filters.selectedDept} onValueChange={filters.setSelectedDept}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{role === 'manager' ? 'All Assigned Departments' : 'All Departments'}</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.selectedBranch} onValueChange={filters.setSelectedBranch}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Branch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.selectedShift} onValueChange={filters.setSelectedShift}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Shift" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shifts</SelectItem>
            {shifts.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {filters.selectedStatus !== undefined && filters.setSelectedStatus !== undefined && (
          <Select value={filters.selectedStatus} onValueChange={filters.setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="STAGED">Staged</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </Card>
  );
}
