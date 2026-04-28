import React from 'react'
import { X as XIcon, AlertCircle, Loader2 } from 'lucide-react'
import { Employee } from '../utils/employee-types'
import type { Department, Branch } from '@/lib/api'
import type { ShiftOption } from '../utils/employee-types'
import { useEmployeeEditForm } from '../hooks/useEmployeeEditForm'
import { EditIdentitySection } from './EditIdentitySection'
import { EditContactSection } from './EditContactSection'
import { EditAssignmentSection } from './EditAssignmentSection'

interface EmployeeEditModalProps {
  employee: Employee
  editForm: Partial<Employee>
  departments: Department[]
  branches: any[]
  companies: { id: number; name: string }[]
  shifts: ShiftOption[]
  isSaving?: boolean
  onFormChange: (form: Partial<Employee>) => void
  onSave: () => void
  onClose: () => void
  onDuplicateBlur: (field: 'email' | 'contactNumber' | 'employeeNumber') => void
}

export function EmployeeEditModal({
  employee, editForm, departments, branches, companies, shifts, isSaving,
  onFormChange, onSave, onClose, onDuplicateBlur,
}: EmployeeEditModalProps) {
  const { formErrors, clearFieldError, handleSaveWrapper } = useEmployeeEditForm({ editForm, onSave })

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-5 bg-red-600 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-lg leading-tight tracking-tight">Edit Employee Profile</h3>
            <p className="text-[10px] text-red-100 opacity-90 uppercase font-black tracking-widest mt-0.5">Update employee info</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <EditIdentitySection
            editForm={editForm}
            formErrors={formErrors}
            onFormChange={onFormChange}
            onClearError={clearFieldError}
            onDuplicateBlur={onDuplicateBlur}
          />
          <EditContactSection
            editForm={editForm}
            formErrors={formErrors}
            onFormChange={onFormChange}
            onClearError={clearFieldError}
            onDuplicateBlur={onDuplicateBlur}
          />
          <EditAssignmentSection
            editForm={editForm}
            formErrors={formErrors}
            departments={departments}
            branches={branches}
            companies={companies}
            shifts={shifts}
            onFormChange={onFormChange}
            onClearError={clearFieldError}
          />

          {/* Audit Log Notice */}
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3 shadow-sm shadow-amber-600/5">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <div className="text-[10px] text-amber-800 leading-relaxed font-medium">
              <strong className="block mb-0.5 tracking-tight uppercase">Audit Log Notice</strong>
              <strong>Warning:</strong> These changes will be logged under your account for audit purposes.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 flex gap-3 shrink-0">
          <button onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-3.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50">Cancel</button>
          <button
            onClick={handleSaveWrapper}
            disabled={isSaving}
            className="flex-1 px-4 py-3.5 bg-red-600 text-white rounded-xl text-sm font-black shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating</> : 'Update'}
          </button>
        </div>

      </div>
    </div>
  )
}
