'use client'

import React from 'react'
import { CreditCard, Loader2, Smartphone } from 'lucide-react'
import type { DeviceSyncStatus } from '../hooks/useRFIDEnrollment'

export interface CardEnrollmentFormProps {
  cardInput: string
  devices: DeviceSyncStatus[]
  activeActions: { [key: string]: boolean }
  onCardInputChange: (value: string) => void
  onGlobalEnroll: () => void
}

export function CardEnrollmentForm({
  cardInput,
  devices,
  activeActions,
  onCardInputChange,
  onGlobalEnroll,
}: CardEnrollmentFormProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4">
          <CreditCard className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-slate-800 mb-1">No Card Enrolled</h3>
        <p className="text-sm text-slate-500 mb-6 max-w-sm">
          Enter the RFID card number to register it globally for this employee across all active devices.
        </p>

        <div className="w-full max-w-sm flex gap-2">
          <input
            type="text"
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500 focus:outline-none transition-all"
            placeholder="Enter Card Number..."
            value={cardInput}
            onChange={(e) => onCardInputChange(e.target.value.replace(/\D/g, ''))}
          />
          <button
            onClick={onGlobalEnroll}
            disabled={!cardInput || activeActions['globalEnroll']}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shrink-0 flex items-center justify-center min-w-[100px]"
          >
            {activeActions['globalEnroll'] ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enroll'}
          </button>
        </div>
      </div>

      {/* Pre-enrollment target specific list */}
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Target Devices</h4>
        <p className="text-[10px] text-slate-400 mb-3 px-1">Enrolling the card will push to the following active devices instantly:</p>
        <div className="space-y-1.5">
          {devices.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-4">No active devices found.</p>
          ) : (
            devices.map(device => (
              <div key={device.deviceId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-transparent">
                <div className="flex items-center gap-3">
                  <Smartphone className={`w-4 h-4 ${device.isActive && device.syncEnabled ? 'text-red-500' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-sm font-bold text-slate-700">{device.deviceName}</span>
                    {!device.isActive ? (
                      <span className="ml-2 text-[10px] text-red-500 font-bold bg-red-100 px-1.5 py-0.5 rounded-md">Offline</span>
                    ) : !device.syncEnabled ? (
                      <span className="ml-2 text-[10px] text-amber-600 font-bold bg-amber-100 px-1.5 py-0.5 rounded-md">Sync Paused</span>
                    ) : (
                      <span className="ml-2 text-[10px] text-green-600 font-bold bg-green-100 px-1.5 py-0.5 rounded-md">Ready</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
