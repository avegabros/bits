import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Mail, Eye, EyeOff, X as XIcon } from 'lucide-react'
import { UserAccount, getPasswordStrength } from '../utils/user-types'

interface UserAccountAddEditModalProps {
  isOpen: boolean
  onClose: () => void
  editingUser: UserAccount | null
  onSave: (data: any, editingUserId: number | null) => Promise<{ success: boolean; message?: string }>
  currentUserRole?: string
}

export function UserAccountAddEditModal({
  isOpen,
  onClose,
  editingUser,
  onSave,
  currentUserRole = 'ADMIN',
}: UserAccountAddEditModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: currentUserRole === 'MANAGER' ? 'MANAGER' : 'ADMIN',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        setFormData({
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          email: editingUser.email,
          role: editingUser.role,
          password: '',
          confirmPassword: '',
        })
      } else {
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          role: currentUserRole === 'MANAGER' ? 'MANAGER' : 'ADMIN',
          password: '',
          confirmPassword: '',
        })
      }
      setFormError('')
      setShowPassword(false)
    }
  }, [isOpen, editingUser])

  const handleSave = async () => {
    setFormError('')
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setFormError('First name, last name, and email are required')
      return
    }
    if (!editingUser && (!formData.password || formData.password.length < 8)) {
      setFormError('Password must be at least 8 characters')
      return
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match')
      return
    }

    setIsSaving(true)
    const result = await onSave(formData, editingUser ? editingUser.id : null)
    setIsSaving(false)

    if (result.success) {
      onClose()
    } else {
      setFormError(result.message || 'Failed to save user')
    }
  }

  const strength = getPasswordStrength(formData.password)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="bg-white border-0 w-[calc(100%-2rem)] sm:max-w-md p-0 rounded-2xl overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
        <div className="bg-red-600 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-white font-bold text-lg">
              {editingUser ? 'Edit User Account' : 'Add New User'}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[10px] uppercase tracking-widest font-bold mt-1">
              {editingUser ? 'Update user details' : 'Create a new user account'}
            </DialogDescription>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1" aria-label="Close modal">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-4 sm:px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">First Name</label>
              <input
                placeholder="First name"
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Last Name</label>
              <input
                placeholder="Last name"
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Email</label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="email"
                placeholder="user@avega.com"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Role</label>
            <select
              className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none cursor-pointer transition-all appearance-none"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              {currentUserRole === 'ADMIN' && <option value="ADMIN">Administrator</option>}
              <option value="MANAGER">Manager</option>
              <option value="HR">HR</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">
              {editingUser ? 'New Password (leave blank to keep)' : 'Password'}
            </label>
            <div className="relative mt-1.5">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={editingUser ? 'Leave blank to keep current' : 'Min. 8 characters'}
                className="w-full px-3 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.password && (
              <div className="mt-2">
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                </div>
                <p className={`text-[10px] mt-1 font-bold ${strength.textColor}`}>
                  Password strength: {strength.label}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>

          {formError && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl p-3 font-medium">
              {formError}
            </p>
          )}
        </div>
        
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:gap-4 px-4 sm:px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            disabled={isSaving}
            className="w-full sm:w-auto text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 py-2.5 sm:py-0"
            onClick={onClose}
          >
            Discard
          </button>
          <button 
            disabled={isSaving}
            onClick={handleSave} 
            className="w-full sm:w-auto px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px]"
          >
            {isSaving ? 'Processing...' : (editingUser ? 'Save Changes' : 'Create User')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
