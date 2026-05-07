'use client'

import React from 'react'
import {
  X, CreditCard, Loader2, CheckCircle2,
  AlertTriangle, Smartphone
} from 'lucide-react'
import { useRFIDEnrollment } from '../hooks/useRFIDEnrollment'
import { CardEnrollmentForm } from './CardEnrollmentForm'
import { CardDeviceSyncPanel } from './CardDeviceSyncPanel'

interface RFIDCardEnrollmentModalProps {
  isOpen: boolean
  employeeId: number | null
  employeeName: string
  currentCard?: number | null // Used to prepopulate but we fetch truth from API
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export default function RFIDCardEnrollmentModal({
  isOpen,
  employeeId,
  employeeName,
  currentCard,
  onClose,
  onSuccess,
  onError
}: RFIDCardEnrollmentModalProps) {
  const { state, actions } = useRFIDEnrollment(isOpen, employeeId, onSuccess, onError)

  if (!isOpen || !employeeId) return null

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-0">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">RFID Card Management</h3>
              <p className="text-[10px] text-red-100 uppercase tracking-widest font-bold mt-0.5">
                {employeeName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Delete Confirmation Overlay */}
        {state.confirmGlobalDelete && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-5 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-black text-slate-800 mb-2">Delete Global Card?</h4>
            <p className="text-sm text-slate-500 mb-8 max-w-sm leading-relaxed">
              This will permanently delete the RFID card from the database and queue a removal command for all online devices. <br /><span className="font-bold text-red-500">This action cannot be undone.</span>
            </p>
            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={() => actions.setConfirmGlobalDelete(false)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
                disabled={state.activeActions['globalDelete']}
              >
                Cancel
              </button>
              <button
                onClick={actions.handleGlobalDelete}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                disabled={state.activeActions['globalDelete']}
              >
                {state.activeActions['globalDelete'] ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {state.loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-4" />
              <p className="text-sm font-medium text-slate-500">Loading card data...</p>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Sync Result */}
              {state.syncResult && (
                <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${state.syncResult.success
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

              {/* Detailed Summary (Post-Enrollment) */}
              {state.detailedResults && state.detailedResults.length > 0 && (
                <div className="bg-white rounded-2xl border p-4 space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Sync Report</h4>
                  {state.detailedResults.map((result, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-transparent">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{result.deviceName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {result.status === 'synced' ? (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 text-green-700 text-xs font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Success
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 text-red-700 text-xs font-bold">
                            <X className="w-3 h-3" /> Failed
                          </span>
                        )}
                        {result.error && <span className="text-[10px] text-red-500 max-w-[120px] truncate" title={result.error}>({result.error})</span>}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => actions.setDetailedResults(null)} className="w-full mt-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                    Dismiss Report
                  </button>
                </div>
              )}

              {/* CARD INPUT / ENROLLMENT AREA */}
              {!state.cardNumber ? (
                <CardEnrollmentForm
                  cardInput={state.cardInput}
                  devices={state.devices}
                  activeActions={state.activeActions}
                  onCardInputChange={actions.setCardInput}
                  onGlobalEnroll={actions.handleGlobalEnroll}
                />
              ) : (
                <CardDeviceSyncPanel
                  cardNumber={state.cardNumber}
                  devices={state.devices}
                  activeActions={state.activeActions}
                  onConfirmGlobalDelete={() => actions.setConfirmGlobalDelete(true)}
                  onManualSync={actions.handleManualSync}
                  onPushToDevice={actions.handlePushToDevice}
                  onDeleteFromDevice={actions.handleDeleteFromDevice}
                />
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
