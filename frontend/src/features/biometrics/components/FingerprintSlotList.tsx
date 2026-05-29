'use client'

import { Fingerprint, Plus, Trash2 } from 'lucide-react'
import type { FingerprintSlot } from '../hooks/useFingerprintDashboard'

export interface FingerprintSlotListProps {
  slots: FingerprintSlot[]
  summary: { totalEnrolled: number; maxSlots: number; canEnrollMore: boolean }
  onEnrollSlot: (slotIndex: number) => void
  onDeleteFinger: (fingerIndex: number) => void
}

export function FingerprintSlotList({
  slots,
  summary,
  onEnrollSlot,
  onDeleteFinger,
}: FingerprintSlotListProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {slots.map((slot) => {
        if (slot.enrolled) {
          return (
            <div key={slot.slot} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {/* Slot Header */}
              <div className="bg-slate-50 px-4 py-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-red-500" />
                  <div>
                    <h4 className="font-bold text-slate-700 text-sm">{slot.label}</h4>
                    {slot.fingerIndex !== null && (
                      <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                        Index: {slot.fingerIndex}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-2.5 py-1 rounded-lg font-bold bg-green-50 text-green-700 uppercase tracking-wider border border-green-100">
                    Enrolled
                  </span>
                  <button
                    onClick={() => onDeleteFinger(slot.fingerIndex!)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                    title="Delete fingerprint globally"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        }

        // Empty slot
        if (summary.canEnrollMore) {
          return (
            <button
              key={slot.slot}
              onClick={() => onEnrollSlot(slot.slot - 1)}
              className="border-2 border-dashed border-slate-200 hover:border-red-300 hover:bg-red-50/50 bg-white rounded-2xl p-6 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-red-100 flex items-center justify-center text-slate-400 group-hover:text-red-500 mb-1 transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-600 group-hover:text-red-600 text-sm">
                {slot.label}
              </h4>
              <p className="text-xs text-slate-400">Available for enrollment</p>
            </button>
          )
        }

        return null
      })}
    </div>
  )
}
