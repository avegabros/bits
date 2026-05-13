import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import type { Shift } from '../types'

interface ShiftDeleteModalProps {
  deleteTarget: Shift | null
  deleteLoading: boolean
  onCancel: () => void
  onDelete: () => void
}

export function ShiftDeleteModal({ deleteTarget, deleteLoading, onCancel, onDelete }: ShiftDeleteModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!deleteTarget || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Delete Shift?</h3>
            <p className="text-sm text-slate-500 mt-1">
              <span className="font-bold text-slate-700">{deleteTarget.name}</span> will be permanently removed.
            </p>
            {(deleteTarget?._count?.EmployeeShift ?? 0) > 0 && (
              <p className="text-xs text-amber-600 font-bold mt-2 bg-amber-50 rounded-xl p-2 flex items-center gap-1.5">
                <AlertTriangle size={12} className="shrink-0" /> {(deleteTarget?._count?.EmployeeShift ?? 0)} employee(s) assigned — reassign them first.
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">Cancel</button>
            <button onClick={onDelete} disabled={deleteLoading || (deleteTarget?._count?.EmployeeShift ?? 0) > 0} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-200 active:scale-95">
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
