import { Plus, Building2, MapPin, Building, X as XIcon, Loader2, Layers, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import type { Department, Section } from '../types'

interface AddOrganizationDialogProps {
  isAddOpen: boolean
  setIsAddOpen: (open: boolean) => void
  addType: 'department' | 'branch' | 'company' | 'section'
  setAddType: (type: 'department' | 'branch' | 'company' | 'section') => void
  newName: string
  setNewName: (name: string) => void
  newAddress?: string
  setNewAddress?: (address: string) => void
  departments?: Department[]
  newSectionDeptId?: string
  setNewSectionDeptId?: (id: string) => void
  addLoading: boolean
  addError: string | null
  setAddError: (error: string | null) => void
  onAdd: () => void
  sections?: Section[]
  newDeptSectionIds?: number[]
  setNewDeptSectionIds?: (ids: number[]) => void
}

export function AddOrganizationDialog({
  isAddOpen, setIsAddOpen,
  addType, setAddType,
  newName, setNewName,
  newAddress = '', setNewAddress,
  departments = [], newSectionDeptId = '', setNewSectionDeptId,
  addLoading, addError, setAddError,
  onAdd,
  sections = [], newDeptSectionIds = [], setNewDeptSectionIds,
}: AddOrganizationDialogProps) {
  const toggleDeptSection = (sectionId: number) => {
    if (!setNewDeptSectionIds) return
    if (newDeptSectionIds.includes(sectionId)) {
      setNewDeptSectionIds(newDeptSectionIds.filter(id => id !== sectionId))
    } else {
      setNewDeptSectionIds([...newDeptSectionIds, sectionId])
    }
  }
  return (
    <Dialog open={isAddOpen} onOpenChange={v => { setIsAddOpen(v); if (!v) { setNewName(''); setNewAddress?.(''); setNewSectionDeptId?.(''); setNewDeptSectionIds?.([]); setAddError(null) } }}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700 gap-2 text-white shadow-lg shadow-red-600/20">
          <Plus className="w-4 h-4" />
          Add New
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="bg-white border-0 max-w-md p-0 rounded-2xl overflow-hidden shadow-xl max-sm:w-full max-sm:h-full max-sm:max-w-none max-sm:rounded-none max-sm:m-0">
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <div>
            <DialogTitle className="text-white font-bold text-lg">Add New</DialogTitle>
            <DialogDescription className="text-white/80 text-[10px] uppercase tracking-widest font-bold mt-1">Create a department, section, branch, or company</DialogDescription>
          </div>
          <button onClick={() => setIsAddOpen(false)} className="text-white/80 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Type</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setAddType('department')}
                className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${addType === 'department'
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'}`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Dept
              </button>
              <button
                type="button"
                onClick={() => setAddType('section')}
                className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${addType === 'section'
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                Section
              </button>
              <button
                type="button"
                onClick={() => setAddType('branch')}
                className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${addType === 'branch'
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'}`}
              >
                <MapPin className="w-3.5 h-3.5" />
                Branch
              </button>
              <button
                type="button"
                onClick={() => setAddType('company')}
                className={`flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${addType === 'company'
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'}`}
              >
                <Building className="w-3.5 h-3.5" />
                Company
              </button>
            </div>
          </div>
          {addType === 'section' && (
            <div>
              <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Department</label>
              <select
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                value={newSectionDeptId}
                onChange={e => setNewSectionDeptId?.(e.target.value)}
              >
                <option value="">Select Department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">
              {addType === 'department' ? 'Department Name' : addType === 'section' ? 'Section Name' : addType === 'branch' ? 'Branch Name' : 'Company Name'}
            </label>
            <input
              placeholder={addType === 'department' ? 'e.g. LOGISTICS DEPARTMENT' : addType === 'section' ? 'e.g. SOFTWARE DEVELOPMENT' : addType === 'branch' ? 'e.g. CEBU CITY' : 'e.g. ACME Corporation'}
              className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addType !== 'company' && onAdd()}
            />
          </div>
          {addType === 'department' && sections.length > 0 && (
            <div>
              <label className="text-slate-400 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Assign Sections (Optional)
              </label>
              <p className="text-[10px] text-slate-300 mb-2">Select sections to assign to this department</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {sections.map(s => {
                  const isChecked = newDeptSectionIds.includes(s.id)
                  const ownerLabel = s.department?.name ? ` (${s.department.name})` : ''
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
                        onChange={() => toggleDeptSection(s.id)}
                      />
                      <span className={`text-sm font-medium ${isChecked ? 'text-red-700' : 'text-slate-500'}`}>
                        {s.name}{ownerLabel}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
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
            onClick={() => { setNewName(''); setNewAddress?.(''); setNewSectionDeptId?.(''); setNewDeptSectionIds?.([]); setIsAddOpen(false); setAddError(null) }}
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
            {addType === 'department' ? 'Add Department' : addType === 'section' ? 'Add Section' : addType === 'branch' ? 'Add Branch' : 'Add Company'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
