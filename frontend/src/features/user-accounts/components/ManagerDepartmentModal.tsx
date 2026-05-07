import React, { useState, useEffect } from 'react'
import { X, Building2, CheckCircle2, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ui/ToastContainer'

interface Department {
  id: number
  name: string
}

interface ManagerDepartmentModalProps {
  isOpen: boolean
  onClose: () => void
  userId: number | null
  userName: string
}

export function ManagerDepartmentModal({
  isOpen,
  onClose,
  userId,
  userName,
}: ManagerDepartmentModalProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toasts, showToast, dismissToast } = useToast()

  // Fetch all departments
  useEffect(() => {
    if (!isOpen) return
    
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
  }, [isOpen])

  // Fetch manager's assigned departments
  useEffect(() => {
    if (!isOpen || !userId) return

    const fetchAssignedDepartments = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/users/${userId}/departments`, { credentials: 'include' })
        const data = await res.json()
        if (data.success) {
          setSelectedDeptIds(data.departments.map((d: Department) => d.id))
        }
      } catch (err) {
        console.error('Failed to fetch assigned departments:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAssignedDepartments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId])

  if (!isOpen) return null

  const handleToggleDept = (deptId: number) => {
    setSelectedDeptIds(prev =>
      prev.includes(deptId)
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    )
  }

  const handleSelectAll = () => {
    if (selectedDeptIds.length === filteredDepartments.length) {
      // If all filtered are selected, unselect them
      const filteredIds = filteredDepartments.map(d => d.id)
      setSelectedDeptIds(prev => prev.filter(id => !filteredIds.includes(id)))
    } else {
      // Select all filtered
      const filteredIds = filteredDepartments.map(d => d.id)
      const newSelection = Array.from(new Set([...selectedDeptIds, ...filteredIds]))
      setSelectedDeptIds(newSelection)
    }
  }

  const handleSave = async () => {
    if (!userId) return

    setSaving(true)
    try {
      const res = await fetch(`/api/users/${userId}/departments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ departmentIds: selectedDeptIds }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', 'Departments Assigned', 'Manager departments updated successfully.')
        setTimeout(() => {
          onClose()
        }, 1000)
      } else {
        showToast('error', 'Save Failed', data.message || 'Failed to update assignments')
      }
    } catch (err) {
      showToast('error', 'Save Failed', 'An error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  const filteredDepartments = departments.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isAllFilteredSelected = filteredDepartments.length > 0 && 
    filteredDepartments.every(d => selectedDeptIds.includes(d.id))

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-full">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 tracking-tight leading-tight">Assign Departments</h3>
              <p className="text-xs text-slate-500 font-medium">For {userName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-[300px]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-sm font-medium">Loading assignments...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search departments..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {filteredDepartments.length} Departments
                </span>
                {filteredDepartments.length > 0 && (
                  <button 
                    onClick={handleSelectAll}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    {isAllFilteredSelected ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              <div className="grid gap-2">
                {filteredDepartments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No departments found matching your search.
                  </div>
                ) : (
                  filteredDepartments.map(dept => {
                    const isSelected = selectedDeptIds.includes(dept.id)
                    return (
                      <button
                        key={dept.id}
                        onClick={() => handleToggleDept(dept.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                          isSelected 
                            ? 'bg-purple-50 border-purple-200 shadow-sm' 
                            : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`text-sm font-medium ${isSelected ? 'text-purple-900' : 'text-slate-700'}`}>
                          {dept.name}
                        </span>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected 
                            ? 'bg-purple-600 border-purple-600' 
                            : 'border-slate-300'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 h-11 text-slate-600 font-bold hover:bg-slate-100 border-slate-200"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 h-11 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-lg shadow-purple-600/20 transition-all active:scale-95"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </span>
            ) : (
              'Save Assignments'
            )}
          </Button>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
