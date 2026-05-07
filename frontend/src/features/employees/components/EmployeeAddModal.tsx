import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Plus, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validateEmployeeForm, EmployeeFormInput } from '@/lib/employeeValidation';
import { formatPhoneNumber } from '../utils/employee-types';
import { useToast } from '@/hooks/useToast';

interface EmployeeAddModalProps {
  departments: { id: number; name: string }[];
  branches: any[];
  companies: { id: number; name: string }[];
  shifts: any[];
  onSave: (employee: EmployeeFormInput) => Promise<boolean>;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}

const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'] as const;

export function EmployeeAddModal({ departments, branches, companies, shifts, onSave, isOpen, setIsOpen }: EmployeeAddModalProps) {
  const [newEmployee, setNewEmployee] = useState({
    employeeNumber: '', firstName: '', lastName: '', middleName: '', suffix: '',
    contactNumber: '', departmentId: '', branchId: '', email: '', hireDate: '', shiftId: '', gender: '', dateOfBirth: ''
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});;
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const { showToast } = useToast();

  // Filter branches by selected company
  const filteredBranches = useMemo(() => {
    if (!selectedCompanyId) return [];
    const compId = parseInt(selectedCompanyId);
    return branches.filter((b: any) =>
      b.companies?.some((c: any) => c.companyId === compId)
    );
  }, [branches, selectedCompanyId]);

  const handleDuplicateBlur = async (field: 'email' | 'contactNumber' | 'employeeNumber') => {
    const value = newEmployee[field].trim();
    if (!value) return;
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return;
    if (field === 'contactNumber' && value.replace(/\D/g, '').length !== 11) return;
    if (field === 'employeeNumber' && value.length < 2) return;
    
    setEmailChecking(true);
    try {
      const res = await fetch(`/api/employees/check-duplicate?field=${field}&value=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (data.success && !data.available) {
        const fieldName = field.replace(/([A-Z])/g, ' $1').toLowerCase();
        const readableLabel = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
        setFormErrors(p => ({ ...p, [field]: `${readableLabel} already in use.` }));
        showToast('warning', 'Duplicate Found', `${readableLabel} is already assigned to another employee.`);
      }
    } finally {
      setEmailChecking(false);
    }
  };

  const resetForm = () => {
    setNewEmployee({
      employeeNumber: '', firstName: '', lastName: '', middleName: '', suffix: '',
      contactNumber: '', departmentId: '', branchId: '', email: '', hireDate: '', shiftId: '', gender: '', dateOfBirth: ''
    });
    setSelectedCompanyId('');
    setFormErrors({});
  };

  const handleSave = async () => {
    // Validate company selection first
    const errors: Record<string, string> = {};
    if (!selectedCompanyId) {
      errors.companyId = 'Please select a company first';
    }

    const dataToValidate = {
      ...newEmployee,
      departmentId: newEmployee.departmentId ? parseInt(newEmployee.departmentId) : undefined,
      branchId: newEmployee.branchId ? parseInt(newEmployee.branchId) : undefined,
      shiftId: newEmployee.shiftId ? parseInt(newEmployee.shiftId) : undefined
    };

    const { data, errors: validationErrors } = validateEmployeeForm(dataToValidate);

    const allErrors = { ...validationErrors, ...errors };

    // Keep existing async duplicate errors if not overwritten
    if (formErrors.email?.includes('already in use') && !allErrors.email) allErrors.email = formErrors.email;
    if (formErrors.contactNumber?.includes('already in use') && !allErrors.contactNumber) allErrors.contactNumber = formErrors.contactNumber;
    if (formErrors.employeeNumber?.includes('already in use') && !allErrors.employeeNumber) allErrors.employeeNumber = formErrors.employeeNumber;
    
    if (Object.keys(allErrors).length > 0) { setFormErrors(allErrors); return; }
    
    setIsRegistering(true);
    const dataWithCompany = { ...(data as EmployeeFormInput), companyId: selectedCompanyId ? parseInt(selectedCompanyId) : undefined };
    const success = await onSave(dataWithCompany);
    if (success) {
      setIsOpen(false);
      resetForm();
    }
    setIsRegistering(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 gap-2"><Plus className="w-4 h-4" /> Add Employee</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="bg-white border-0 max-w-lg p-0 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-white font-bold text-lg">New Employee Registration</DialogTitle>
            <DialogDescription className="text-white/80 text-[10px] uppercase tracking-widest font-bold mt-1">Add to directory</DialogDescription>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div><label className="text-slate-400 text-[10px] uppercase font-bold">Employee ID *</label><input placeholder="e.g. 10001" className={`mt-1 w-full px-3 py-2 rounded-lg border ${formErrors.employeeNumber ? 'border-red-400' : 'border-slate-200'} text-sm outline-none`} value={newEmployee.employeeNumber} onChange={e => { setNewEmployee(p => ({ ...p, employeeNumber: e.target.value })); setFormErrors(p => ({ ...p, employeeNumber: '' })) }} onBlur={() => handleDuplicateBlur('employeeNumber')} />{formErrors.employeeNumber && <p className="text-[11px] text-red-500">{formErrors.employeeNumber}</p>}</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-slate-400 text-[10px] uppercase font-bold">First Name *</label><input placeholder="First Name" className={`mt-1 w-full px-3 py-2 rounded-lg border ${formErrors.firstName ? 'border-red-400' : 'border-slate-200'} text-sm outline-none`} value={newEmployee.firstName} onChange={e => { setNewEmployee(p => ({ ...p, firstName: e.target.value })); setFormErrors(p => ({ ...p, firstName: '' })) }} />{formErrors.firstName && <p className="text-[11px] text-red-500">{formErrors.firstName}</p>}</div>
            <div><label className="text-slate-400 text-[10px] uppercase font-bold">Last Name *</label><input placeholder="Last Name" className={`mt-1 w-full px-3 py-2 rounded-lg border ${formErrors.lastName ? 'border-red-400' : 'border-slate-200'} text-sm outline-none`} value={newEmployee.lastName} onChange={e => { setNewEmployee(p => ({ ...p, lastName: e.target.value })); setFormErrors(p => ({ ...p, lastName: '' })) }} />{formErrors.lastName && <p className="text-[11px] text-red-500">{formErrors.lastName}</p>}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-slate-400 text-[10px] uppercase font-bold">Middle Name</label><input placeholder="Middle Name (optional)" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none" value={newEmployee.middleName} onChange={e => setNewEmployee(p => ({ ...p, middleName: e.target.value }))} /></div>
            <div><label className="text-slate-400 text-[10px] uppercase font-bold">Suffix</label><select className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none" value={newEmployee.suffix} onChange={e => setNewEmployee(p => ({ ...p, suffix: e.target.value }))}><option value="">None</option>{SUFFIX_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold">Gender</label>
              <select className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none" value={newEmployee.gender} onChange={e => setNewEmployee(p => ({ ...p, gender: e.target.value }))}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold">Date of Birth</label>
              <input type="date" className={`mt-1 w-full px-3 py-2 rounded-lg border ${formErrors.dateOfBirth ? 'border-red-400' : 'border-slate-200'} text-sm outline-none`} value={newEmployee.dateOfBirth} onChange={e => { setNewEmployee(p => ({ ...p, dateOfBirth: e.target.value })); setFormErrors(p => ({ ...p, dateOfBirth: '' })) }} />
              {formErrors.dateOfBirth && <p className="text-[11px] text-red-500 mt-1">{formErrors.dateOfBirth}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-slate-400 text-[10px] uppercase font-bold">Email Address *</label><input type="email" placeholder="Email" className={`mt-1 w-full px-3 py-2 rounded-lg border ${formErrors.email ? 'border-red-400' : 'border-slate-200'} text-sm outline-none`} value={newEmployee.email} onChange={e => { setNewEmployee(p => ({ ...p, email: e.target.value })); setFormErrors(p => ({ ...p, email: '' })) }} onBlur={() => handleDuplicateBlur('email')} />{formErrors.email && <p className="text-[11px] text-red-500">{formErrors.email}</p>}</div>
            <div><label className="text-slate-400 text-[10px] uppercase font-bold">Contact Number *</label><input type="tel" placeholder="Contact" maxLength={13} className={`mt-1 w-full px-3 py-2 rounded-lg border ${formErrors.contactNumber ? 'border-red-400' : 'border-slate-200'} text-sm outline-none`} value={newEmployee.contactNumber} onChange={e => { setNewEmployee(p => ({ ...p, contactNumber: formatPhoneNumber(e.target.value) })); setFormErrors(p => ({ ...p, contactNumber: '' })) }} onBlur={() => handleDuplicateBlur('contactNumber')} />{formErrors.contactNumber && <p className="text-[11px] text-red-500">{formErrors.contactNumber}</p>}</div>
          </div>

          {/* Company → Branch (filtered) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold">Company *</label>
              <select
                className={`mt-1 w-full px-3 py-2 rounded-lg border ${formErrors.companyId ? 'border-red-400' : 'border-slate-200'} text-sm outline-none`}
                value={selectedCompanyId}
                onChange={e => {
                  setSelectedCompanyId(e.target.value);
                  setNewEmployee(p => ({ ...p, branchId: '' }));
                  setFormErrors(p => ({ ...p, companyId: '', branchId: '' }));
                }}
              >
                <option value="">Select Company</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {formErrors.companyId && <p className="text-[11px] text-red-500">{formErrors.companyId}</p>}
            </div>
            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold">Branch *</label>
              <select
                className={`mt-1 w-full px-3 py-2 rounded-lg border ${formErrors.branchId ? 'border-red-400' : 'border-slate-200'} text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
                value={newEmployee.branchId}
                disabled={!selectedCompanyId}
                onChange={e => { setNewEmployee(p => ({ ...p, branchId: e.target.value })); setFormErrors(p => ({ ...p, branchId: '' })) }}
              >
                {!selectedCompanyId ? (
                  <option value="">Select a company first</option>
                ) : filteredBranches.length === 0 ? (
                  <option value="">No branches for this company</option>
                ) : (
                  <>
                    <option value="">Select Branch</option>
                    {filteredBranches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </>
                )}
              </select>
              {formErrors.branchId && <p className="text-[11px] text-red-500">{formErrors.branchId}</p>}
            </div>
          </div>

          <div><label className="text-slate-400 text-[10px] uppercase font-bold">Department *</label><select className={`mt-1 w-full px-3 py-2 rounded-lg border ${formErrors.departmentId ? 'border-red-400' : 'border-slate-200'} text-sm outline-none`} value={newEmployee.departmentId} onChange={e => { setNewEmployee(p => ({ ...p, departmentId: e.target.value })); setFormErrors(p => ({ ...p, departmentId: '' })) }}><option value="">Select Dept</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{formErrors.departmentId && <p className="text-[11px] text-red-500">{formErrors.departmentId}</p>}</div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold">Date Hired</label>
              <input type="date" className={`mt-1 w-full px-3 py-2 rounded-lg border ${formErrors.hireDate ? 'border-red-400' : 'border-slate-200'} text-sm outline-none`} value={newEmployee.hireDate} onChange={e => { setNewEmployee(p => ({ ...p, hireDate: e.target.value })); setFormErrors(p => ({ ...p, hireDate: '' })) }} />
              {formErrors.hireDate && <p className="text-[11px] text-red-500 mt-1">{formErrors.hireDate}</p>}
            </div>
            <div><label className="text-slate-400 text-[10px] uppercase font-bold">Work Shift</label><select className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none" value={newEmployee.shiftId} onChange={e => setNewEmployee(p => ({ ...p, shiftId: e.target.value }))}><option value="">No shift assigned</option>{shifts.map(s => <option key={s.id} value={s.id}>[{s.shiftCode}] {s.name}</option>)}</select></div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isRegistering || emailChecking} className="bg-red-600 hover:bg-red-700">
            {isRegistering ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving</> : 'Register'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
