import { useState } from 'react'
import { Employee } from '../utils/employee-types'
import { validateEmployeeForm } from '@/lib/employeeValidation'
import { toast } from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EditFormErrors = Record<string, string>

interface UseEmployeeEditFormOptions {
  /** The controlled form data owned by the parent. */
  editForm: Partial<Employee>
  /** Parent-supplied save callback — only called when validation passes. */
  onSave: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEmployeeEditForm({ editForm, onSave }: UseEmployeeEditFormOptions) {
  const [formErrors, setFormErrors] = useState<EditFormErrors>({})

  // ── Validation ──────────────────────────────────────────────────────────────
  //
  // Relies exclusively on centralized Zod schema validateEmployeeForm

  const validateForm = (): boolean => {
    const { errors } = validateEmployeeForm(editForm)
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Inline error clearing (called by section onChange handlers) ─────────────

  const clearFieldError = (field: string) => {
    setFormErrors(prev => ({ ...prev, [field]: '' }))
  }

  // ── Save gate ───────────────────────────────────────────────────────────────

  const handleSaveWrapper = () => {
    if (validateForm()) {
      onSave()
    } else {
      toast.error('Validation failed. Please check the highlighted fields.', { duration: 4000 })
    }
  }

  return {
    formErrors,
    clearFieldError,
    handleSaveWrapper,
  }
}
