import React, { useState, useMemo, useEffect } from 'react'
import { ArrowUp, ArrowDown, X } from 'lucide-react'
import { Employee, formatTime } from '../utils/employee-types'
import type { Department, Branch } from '@/lib/api'
import type { ShiftOption } from '../utils/employee-types'
import { EditFormErrors } from '../hooks/useEmployeeEditForm'

interface EditAssignmentSectionProps {
  editForm: Partial<Employee> & { shiftIds?: number[] }
  formErrors: EditFormErrors
  departments: Department[]
  branches: any[]
  companies: { id: number; name: string }[]
  shifts: ShiftOption[]
  onFormChange: (form: Partial<Employee>) => void
  onClearError: (field: string) => void
}

const inputBase = 'w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20 transition-all'
const inputError = 'border-red-500 ring-1 ring-red-500'
const inputNormal = 'border-slate-200'

export function EditAssignmentSection({
  editForm, formErrors, departments, branches, companies, shifts, onFormChange, onClearError,
}: EditAssignmentSectionProps) {

  /** Parse workDays JSON and return compact day abbreviations */
  const parseDays = (workDays?: string): string[] => {
    if (!workDays) return []
    try { return JSON.parse(workDays) } catch { return [] }
  }

  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Derive initial company from editForm.companyId (direct) or fallback to branch inference
  const initialCompanyId = useMemo(() => {
    if (editForm.companyId) return String(editForm.companyId)
    if (!editForm.branchId) return ''
    const branch = branches.find((b: any) => b.id === editForm.branchId)
    if (branch?.companies?.length > 0) {
      return String(branch.companies[0].companyId)
    }
    return ''
  }, []) // intentionally run once on mount

  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId)

  const [sections, setSections] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/sections', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSections(data.sections)
        }
      })
      .catch(err => console.error('Error fetching sections:', err))
  }, [])

  const filteredSections = useMemo(() => {
    if (!editForm.departmentId) return []
    const deptId = Number(editForm.departmentId)
    return sections.filter((s: any) => s.departmentId === deptId)
  }, [sections, editForm.departmentId])

  // Filter branches by selected company
  const filteredBranches = useMemo(() => {
    if (!selectedCompanyId) return []
    const compId = parseInt(selectedCompanyId)
    return branches.filter((b: any) =>
      b.companies?.some((c: any) => c.companyId === compId)
    )
  }, [branches, selectedCompanyId])

  const currentShiftIds: number[] = (editForm as any).shiftIds || []

  return (
    <>
      {/* Company → Branch */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Company *</label>
          <select
            value={selectedCompanyId}
            onChange={(e) => {
              const newCompanyId = e.target.value
              setSelectedCompanyId(newCompanyId)
              // Reset branch and persist companyId
              onFormChange({ ...editForm, companyId: newCompanyId ? parseInt(newCompanyId) : null, branchId: null as any })
              if (formErrors.branchId) onClearError('branchId')
            }}
            className={`${inputBase} ${inputNormal}`}
          >
            <option value="" disabled>Select Company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Branch *</label>
          <select
            value={editForm.branchId ?? ''}
            disabled={!selectedCompanyId}
            onChange={(e) => {
              onFormChange({ ...editForm, branchId: e.target.value ? parseInt(e.target.value) : null })
              if (formErrors.branchId) onClearError('branchId')
            }}
            className={`${inputBase} ${formErrors.branchId ? inputError : inputNormal} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
          >
            {!selectedCompanyId ? (
              <option value="">Select a company first</option>
            ) : filteredBranches.length === 0 ? (
              <option value="">No branches for this company</option>
            ) : (
              <>
                <option value="" disabled>Select Branch</option>
                {filteredBranches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </>
            )}
          </select>
          {formErrors.branchId && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.branchId}</p>}
        </div>
      </div>

      {/* Department */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Department *</label>
        <select
          value={editForm.departmentId ?? ''}
          onChange={(e) => {
            onFormChange({
              ...editForm,
              departmentId: e.target.value ? parseInt(e.target.value) : null,
              sectionId: null as any
            })
            if (formErrors.departmentId) onClearError('departmentId')
          }}
          className={`${inputBase} ${formErrors.departmentId ? inputError : inputNormal}`}
        >
          <option value="" disabled>Select Department</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {formErrors.departmentId && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.departmentId}</p>}
      </div>

      {/* Section */}
      {editForm.departmentId && (
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Section (optional)</label>
          <select
            value={editForm.sectionId ?? ''}
            onChange={(e) => {
              onFormChange({ ...editForm, sectionId: e.target.value ? parseInt(e.target.value) : null })
            }}
            className={`${inputBase} ${inputNormal}`}
          >
            <option value="">Select Section (optional)</option>
            {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* Position */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Position</label>
        <input
          type="text"
          placeholder="e.g. Software Engineer"
          value={editForm.position ?? ''}
          onChange={(e) => onFormChange({ ...editForm, position: e.target.value || null })}
          className={`${inputBase} ${inputNormal}`}
        />
      </div>

      {/* Date Hired / Status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Date Hired <span className="normal-case font-medium">(optional)</span></label>
          <input
            type="date"
            value={editForm.hireDate ? (editForm.hireDate as string).split('T')[0] : ''}
            onChange={(e) => {
              onFormChange({ ...editForm, hireDate: e.target.value || undefined })
              if (formErrors.hireDate) onClearError('hireDate')
            }}
            className={`${inputBase} ${formErrors.hireDate ? inputError : inputNormal}`}
          />
          {formErrors.hireDate && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.hireDate}</p>}
        </div>
        <div className="space-y-3 px-6">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Status</label>
          <div className="flex items-center gap-6 px-1 py-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="radio"
                  name="status"
                  value="ACTIVE"
                  checked={editForm.employmentStatus === 'ACTIVE'}
                  onChange={(e) => onFormChange({ ...editForm, employmentStatus: e.target.value as Employee['employmentStatus'] })}
                  className="peer appearance-none w-4 h-4 border-2 border-slate-300 rounded-full checked:border-red-600 transition-all cursor-pointer"
                />
                <div className="absolute w-2 h-2 bg-red-600 rounded-full opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="radio"
                  name="status"
                  value="INACTIVE"
                  checked={editForm.employmentStatus === 'INACTIVE'}
                  onChange={(e) => onFormChange({ ...editForm, employmentStatus: e.target.value as Employee['employmentStatus'] })}
                  className="peer appearance-none w-4 h-4 border-2 border-slate-300 rounded-full checked:border-red-600 transition-all cursor-pointer"
                />
                <div className="absolute w-2 h-2 bg-red-600 rounded-full opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Inactive</span>
            </label>
          </div>
        </div>
      </div>

      {/* Work Shifts (Multi-Shift Picker) */}
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Work Shifts</label>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1.5">
          {currentShiftIds.length > 0 ? (
            currentShiftIds.map((sid, index) => {
              const shift = shifts.find(s => s.id === sid)
              if (!shift) return null
              return (
                <div key={sid} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100 shadow-sm group">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => {
                      if (index === 0) return
                      const newIds = [...currentShiftIds];
                      [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]]
                      onFormChange({ ...editForm, shiftIds: newIds } as any)
                    }} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" disabled={index === 0}>
                      <ArrowUp size={12} />
                    </button>
                    <button type="button" onClick={() => {
                      if (index === currentShiftIds.length - 1) return
                      const newIds = [...currentShiftIds];
                      [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]]
                      onFormChange({ ...editForm, shiftIds: newIds } as any)
                    }} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" disabled={index === currentShiftIds.length - 1}>
                      <ArrowDown size={12} />
                    </button>
                  </div>
                  <div className="flex-1 ml-1">
                    <div className="text-xs font-bold text-slate-700">
                      [{shift.shiftCode}] {shift.name}
                      {index === 0 && <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] uppercase tracking-wider font-bold">Primary</span>}
                    </div>
                    <div className="text-[10px] text-slate-500">{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</div>
                    <div className="flex gap-0.5 mt-0.5">
                      {ALL_DAYS.map(d => {
                        const active = parseDays(shift.workDays).includes(d)
                        return (
                          <span key={d} className={`text-[7px] font-black px-1 py-px rounded ${
                            active
                              ? (d === 'Sat' || d === 'Sun') ? 'bg-red-100 text-red-500' : 'bg-slate-700 text-white'
                              : 'bg-slate-100 text-slate-300'
                          }`}>{d[0]}</span>
                        )
                      })}
                    </div>
                  </div>
                  <button type="button" onClick={() => {
                    const newIds = currentShiftIds.filter(id => id !== sid)
                    onFormChange({ ...editForm, shiftIds: newIds } as any)
                  }} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={14} />
                  </button>
                </div>
              )
            })
          ) : (
            <div className="text-center py-4 text-xs text-slate-400 font-medium">No shifts assigned</div>
          )}

          {/* Add Shift Dropdown */}
          <div className="pt-2 border-t border-slate-200 mt-2">
            <select
              value=""
              onChange={(e) => {
                const sid = parseInt(e.target.value)
                if (!sid) return
                if (!currentShiftIds.includes(sid)) {
                  onFormChange({ ...editForm, shiftIds: [...currentShiftIds, sid] } as any)
                }
              }}
              className={`${inputBase} ${inputNormal} bg-white text-xs`}
            >
              <option value="">+ Add Shift</option>
              {shifts.filter(s => !currentShiftIds.includes(s.id)).map(s => {
                const days = parseDays(s.workDays)
                const dayLabel = days.length === 7 ? 'All days' : days.length === 0 ? 'No days' : days.join(', ')
                return (
                  <option key={s.id} value={s.id}>
                    [{s.shiftCode}] {s.name} ({formatTime(s.startTime)} – {formatTime(s.endTime)}) · {dayLabel}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </div>
    </>
  )
}
