'use client'

import { Fingerprint, Loader2, Plus, Trash2, AlertTriangle, Smartphone, WifiOff, Check, RefreshCw } from 'lucide-react'
import type { FingerprintSlot } from '../hooks/useFingerprintDashboard'

export interface FingerprintSlotListProps {
  slots: FingerprintSlot[]
  summary: { totalEnrolled: number; maxSlots: number; canEnrollMore: boolean }
  deletingKey: string | null
  syncingDevice: number | null
  onEnrollSlot: (slotIndex: number) => void
  onToggleExclusion: (deviceId: number, exclude: boolean) => void
  onDeviceSync: (deviceId: number) => void
}

export function FingerprintSlotList({
  slots,
  summary,
  deletingKey,
  syncingDevice,
  onEnrollSlot,
  onToggleExclusion,
  onDeviceSync,
}: FingerprintSlotListProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {slots.map((slot) => {
        if (slot.enrolled) {
          return (
            <div key={slot.slot} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {/* Slot Header */}
              <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-red-500" />
                  <h4 className="font-bold text-slate-700 text-sm">{slot.label}</h4>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700 uppercase tracking-wider">
                    Enrolled
                  </span>
                </div>
              </div>

              {/* Device List */}
              <div className="p-2 space-y-1">
                {slot.devices.map(device => (
                  <div key={device.deviceId} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Smartphone className={`w-4 h-4 ${device.enrolled ? 'text-slate-500' : 'text-slate-300'}`} />
                      <div>
                        <p className={`text-sm font-medium ${device.pendingDeletion ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {device.deviceName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {device.excluded ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider border border-slate-200">
                              <AlertTriangle className="w-2.5 h-2.5" /> Excluded
                            </span>
                          ) : device.pendingDeletion ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[9px] font-bold uppercase tracking-wider border border-red-100">
                              <AlertTriangle className="w-2.5 h-2.5" /> Pending Delete
                            </span>
                          ) : device.enrolled ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase tracking-wider border border-emerald-100">
                              <Check className="w-2.5 h-2.5" /> Synced {device.enrolledAt ? `(${new Date(device.enrolledAt).toLocaleDateString()})` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold uppercase tracking-wider border border-amber-100">
                              <AlertTriangle className="w-2.5 h-2.5" /> Not Synced
                            </span>
                          )}
                          {!device.isActive && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider border border-slate-200">
                              <WifiOff className="w-2.5 h-2.5" /> Offline
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!device.excluded && (
                        <button
                          disabled={syncingDevice === device.deviceId}
                          onClick={() => onDeviceSync(device.deviceId)}
                          className="text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors border border-transparent flex items-center gap-1"
                          title="Sync fingerprint to this device"
                        >
                          {syncingDevice === device.deviceId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Sync
                        </button>
                      )}

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={!device.excluded}
                          onChange={(e) => onToggleExclusion(device.deviceId, !e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span className="ml-2 text-xs font-medium text-slate-600 w-12">{device.excluded ? 'Excluded' : 'Allowed'}</span>
                      </label>
                    </div>
                  </div>
                ))}
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
