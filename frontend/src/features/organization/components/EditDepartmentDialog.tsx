import { X as XIcon, Loader2, Check, Layers } from 'lucide-react'
import type { Department, Section } from '../types'

interface EditDepartmentDialogProps {
  editingDept: Department | null
  editName: string
  setEditName: (name: string) => void
  sections: Section[]
  editSectionIds: number[]
  setEditSectionIds: (ids: number[]) => void
  editLoading: boolean
  editError: string | null
  onSave: () => void
  onCancel: () => void
}

export function EditDepartmentDialog({
  editingDept, editName, setEditName,
  sections, editSectionIds, setEditSectionIds,
  editLoading, editError, onSave, onCancel,
}: EditDepartmentDialogProps) {
  if (!editingDept) return null

  const toggleSection = (sectionId: number) => {
    if (editSectionIds.includes(sectionId)) {
      setEditSectionIds(editSectionIds.filter(id => id !== sectionId))
    } else {
      setEditSectionIds([...editSectionIds, sectionId])
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
      <div className="bg-white border-0 rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">Edit Department</h3>
            <p className="text-white/80 text-[10px] uppercase tracking-widest font-bold mt-1">Update department details</p>
          </div>
          <button onClick={onCancel} className="text-white/80 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Department Name</label>
            <input
              placeholder="e.g. LOGISTICS DEPARTMENT"
              className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSave()}
            />
          </div>
          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Layers className="w-3 h-3" /> Assigned Sections
            </label>
            <p className="text-[10px] text-slate-300 mb-2">Select which sections belong to this department</p>
            {sections.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No sections created yet</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {sections.map(s => {
                  const isChecked = editSectionIds.includes(s.id)
                  const isOwnedByOther = s.departmentId !== editingDept.id && isChecked === false
                  const ownerLabel = s.department?.name && s.departmentId !== editingDept.id
                    ? ` (${s.department.name})`
                    : ''
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-red-200 bg-red-50'
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                        isChecked ? 'bg-red-500 border-red-500' : 'border-slate-300 bg-white'
                      }`}>
                        {isChecked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isChecked}
                        onChange={() => toggleSection(s.id)}
                      />
                      <span className={`text-sm font-medium ${isChecked ? 'text-red-700' : 'text-slate-500'}`}>
                        {s.name}{ownerLabel}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          {editError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{editError}</p>}
        </div>
        <div className="flex items-center justify-center gap-6 px-6 py-4 border-t border-slate-100">
          <button
            className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
            onClick={onCancel}
            disabled={editLoading}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={editLoading}
            className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
