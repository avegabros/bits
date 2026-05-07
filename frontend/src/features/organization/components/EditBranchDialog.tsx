import { X as XIcon, Loader2, Check } from 'lucide-react'
import type { Branch, Company } from '../types'

interface EditBranchDialogProps {
  editingBranch: Branch | null
  editBranchName: string
  setEditBranchName: (name: string) => void
  editBranchCompanyIds: number[]
  setEditBranchCompanyIds: (ids: number[]) => void
  companies: Company[]
  editBranchLoading: boolean
  editBranchError: string | null
  onSave: () => void
  onCancel: () => void
}

export function EditBranchDialog({
  editingBranch, editBranchName, setEditBranchName,
  editBranchCompanyIds, setEditBranchCompanyIds, companies,
  editBranchLoading, editBranchError, onSave, onCancel,
}: EditBranchDialogProps) {
  if (!editingBranch) return null

  const toggleCompany = (companyId: number) => {
    if (editBranchCompanyIds.includes(companyId)) {
      setEditBranchCompanyIds(editBranchCompanyIds.filter(id => id !== companyId))
    } else {
      setEditBranchCompanyIds([...editBranchCompanyIds, companyId])
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
      <div className="bg-white border-0 rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">Edit Branch</h3>
            <p className="text-white/80 text-[10px] uppercase tracking-widest font-bold mt-1">Update branch details</p>
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
          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Companies</label>
            <p className="text-[10px] text-slate-300 mb-2">Select which companies this branch belongs to</p>
            {companies.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No companies created yet</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {companies.map(c => {
                  const isChecked = editBranchCompanyIds.includes(c.id)
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-violet-200 bg-violet-50'
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                        isChecked ? 'bg-violet-500 border-violet-500' : 'border-slate-300 bg-white'
                      }`}>
                        {isChecked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isChecked}
                        onChange={() => toggleCompany(c.id)}
                      />
                      <span className={`text-sm font-medium ${isChecked ? 'text-violet-700' : 'text-slate-500'}`}>
                        {c.name}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
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
