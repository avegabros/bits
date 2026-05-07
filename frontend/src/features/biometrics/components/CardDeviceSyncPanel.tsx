'use client'

import React from 'react'
import {
  CreditCard, Loader2, Trash2, CheckCircle2,
  AlertTriangle, Smartphone, RefreshCw, WifiOff, Check, UploadCloud
} from 'lucide-react'
import type { DeviceSyncStatus } from '../hooks/useRFIDEnrollment'

export interface CardDeviceSyncPanelProps {
  cardNumber: number
  devices: DeviceSyncStatus[]
  activeActions: { [key: string]: boolean }
  onConfirmGlobalDelete: () => void
  onManualSync: () => void
  onPushToDevice: (deviceId: number) => void
  onDeleteFromDevice: (deviceId: number) => void
}

export function CardDeviceSyncPanel({
  cardNumber,
  devices,
  activeActions,
  onConfirmGlobalDelete,
  onManualSync,
  onPushToDevice,
  onDeleteFromDevice,
}: CardDeviceSyncPanelProps) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="bg-slate-50 px-4 py-4 border-b flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-slate-800 text-lg tracking-tight">#{cardNumber}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Global Card</p>
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
               return <span className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-lg uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Fully Synced</span>;
            } else {
               return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg uppercase tracking-widest flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Missing {targetable.length - enrolled.length} Device(s)</span>;
            }
          })()}
          <button
            onClick={onConfirmGlobalDelete}
            className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 flex items-center gap-1.5 rounded-xl transition-colors border border-transparent hover:border-red-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Global
          </button>
        </div>
      </div>

      {/* Device List Header w/ Manual Sync */}
      <div className="px-4 pt-3 flex items-center justify-between">
        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Device Synchronization</h5>
        <button
          onClick={onManualSync}
          disabled={activeActions['manualSync']}
          className="flex items-center gap-1.5 px-3 py-1.5 border hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors shadow-sm"
        >
          {activeActions['manualSync'] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Sync All
        </button>
      </div>

      {/* Device List */}
      <div className="p-3 bg-white">
        <div className="space-y-1.5">
          {devices.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-4">No active devices found in the system.</p>
          ) : (
            devices.map(device => (
              <div key={device.deviceId} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3">
                  <Smartphone className={`w-4 h-4 ${device.enrolled ? 'text-red-500' : 'text-slate-300'}`} />
                  <div>
                    <p className={`text-sm font-bold ${device.pendingDeletion ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {device.deviceName}
                    </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {device.pendingDeletion ? (
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

                {/* Actions per device */}
                {device.isActive && device.syncEnabled && (
                  <div className="flex items-center">
                    {device.enrolled && !device.pendingDeletion ? (
                      <button
                        onClick={() => onDeleteFromDevice(device.deviceId)}
                        disabled={activeActions[`delete-${device.deviceId}`]}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
                        title="Remove from this device"
                      >
                        {activeActions[`delete-${device.deviceId}`] ? 
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : 
                          <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    ) : !device.pendingDeletion ? (
                      <button
                        onClick={() => onPushToDevice(device.deviceId)}
                        disabled={activeActions[`push-${device.deviceId}`]}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 border border-transparent shadow-sm bg-white"
                        title="Push to this device"
                      >
                        {activeActions[`push-${device.deviceId}`] ? 
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                          <UploadCloud className="w-3.5 h-3.5" />
                        }
                        <span className="text-xs font-bold mr-1">Push</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
