import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Clock, Calendar, CheckSquare, Square, UserPlus, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

interface AssignOvertimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'admin' | 'hr' | 'manager';
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  departmentId: number | null;
  Department: { name: string } | null;
}

interface BackendValidationError {
  employeeId?: number;
  employeeName?: string;
  errors?: { message: string; code?: string }[];
  message?: string;
}

export function AssignOvertimeModal({ isOpen, onClose, role }: AssignOvertimeModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  
  const [submitting, setSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch employees
  useEffect(() => {
    if (!isOpen) return;
    
    if (debouncedQuery.trim().length < 2) {
      setEmployees([]);
      return;
    }

    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<{ success: boolean; employees: Employee[] }>(`/api/employees?search=${encodeURIComponent(debouncedQuery)}&limit=50&fields=minimal`);
        if (response.success && response.employees) {
          setEmployees(response.employees);
        } else {
          setError('Failed to load employees.');
        }
      } catch (err) {
        console.error(err);
        setError('Error connecting to server.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEmployees();
  }, [isOpen, debouncedQuery]);

  // Derived state: Departments (only useful for admin since manager only gets their own anyway)
  const departments = useMemo(() => {
    const deptNames = new Set<string>();
    employees.forEach(e => {
      if (e.Department?.name) deptNames.add(e.Department.name);
    });
    return Array.from(deptNames).sort();
  }, [employees]);

  // Derived state: Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchesDept = selectedDepartment === 'ALL' || e.Department?.name === selectedDepartment;
      return matchesDept;
    });
  }, [employees, selectedDepartment]);

  // Selection handlers
  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  
  const toggleAll = () => {
    if (selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0) {
      // If all currently filtered are selected, deselect them
      const filteredIds = new Set(filteredEmployees.map(e => e.id));
      setSelectedIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      // Select all currently filtered
      const newSelections = new Set([...selectedIds, ...filteredEmployees.map(e => e.id)]);
      setSelectedIds(Array.from(newSelections));
    }
  };

  const isAllFilteredSelected = filteredEmployees.length > 0 && 
    filteredEmployees.every(e => selectedIds.includes(e.id));

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError('Please select at least one employee.');
      return;
    }
    if (!date || !startTime || !endTime || !reason) {
      setError('Please fill out all required fields.');
      return;
    }
    // Zero-duration check
    if (startTime === endTime) {
      setError('Start time and end time cannot be the same.');
      return;
    }
    // Past-date check (PHT-aware)
    const todayPHT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    if (date < todayPHT) {
      setError('Cannot assign overtime for a past date.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const res = await apiFetch<{ success: boolean; message: string; created: number; validationErrors?: BackendValidationError[] }>('/api/attendance/overtime/batch', {
        method: 'POST',
        body: JSON.stringify({
          employeeIds: selectedIds,
          date,
          startTime,
          endTime,
          reason
        })
      });

      if (res.success) {
        setSuccessCount(res.created);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        // Show validation errors from backend if available
        if (res.validationErrors && Array.isArray(res.validationErrors)) {
          const errorMessages = res.validationErrors
            .map((ve) => ve.employeeName
              ? `${ve.employeeName}: ${ve.errors?.[0]?.message || 'Validation failed'}`
              : ve.message || 'Validation failed')
            .join('\n');
          setError(errorMessages || res.message || 'Validation failed.');
        } else {
          setError(res.message || 'Failed to assign overtime.');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Server error.';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            Assign Overtime
          </h2>
          <button onClick={onClose} disabled={submitting} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {successCount !== null ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <CheckSquare className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Successfully Assigned!</h3>
              <p className="text-sm text-slate-500 mt-2">
                Created {successCount} approved overtime records. Employees have been notified via email.
              </p>
            </div>
          ) : (
            <form id="assign-ot-form" onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              
              {/* Employee Selection Section */}
              <div className="space-y-3">
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest">
                  1. Select Employees <span className="text-red-500">*</span>
                </label>
                
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Search employees..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  {(role === 'admin' || role === 'hr') && departments.length > 0 && (
                    <select
                      value={selectedDepartment}
                      onChange={e => setSelectedDepartment(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors min-w-[150px]"
                    >
                      <option value="ALL">All Departments</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <button type="button" onClick={toggleAll} className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-blue-600">
                      {isAllFilteredSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                      Select All
                    </button>
                    <span className="text-xs font-medium text-slate-500">
                      {selectedIds.length} selected
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1 divide-y divide-slate-100">
                    {debouncedQuery.trim().length < 2 ? (
                      <div className="p-4 text-center text-sm text-slate-500">Type at least 2 characters to search employees...</div>
                    ) : loading ? (
                      <div className="p-4 flex justify-center items-center gap-2 text-sm text-slate-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Searching...
                      </div>
                    ) : filteredEmployees.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">No employees found matching filters.</div>
                    ) : (
                      filteredEmployees.map(emp => (
                        <div key={emp.id} onClick={() => toggleSelection(emp.id)} className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg transition-colors ${selectedIds.includes(emp.id) ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'}`}>
                          {selectedIds.includes(emp.id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{emp.firstName} {emp.lastName}</p>
                            <p className="text-xs text-slate-500 truncate">{emp.Department?.name || 'No Dept'} • {emp.employeeNumber}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {/* Selected Employees Summary */}
                {selectedIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                    {employees
                      .filter(e => selectedIds.includes(e.id))
                      .map(e => (
                        <span
                          key={e.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full"
                        >
                          {e.firstName} {e.lastName}
                          <button
                            type="button"
                            onClick={(ev) => { ev.stopPropagation(); toggleSelection(e.id); }}
                            className="ml-0.5 text-blue-500 hover:text-blue-700"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* Date & Time Section */}
              <div className="space-y-3">
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest">
                  2. Schedule <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">Date</span>
                    </div>
                    <input 
                      type="date" 
                      value={date} 
                      onChange={e => setDate(e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">Start Time</span>
                    </div>
                    <input 
                      type="time" 
                      value={startTime} 
                      onChange={e => setStartTime(e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">End Time</span>
                    </div>
                    <input 
                      type="time" 
                      value={endTime} 
                      onChange={e => setEndTime(e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Reason Section */}
              <div className="space-y-3">
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest">
                  3. Reason for Assignment <span className="text-red-500">*</span>
                </label>
                <textarea 
                  value={reason} 
                  onChange={e => setReason(e.target.value)} 
                  placeholder="e.g., Client deadline extension, Mandatory weekend shift..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[80px] resize-none"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {successCount === null && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={submitting}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              form="assign-ot-form"
              disabled={submitting || selectedIds.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? 'Assigning...' : `Assign Overtime (${selectedIds.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
