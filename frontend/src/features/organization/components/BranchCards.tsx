import { MapPin, Building, Edit2, Trash2, Loader2, X as XIcon } from 'lucide-react'
import type { Branch } from '../types'

interface BranchCardsProps {
  branches: Branch[]
  branchCounts: Record<string, number>
  loading: boolean
  onEditBranch: (branch: Branch) => void
  onDeleteBranch: (branch: Branch) => void
}

export function BranchCards({
  branches, branchCounts, loading,
  onEditBranch, onDeleteBranch,
}: BranchCardsProps) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Branches</h3>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading branches...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {branches.map(branch => {
            const count = branchCounts[branch.name] || 0
            const companyLinks = branch.companies || []
            const maxVisible = 2
            const visibleLinks = companyLinks.slice(0, maxVisible)
            const remainingCount = companyLinks.length - maxVisible
            return (
              <div key={branch.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-lg shadow-blue-500/20 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-700 text-sm truncate">{branch.name}</p>
                  <p className="text-xs text-slate-400">{count} {count === 1 ? 'employee' : 'employees'}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {companyLinks.length > 0 ? (
                      <>
                        {visibleLinks.map(link => (
                          <span
                            key={link.companyId}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-100/50 px-2 py-0.5 rounded-md shadow-sm truncate max-w-[130px]"
                            title={link.company.name}
                          >
                            <Building className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{link.company.name}</span>
                          </span>
                        ))}
                        {remainingCount > 0 && (
                          <span className="relative group/tooltip inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md shadow-sm cursor-help hover:bg-slate-100 transition-colors">
                            <span>+{remainingCount} more</span>
                            
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-950 text-white text-[10px] p-2.5 rounded-lg shadow-xl w-52 z-30 font-medium leading-relaxed text-center pointer-events-none transition-all duration-200">
                              <div className="font-bold border-b border-white/10 pb-1.5 mb-1.5 text-slate-300">Linked Companies</div>
                              <div className="whitespace-pre-line text-left font-semibold text-white space-y-1">
                                {companyLinks.slice(maxVisible).map(l => l.company.name).join('\n')}
                              </div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                            </div>
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">No company</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  {count > 0 && (
                    <div className="flex items-center gap-1 mr-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-500">Active</span>
                    </div>
                  )}
                  <button
                    onClick={() => onEditBranch(branch)}
                    title="Edit branch"
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 sm:text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {count === 0 ? (
                    <button
                      onClick={() => onDeleteBranch(branch)}
                      title="Remove branch"
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 sm:text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span
                      title={`Cannot delete — ${count} active employee${count > 1 ? 's' : ''} assigned`}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-40 p-1.5 rounded-lg text-slate-200 sm:text-slate-300 cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {branches.length === 0 && (
            <p className="text-sm text-slate-400 italic py-2">No branches found.</p>
          )}
        </div>
      )}
    </div>
  )
}
