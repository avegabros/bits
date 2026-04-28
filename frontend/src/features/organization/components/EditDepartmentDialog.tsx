import { X as XIcon, Loader2 } from 'lucide-react'
import type { Department } from '../types'

interface EditDepartmentDialogProps {
  editingDept: Department | null
  editName: string
  setEditName: (name: string) => void
  editLoading: boolean
  editError: string | null
  onSave: () => void
  onCancel: () => void
}

export function EditDepartmentDialog({
  editingDept, editName, setEditName,
  editLoading, editError, onSave, onCancel,
}: EditDepartmentDialogProps) {
  if (!editingDept) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
      <div className="bg-white border-0 rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">Edit Department</h3>
            <p className="text-white/80 text-[10px] uppercase tracking-widest font-bold mt-1">Rename department</p>
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
