import React from 'react'
import { Employee, SUFFIX_OPTIONS } from '../utils/employee-types'
import { EditFormErrors } from '../hooks/useEmployeeEditForm'

interface EditIdentitySectionProps {
  editForm: Partial<Employee>
  formErrors: EditFormErrors
  onFormChange: (form: Partial<Employee>) => void
  onClearError: (field: string) => void
  onDuplicateBlur: (field: 'email' | 'contactNumber' | 'employeeNumber') => void
}

const inputBase = 'w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20 transition-all'
const inputError = 'border-red-500 ring-1 ring-red-500'
const inputNormal = 'border-slate-200'

export function EditIdentitySection({
  editForm, formErrors, onFormChange, onClearError, onDuplicateBlur,
}: EditIdentitySectionProps) {
  return (
    <>
      {/* Employee ID */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Employee ID *</label>
        <input
          type="text"
          placeholder="e.g. 10001"
          value={editForm.employeeNumber || ''}
          onChange={(e) => {
            onFormChange({ ...editForm, employeeNumber: e.target.value })
            if (formErrors.employeeNumber) onClearError('employeeNumber')
          }}
          onBlur={() => onDuplicateBlur('employeeNumber')}
          className={`${inputBase} ${formErrors.employeeNumber ? inputError : inputNormal}`}
        />
        {formErrors.employeeNumber && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.employeeNumber}</p>}
      </div>

      {/* First Name / Last Name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">First Name *</label>
          <input
            type="text"
            value={editForm.firstName || ''}
            onChange={(e) => {
              onFormChange({ ...editForm, firstName: e.target.value })
              if (formErrors.firstName) onClearError('firstName')
            }}
            className={`${inputBase} ${formErrors.firstName ? inputError : inputNormal}`}
          />
          {formErrors.firstName && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.firstName}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Last Name *</label>
          <input
            type="text"
            value={editForm.lastName || ''}
            onChange={(e) => {
              onFormChange({ ...editForm, lastName: e.target.value })
              if (formErrors.lastName) onClearError('lastName')
            }}
            className={`${inputBase} ${formErrors.lastName ? inputError : inputNormal}`}
          />
          {formErrors.lastName && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.lastName}</p>}
        </div>
      </div>

      {/* Middle Name / Suffix */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Middle Name</label>
          <input
            type="text"
            placeholder="Optional"
            value={(editForm as any).middleName || ''}
            onChange={(e) => onFormChange({ ...editForm, middleName: e.target.value } as any)}
            className={`${inputBase} ${inputNormal}`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Suffix</label>
          <select
            value={(editForm as any).suffix || ''}
            onChange={(e) => onFormChange({ ...editForm, suffix: e.target.value } as any)}
            className={`${inputBase} ${inputNormal}`}
          >
            <option value="">None</option>
            {SUFFIX_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Gender / Date of Birth */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Gender</label>
          <select
            value={(editForm as any).gender || ''}
            onChange={(e) => onFormChange({ ...editForm, gender: e.target.value } as any)}
            className={`${inputBase} ${inputNormal}`}
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Date of Birth</label>
          <input
            type="date"
            value={editForm.dateOfBirth ? (editForm.dateOfBirth as string).split('T')[0] : ''}
            onChange={(e) => {
              onFormChange({ ...editForm, dateOfBirth: e.target.value })
              if (formErrors.dateOfBirth) onClearError('dateOfBirth')
            }}
            className={`${inputBase} ${formErrors.dateOfBirth ? inputError : inputNormal}`}
          />
          {formErrors.dateOfBirth && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.dateOfBirth}</p>}
        </div>
      </div>
    </>
  )
}
