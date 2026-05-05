import { useState, useEffect, useCallback, useMemo } from 'react';
import { Employee, ShiftOption } from '../utils/employee-types';
import { validateEmployeeId } from '@/lib/employeeValidation';
import { useTableSort } from '@/hooks/useTableSort';
import { formatFullName } from '../utils/employee-types';

interface UseEmployeesProps {
  statusFilter?: string; // 'Active' | 'Inactive'
}

export function useEmployees({ statusFilter = 'ACTIVE' }: UseEmployeesProps = {}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string; logo?: string | null; address?: string | null }[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedShift, setSelectedShift] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState('All Companies');

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees');
      if (res.status === 401) { window.location.href = '/login'; return; }
      const data = await res.json();
      if (data.success) {
        if (statusFilter.toUpperCase() === 'ACTIVE') {
          setEmployees(data.employees.filter((e: Employee) => (e.employmentStatus === 'ACTIVE' || e.employmentStatus === 'STAGED') && e.role === 'USER'));
        } else {
          setEmployees(data.employees.filter((e: Employee) => e.employmentStatus === statusFilter.toUpperCase() && e.role === 'USER'));
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchDependencies = useCallback(async () => {
    try {
      const [deptRes, branchRes, shiftRes, companyRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/branches'),
        fetch('/api/shifts', { credentials: 'include' }),
        fetch('/api/companies'),
      ]);
      const [deptData, branchData, shiftData, companyData] = await Promise.all([
        deptRes.ok ? deptRes.json() : { success: false, departments: [] },
        branchRes.ok ? branchRes.json() : { success: false, branches: [] },
        shiftRes.ok ? shiftRes.json() : { success: false, shifts: [] },
        companyRes.ok ? companyRes.json() : { success: false, companies: [] },
      ]);
      if (deptData.success) setDepartments(deptData.departments);
      if (branchData.success) setBranches(branchData.branches);
      if (shiftData.success) setShifts(shiftData.shifts.filter(Boolean));
      if (companyData.success) setCompanies(companyData.companies);
    } catch (e) {
      console.error('Error fetching dependencies:', e);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchDependencies();
  }, [fetchEmployees, fetchDependencies]);

  // ── Company tab: derived lists ──────────────────────────────────────────────
  const companyNames = useMemo(() => ['All Companies', ...companies.map(c => c.name)], [companies]);

  const filteredBranches = useMemo(() => {
    if (selectedCompany === 'All Companies') return branches;
    return branches.filter((b: any) =>
      b.companies?.some((link: any) => link.company.name === selectedCompany)
    );
  }, [branches, selectedCompany]);

  // Reset branch filter when company changes
  useEffect(() => {
    setSelectedBranch('all');
  }, [selectedCompany]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const fullName = formatFullName(emp.firstName, emp.middleName, emp.lastName, emp.suffix).toLowerCase();
      const searchStr = searchTerm.toLowerCase().trim();
      const isNumericSearch = searchStr !== '' && !isNaN(Number(searchStr));

      const matchesSearch =
        !searchStr ||
        fullName.includes(searchStr) ||
        (emp.email || '').toLowerCase().includes(searchStr) ||
        (emp.employeeNumber || '').toLowerCase().includes(searchStr) ||
        (emp.contactNumber || '').replace(/\s/g, '').toLowerCase().includes(searchStr.replace(/\s/g, '')) ||
        (emp.Shift?.name || '').toLowerCase().includes(searchStr) ||
        (emp.Shift?.shiftCode || '').toLowerCase().includes(searchStr) ||
        // Only compare zkId if the query is purely numeric (it's an Int)
        (isNumericSearch && emp.zkId === Number(searchStr));

      // Direct company match — null-company employees only show under "All Companies"
      const matchesCompany = selectedCompany === 'All Companies' || emp.Company?.name === selectedCompany;
      const matchesDept = selectedDept === 'all' || emp.Department?.name === selectedDept;
      const matchesBranch = selectedBranch === 'all' || emp.Branch?.name === selectedBranch;
      const matchesShift = selectedShift === 'all' || emp.Shift?.name === selectedShift;
      const matchesStatus = selectedStatus === 'all' || emp.employmentStatus === selectedStatus;
      return matchesSearch && matchesCompany && matchesDept && matchesBranch && matchesShift && matchesStatus;
    });
  }, [employees, searchTerm, selectedCompany, selectedDept, selectedBranch, selectedShift, selectedStatus]);

  const tableSort = useTableSort<Employee>({ initialData: filteredEmployees });

  const registerEmployee = async (formData: any): Promise<{success: boolean, message?: string, deviceSync?: any, employee?: any}> => {
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        await fetchEmployees();
        return { success: true, employee: data.employee, deviceSync: data.deviceSync };
      } else {
        return { success: false, message: data.message || 'Unknown error' };
      }
    } catch (err) {
      return { success: false, message: 'Could not reach the server.' };
    }
  };

  const updateEmployee = async (id: number, updateData: Partial<Employee>): Promise<{success: boolean, message?: string}> => {
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      const data = await res.json();
      if (data.success) {
        await fetchEmployees();
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Unknown error' };
      }
    } catch (e) {
      return { success: false, message: 'Could not reach the server.' };
    }
  };

  const deactivateEmployee = async (id: number): Promise<{success: boolean, message?: string}> => {
    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchEmployees();
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Unknown error' };
      }
    } catch (e) {
      return { success: false, message: 'Could not reach the server.' };
    }
  };

  return {
    employees: filteredEmployees,
    rawEmployees: employees,
    departments,
    branches,
    filteredBranches,
    companies,
    companyNames,
    shifts,
    loading,
    refresh: fetchEmployees,
    filters: {
      searchTerm,
      setSearchTerm,
      selectedDept,
      setSelectedDept,
      selectedBranch,
      setSelectedBranch,
      selectedShift,
      setSelectedShift,
      selectedCompany,
      setSelectedCompany,
      selectedStatus,
      setSelectedStatus,
    },
    tableSort,
    actions: {
      registerEmployee,
      updateEmployee,
      deactivateEmployee
    }
  };
}
