import React from 'react';
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmployeeImportModal } from './EmployeeImportModal';
import { EmployeeAddModal } from './EmployeeAddModal';

interface EmployeePageHeaderProps {
  role: 'admin' | 'hr';
  statusFilter: 'Active' | 'Inactive';
  isExporting: boolean;
  onExport: () => void;
  departments: { id: number; name: string }[];
  branches: any[];
  companies: { id: number; name: string }[];
  shifts: any[];
  onImportComplete: () => void;
  isAddOpen: boolean;
  setIsAddOpen: (open: boolean) => void;
  onRegisterEmployee: (formData: any) => Promise<boolean>;
}

export function EmployeePageHeader({
  role, statusFilter, isExporting, onExport,
  departments, branches, companies, shifts, onImportComplete,
  isAddOpen, setIsAddOpen, onRegisterEmployee,
}: EmployeePageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{statusFilter} Employees</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {statusFilter === 'Active' ? 'Manage your active workforce' : 'Review offboarded personnel'}
        </p>
      </div>
      <div className="flex gap-2 items-center">
        {statusFilter === 'Inactive' && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <span>Permanent deletion cannot be undone</span>
          </div>
        )}
        {statusFilter === 'Active' && (
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-red-700 hover:text-white gap-2 transition-all active:scale-95"
            disabled={isExporting}
            onClick={onExport}
          >
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export
          </Button>
        )}
        {role === 'admin' && statusFilter === 'Active' && (
          <EmployeeImportModal departments={departments} branches={branches} companies={companies} shifts={shifts} onImportComplete={onImportComplete} />
        )}
        {(role === 'admin' || role === 'hr') && statusFilter === 'Active' && (
          <EmployeeAddModal departments={departments} branches={branches} companies={companies} shifts={shifts} onSave={onRegisterEmployee} isOpen={isAddOpen} setIsOpen={setIsAddOpen} />
        )}
      </div>
    </div>
  );
}
