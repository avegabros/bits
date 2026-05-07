import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Mail, Eye, EyeOff, X as XIcon, Building2, Search, CheckCircle2, Loader2 } from 'lucide-react'
import { UserAccount, getPasswordStrength } from '../utils/user-types'

interface Department {
  id: number
  name: string
}

interface UserAccountAddEditModalProps {
  isOpen: boolean
  onClose: () => void
  editingUser: UserAccount | null
  onSave: (data: any, editingUserId: number | null) => Promise<{ success: boolean; message?: string; userId?: number }>
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

  // Department assignment state
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([])
  const [deptSearchQuery, setDeptSearchQuery] = useState('')
  const [loadingDepts, setLoadingDepts] = useState(false)

  // Fetch departments when role is MANAGER
  useEffect(() => {
    if (!isOpen || formData.role !== 'MANAGER') return

    const fetchDepartments = async () => {
      try {
        const res = await fetch('/api/departments', { credentials: 'include' })
        const data = await res.json()
        if (data.success) {
          setDepartments(data.departments || [])
        }
      } catch (err) {
        console.error('Failed to fetch departments:', err)
      }
    }
    fetchDepartments()
  }, [isOpen, formData.role])

  // Fetch assigned departments when editing a manager
  useEffect(() => {
    if (!isOpen || !editingUser || editingUser.role !== 'MANAGER') return

    const fetchAssigned = async () => {
      setLoadingDepts(true)
      try {
        const res = await fetch(`/api/users/${editingUser.id}/departments`, { credentials: 'include' })
        const data = await res.json()
        if (data.success) {
          setSelectedDeptIds(data.departments.map((d: Department) => d.id))
        }
      } catch (err) {
        console.error('Failed to fetch assigned departments:', err)
      } finally {
        setLoadingDepts(false)
      }
    }
    fetchAssigned()
  }, [isOpen, editingUser])

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
        // Only reset dept selections if the user being edited is NOT a manager
        // (the fetch effect above handles loading assignments for managers)
        if (editingUser.role !== 'MANAGER') {
          setSelectedDeptIds([])
        }
      } else {
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          role: currentUserRole === 'MANAGER' ? 'MANAGER' : 'ADMIN',
          password: '',
          confirmPassword: '',
        })
        setSelectedDeptIds([])
      }
      setFormError('')
      setShowPassword(false)
      setDeptSearchQuery('')
      setLoadingDepts(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingUser])

  // Reset department selections when role changes away from MANAGER
  useEffect(() => {
    if (formData.role !== 'MANAGER') {
      setSelectedDeptIds([])
    }
  }, [formData.role])

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

    // Save the user first
    const result = await onSave(formData, editingUser ? editingUser.id : null)

    if (result.success) {
      // If the role is MANAGER, also save department assignments
      if (formData.role === 'MANAGER') {
        const userId = editingUser?.id || result.userId
        if (userId) {
          try {
            await fetch(`/api/users/${userId}/departments`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ departmentIds: selectedDeptIds }),
            })
          } catch (err) {
            console.error('Failed to save department assignments:', err)
          }
        }
      }
      setIsSaving(false)
      onClose()
    } else {
      setIsSaving(false)
      setFormError(result.message || 'Failed to save user')
    }
  }

  const handleToggleDept = (deptId: number) => {
    setSelectedDeptIds(prev =>
      prev.includes(deptId)
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    )
  }

  const filteredDepartments = departments.filter(d =>
    d.name.toLowerCase().includes(deptSearchQuery.toLowerCase())
  )

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

          {/* Department Assignment — only visible for MANAGER role */}
          {formData.role === 'MANAGER' && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-500" />
                <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                  Assigned Departments
                </label>
              </div>

              {loadingDepts ? (
                <div className="flex items-center justify-center py-4 text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-medium">Loading...</span>
                </div>
              ) : (
                <>
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                    <input
                      type="text"
                      placeholder="Search departments..."
                      value={deptSearchQuery}
                      onChange={e => setDeptSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all placeholder:text-slate-300"
                    />
                  </div>

                  {/* Selected count */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {selectedDeptIds.length} selected
                    </span>
                    {filteredDepartments.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const filteredIds = filteredDepartments.map(d => d.id)
                          const allSelected = filteredIds.every(id => selectedDeptIds.includes(id))
                          if (allSelected) {
                            setSelectedDeptIds(prev => prev.filter(id => !filteredIds.includes(id)))
                          } else {
                            setSelectedDeptIds(prev => Array.from(new Set([...prev, ...filteredIds])))
                          }
                        }}
                        className="text-[10px] font-bold text-purple-600 hover:text-purple-700 transition-colors"
                      >
                        {filteredDepartments.every(d => selectedDeptIds.includes(d.id)) ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>

                  {/* Department list */}
                  <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {filteredDepartments.length === 0 ? (
                      <p className="text-center text-slate-300 text-xs py-3 font-medium">No departments found</p>
                    ) : (
                      filteredDepartments.map(dept => {
                        const isSelected = selectedDeptIds.includes(dept.id)
                        return (
                          <button
                            key={dept.id}
                            type="button"
                            onClick={() => handleToggleDept(dept.id)}
                            className={`flex items-center justify-between w-full p-2.5 rounded-xl border text-left transition-all text-xs font-medium ${
                              isSelected
                                ? 'bg-purple-50 border-purple-200 text-purple-800'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-slate-50'
                            }`}
                          >
                            <span>{dept.name}</span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-slate-300'
                            }`}>
                              {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>

                  {/* Hint */}
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                    Managers can only view attendance and adjustments for their assigned departments.
                  </p>
                </>
              )}
            </div>
          )}

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
