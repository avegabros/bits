import { Layers, Users, Edit2, Trash2 } from 'lucide-react'
import type { Section } from '../types'
import { getColor, getInitials } from '../types'

interface SectionCardsProps {
  sections: Section[]
  sectionCounts: Record<string, number>
  onEditSection: (section: Section) => void
  onDeleteSection: (section: Section) => void
}

export function SectionCards({
  sections,
  sectionCounts,
  onEditSection,
  onDeleteSection,
}: SectionCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sections.map((section, index) => {
        const color = getColor(index)
        const count = sectionCounts[section.name] || 0
        const initials = getInitials(section.name)
        const deptName = section.department?.name || 'Unknown'

        return (
          <div
            key={section.id}
            className="group relative bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 hover:-translate-y-0.5"
          >
            <div className="absolute top-4 right-4 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
              <button
                onClick={() => onEditSection(section)}
                className="p-2 rounded-xl text-slate-400 sm:text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                title="Edit section"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              {count === 0 ? (
                <button
                  onClick={() => onDeleteSection(section)}
                  className="p-2 rounded-xl text-slate-400 sm:text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Remove section"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span
                  title={`Cannot delete — ${count} active employee${count > 1 ? 's' : ''} assigned`}
                  className="p-2 rounded-xl text-slate-300 sm:text-slate-200 cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
            <div className="flex items-start gap-4 pr-16 sm:pr-0">
              <div
                className={`w-12 h-12 ${color.icon} rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0 shadow-lg`}
                style={{ boxShadow: `0 4px 14px ${color.accent}30` }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-700 text-sm leading-tight truncate">{section.name}</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                  Dept: {deptName}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className={`w-3.5 h-3.5 ${color.light}`} />
                <span className="text-xs font-bold text-slate-500">{count} {count === 1 ? 'employee' : 'employees'}</span>
              </div>
              {count > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-500">Active</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
      {sections.length === 0 && (
        <div className="col-span-full py-20 text-center">
          <Layers className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No sections found</p>
        </div>
      )}
    </div>
  )
}
