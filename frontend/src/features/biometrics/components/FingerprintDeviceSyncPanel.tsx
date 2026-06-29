'use client'

import React from 'react'
import {
  Smartphone, Loader2, CheckCircle2,
  AlertTriangle, RefreshCw, WifiOff, Check
} from 'lucide-react'
import type { DeviceSyncStatus } from '../hooks/useFingerprintDashboard'

export interface FingerprintDeviceSyncPanelProps {
  devices: DeviceSyncStatus[]
  syncingDevice: number | null
  onToggleExclusion: (deviceId: number, exclude: boolean) => void
  onDeviceSync: (deviceId: number) => void
}

export function FingerprintDeviceSyncPanel({
  devices,
  syncingDevice,
  onToggleExclusion,
  onDeviceSync,
}: FingerprintDeviceSyncPanelProps): React.JSX.Element {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* Panel Header */}
      <div className="bg-slate-50 px-4 py-4 border-b flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-slate-800 text-lg tracking-tight">Device Synchronization</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fingerprint Device Status</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync Visual Indicator Pill */}
          {(() => {
            const targetable = devices.filter(d => d.isActive && d.syncEnabled);
            const enrolled = targetable.filter(d => d.enrolled && !d.pendingDeletion);
            if (targetable.length === 0) return null;

            if (enrolled.length === targetable.length) {
              return (
                <span className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-lg uppercase tracking-widest flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Fully Synced
                </span>
              );
            } else {
              return (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg uppercase tracking-widest flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Sync Required
                </span>
              );
            }
          })()}
        </div>
      </div>

      {/* Device List */}
      <div className="p-3 bg-white">
        <div className="space-y-1.5">
          {devices.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-4">No active devices found in the system.</p>
          ) : (
            devices.map(device => (
              <div key={device.deviceId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3">
                  <Smartphone className={`w-4 h-4 ${device.enrolled ? 'text-red-500' : 'text-slate-300'}`} />
                  <div>
                    <p className={`text-sm font-bold ${device.pendingDeletion ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
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
                      ) : device.syncStatus === 'partial' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 text-[9px] font-bold uppercase tracking-wider border border-orange-100">
                          <AlertTriangle className="w-2.5 h-2.5" /> Partially Synced
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

                {/* Actions per device */}
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0">
                  <label className="relative inline-flex items-center cursor-pointer mr-2">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!device.excluded}
                      onChange={(e) => onToggleExclusion(device.deviceId, !e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    <span className="ml-2 text-xs font-medium text-slate-600 w-12">{device.excluded ? 'Excluded' : 'Allowed'}</span>
                  </label>

                  {device.syncEnabled && !device.excluded && device.isActive && (
                    <button
                      onClick={() => onDeviceSync(device.deviceId)}
                      disabled={syncingDevice === device.deviceId}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 border border-transparent shadow-sm bg-white hover:border-red-200"
                      title="Sync fingerprints to this device"
                    >
                      {syncingDevice === device.deviceId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span className="text-xs font-bold mr-1">Sync</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
