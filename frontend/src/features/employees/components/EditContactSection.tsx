import React from 'react'
import { Employee, formatPhoneNumber } from '../utils/employee-types'
import { EditFormErrors } from '../hooks/useEmployeeEditForm'

interface EditContactSectionProps {
  editForm: Partial<Employee>
  formErrors: EditFormErrors
  onFormChange: (form: Partial<Employee>) => void
  onClearError: (field: string) => void
  onDuplicateBlur: (field: 'email' | 'contactNumber') => void
}

const inputBase = 'w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20 transition-all'
const inputError = 'border-red-500 ring-1 ring-red-500'
const inputNormal = 'border-slate-200'

export function EditContactSection({
  editForm, formErrors, onFormChange, onClearError, onDuplicateBlur,
}: EditContactSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Email */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Email Address</label>
        <input
          type="email"
          value={editForm.email || ''}
          onChange={(e) => {
            onFormChange({ ...editForm, email: e.target.value })
            if (formErrors.email) onClearError('email')
          }}
          onBlur={() => onDuplicateBlur('email')}
          className={`${inputBase} ${formErrors.email ? inputError : inputNormal}`}
        />
        {formErrors.email && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.email}</p>}
      </div>

      {/* Contact Number */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Contact Number *</label>
        <input
          type="tel"
          maxLength={13}
          value={editForm.contactNumber || ''}
          onChange={(e) => {
            const val = formatPhoneNumber(e.target.value)
            onFormChange({ ...editForm, contactNumber: val })
            if (formErrors.contactNumber) onClearError('contactNumber')
          }}
          onBlur={() => onDuplicateBlur('contactNumber')}
          className={`${inputBase} ${formErrors.contactNumber ? inputError : inputNormal}`}
        />
        {formErrors.contactNumber && <p className="text-[10px] text-red-500 font-bold ml-1">{formErrors.contactNumber}</p>}
      </div>
    </div>
  )
}
