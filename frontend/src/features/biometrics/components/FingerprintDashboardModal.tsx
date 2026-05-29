'use client'

import React from 'react'
import {
  X, Fingerprint, Loader2,
  CheckCircle2, AlertTriangle, Info
} from 'lucide-react'
import { useFingerprintDashboard } from '../hooks/useFingerprintDashboard'
import { FingerprintDevicePicker } from './FingerprintDevicePicker'
import { FingerprintSlotList } from './FingerprintSlotList'
import { FingerprintDeviceSyncPanel } from './FingerprintDeviceSyncPanel'

interface FingerprintDashboardModalProps {
  isOpen: boolean
  employeeId: number | null
  employeeName: string
  onClose: () => void
  onScanNow: (fingerIndex: number, deviceId: number) => void
}

export default function FingerprintDashboardModal({
  isOpen,
  employeeId,
  employeeName,
  onClose,
  onScanNow
}: FingerprintDashboardModalProps) {
  const { state, actions } = useFingerprintDashboard(isOpen, employeeId, onScanNow, onClose)
  const [confirmDeleteFingerIndex, setConfirmDeleteFingerIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!isOpen) {
      setConfirmDeleteFingerIndex(null)
    }
  }, [isOpen])

  if (!isOpen || !employeeId) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Fingerprint Management</h3>
              <p className="text-[10px] text-red-100 uppercase tracking-widest font-bold mt-0.5">
                {employeeName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-red-100 font-bold bg-white/10 px-2 py-1 rounded-lg">
              {state.summary.totalEnrolled}/{state.summary.maxSlots} slots
            </span>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Device Picker Overlay */}
        {state.showDevicePicker !== null && (
          <FingerprintDevicePicker
            allDevices={state.allDevices}
            selectedDeviceId={state.selectedDeviceId}
            onSelectDevice={actions.setSelectedDeviceId}
            onClose={() => actions.setShowDevicePicker(null)}
            onStartEnrollment={actions.startEnrollment}
          />
        )}

        {/* Last Device Exclusion Confirmation Overlay */}
        {state.confirmLastExclusion !== null && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-5 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-black text-slate-800 mb-2">Unallow Last Device?</h4>
            <p className="text-sm text-slate-500 mb-8 max-w-md leading-relaxed">
              This is the last allowed device for this fingerprint/employee. Excluding this device will remove or delete all fingerprints from active synchronization. Do you want to continue?
            </p>
            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={() => actions.setConfirmLastExclusion(null)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => actions.handleToggleExclusion(state.confirmLastExclusion!.deviceId, 'FINGERPRINT', true, true)}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
              >
                Yes, Continue
              </button>
            </div>
          </div>
        )}

        {/* Delete Fingerprint Confirmation Overlay */}
        {confirmDeleteFingerIndex !== null && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-5 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-black text-slate-800 mb-2">Delete Fingerprint Globally?</h4>
            <p className="text-sm text-slate-500 mb-8 max-w-sm leading-relaxed">
              Are you sure you want to delete this fingerprint globally? This will permanently remove the biometric template from all devices. <br/><span className="font-bold text-red-500">This action cannot be undone.</span>
            </p>
            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={() => setConfirmDeleteFingerIndex(null)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const fingerIndex = confirmDeleteFingerIndex;
                  setConfirmDeleteFingerIndex(null);
                  await actions.handleDeleteFinger(fingerIndex);
                }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {state.loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-4" />
              <p className="text-sm font-medium text-slate-500">Loading fingerprint data...</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Info Banner */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 text-blue-800 rounded-2xl border border-blue-100">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm leading-relaxed">
                  <p className="font-bold mb-1">Up to {state.summary.maxSlots} fingerprints per employee</p>
                  Enroll any finger. Use Sync to push fingerprints to devices that missed updates while offline.
                </div>
              </div>

              {/* Sync Result */}
              {state.syncResult && (
                <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
                  state.syncResult.success
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {state.syncResult.success ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium">{state.syncResult.message}</p>
                </div>
              )}

              {/* Fingerprint Slots */}
              <FingerprintSlotList
                slots={state.slots}
                summary={state.summary}
                onEnrollSlot={actions.setShowDevicePicker}
                onDeleteFinger={setConfirmDeleteFingerIndex}
              />

              {/* Device Sync Panel */}
              {state.summary.totalEnrolled > 0 && (
                <FingerprintDeviceSyncPanel
                  devices={state.devices}
                  syncingDevice={state.syncingDevice}
                  onToggleExclusion={(deviceId, exclude) => actions.handleToggleExclusion(deviceId, 'FINGERPRINT', exclude)}
                  onDeviceSync={actions.handleDeviceSync}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
