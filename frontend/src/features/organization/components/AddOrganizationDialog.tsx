import { Plus, Building2, MapPin, Building, X as XIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'

interface AddOrganizationDialogProps {
  isAddOpen: boolean
  setIsAddOpen: (open: boolean) => void
  addType: 'department' | 'branch' | 'company'
  setAddType: (type: 'department' | 'branch' | 'company') => void
  newName: string
  setNewName: (name: string) => void
  newAddress?: string
  setNewAddress?: (address: string) => void
  addLoading: boolean
  addError: string | null
  setAddError: (error: string | null) => void
  onAdd: () => void
}

export function AddOrganizationDialog({
  isAddOpen, setIsAddOpen,
  addType, setAddType,
  newName, setNewName,
  newAddress = '', setNewAddress,
  addLoading, addError, setAddError,
  onAdd,
}: AddOrganizationDialogProps) {
  return (
    <Dialog open={isAddOpen} onOpenChange={v => { setIsAddOpen(v); if (!v) { setNewName(''); setNewAddress?.(''); setAddError(null) } }}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700 gap-2 text-white shadow-lg shadow-red-600/20">
          <Plus className="w-4 h-4" />
          Add New
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="bg-white border-0 max-w-md p-0 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <div>
            <DialogTitle className="text-white font-bold text-lg">Add New</DialogTitle>
            <DialogDescription className="text-white/80 text-[10px] uppercase tracking-widest font-bold mt-1">Create a department, branch, or company</DialogDescription>
          </div>
          <button onClick={() => setIsAddOpen(false)} className="text-white/80 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Type</label>
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={() => setAddType('department')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border ${addType === 'department'
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'}`}
              >
                <Building2 className="w-4 h-4" />
                Dept
              </button>
              <button
                onClick={() => setAddType('branch')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border ${addType === 'branch'
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'}`}
              >
                <MapPin className="w-4 h-4" />
                Branch
              </button>
              <button
                onClick={() => setAddType('company')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border ${addType === 'company'
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'}`}
              >
                <Building className="w-4 h-4" />
                Company
              </button>
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">
              {addType === 'department' ? 'Department Name' : addType === 'branch' ? 'Branch Name' : 'Company Name'}
            </label>
            <input
              placeholder={addType === 'department' ? 'e.g. LOGISTICS DEPARTMENT' : addType === 'branch' ? 'e.g. CEBU CITY' : 'e.g. ACME Corporation'}
              className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addType !== 'company' && onAdd()}
            />
          </div>
          {addType === 'company' && (
            <>
              <div>
                <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Address</label>
                <input
                  placeholder="e.g. 123 Main Street, Manila"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                  value={newAddress}
                  onChange={e => setNewAddress?.(e.target.value)}
                />
              </div>

            </>
          )}
          {addError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{addError}</p>}
        </div>
        <div className="flex items-center justify-center gap-6 px-6 py-4 border-t border-slate-100">
          <button
            className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => { setNewName(''); setNewAddress?.(''); setIsAddOpen(false); setAddError(null) }}
            disabled={addLoading}
          >
            Discard
          </button>
          <button
            onClick={onAdd}
            disabled={addLoading}
            className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {addLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {addType === 'department' ? 'Add Department' : addType === 'branch' ? 'Add Branch' : 'Add Company'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
