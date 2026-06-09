import { Building, MapPin, Edit2, Trash2, Loader2 } from 'lucide-react'
import type { Company } from '../types'

interface CompanyCardsProps {
  companies: Company[]
  loading: boolean
  onEditCompany: (company: Company) => void
  onDeleteCompany: (company: Company) => void
}

export function CompanyCards({
  companies, loading,
  onEditCompany, onDeleteCompany,
}: CompanyCardsProps) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Companies</h3>
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading companies...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {companies.map(company => {
            const branchCount = company._count?.branches ?? 0
            return (
              <div key={company.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-lg shadow-violet-500/20">
                  <Building className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-700 text-sm">{company.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {company.address ? (
                      <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {company.address}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-300 italic">No address</p>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {branchCount} {branchCount === 1 ? 'branch' : 'branches'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEditCompany(company)}
                    title="Edit company"
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 sm:text-slate-300 hover:text-violet-500 hover:bg-violet-50 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {branchCount === 0 ? (
                    <button
                      onClick={() => onDeleteCompany(company)}
                      title="Remove company"
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 sm:text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span
                      title={`Cannot delete — ${branchCount} branch${branchCount > 1 ? 'es' : ''} assigned`}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-40 p-1.5 rounded-lg text-slate-200 sm:text-slate-300 cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {companies.length === 0 && (
            <p className="text-sm text-slate-400 italic py-2">No companies found.</p>
          )}
        </div>
      )}
    </div>
  )
}
