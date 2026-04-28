import { X as XIcon, Loader2 } from 'lucide-react'
import type { Branch } from '../types'

interface EditBranchDialogProps {
  editingBranch: Branch | null
  editBranchName: string
  setEditBranchName: (name: string) => void
  editBranchLoading: boolean
  editBranchError: string | null
  onSave: () => void
  onCancel: () => void
}

export function EditBranchDialog({
  editingBranch, editBranchName, setEditBranchName,
  editBranchLoading, editBranchError, onSave, onCancel,
}: EditBranchDialogProps) {
  if (!editingBranch) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
      <div className="bg-white border-0 rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">Edit Branch</h3>
            <p className="text-white/80 text-[10px] uppercase tracking-widest font-bold mt-1">Rename branch</p>
          </div>
          <button onClick={onCancel} className="text-white/80 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Branch Name</label>
            <input
              placeholder="e.g. CEBU CITY"
              className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
              value={editBranchName}
              onChange={e => setEditBranchName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSave()}
            />
          </div>
          {editBranchError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{editBranchError}</p>}
        </div>
        <div className="flex items-center justify-center gap-6 px-6 py-4 border-t border-slate-100">
          <button
            className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
            onClick={onCancel}
            disabled={editBranchLoading}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={editBranchLoading}
            className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {editBranchLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
