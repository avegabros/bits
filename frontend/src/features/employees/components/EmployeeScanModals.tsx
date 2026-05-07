'use client'

import React from 'react'
import { X as XIcon, Fingerprint, Timer, Loader2 } from 'lucide-react'

interface ScanModalProps {
  open: boolean
  employeeName: string
  countdown: number
  onClose: () => void
}

export function ScanNowModal({ open, employeeName, countdown, onClose }: ScanModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-red-600 px-6 py-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-700 opacity-60" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-red-100 text-[10px] uppercase font-black tracking-widest">Biometric Device</p>
              <h3 className="text-white font-black text-xl leading-tight mt-0.5">Scan Fingerprint Now</h3>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-6 py-6 space-y-5">
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-red-50 border-2 border-red-100 flex items-center justify-center">
                <Fingerprint className="w-10 h-10 text-red-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-blacktext-slate-700">{employeeName}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">is ready to enroll</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {([
              { step: '01', text: 'Go to the ZKTeco biometric device' },
              { step: '02', text: 'Look for this employee on the screen' },
              { step: '03', text: 'Press your finger firmly on the scanner' },
              { step: '04', text: 'Hold for 3 seconds until it beeps' },
            ] as const).map(({ step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <span className="shrink-0 w-7 h-7 rounded-lg bg-red-600 text-white text-[10px] font-black flex items-center justify-center">{step}</span>
                <p className="text-xs font-semibold text-slate-600">{text}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Timer className="w-4 h-4 text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500 font-medium flex-1">Auto-closes in</p>
            <span className={`text-sm font-black tabular-nums ${countdown <= 10 ? 'text-red-500' : 'text-slate-700'}`}>{countdown}s</span>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg shadow-slate-900/20">
            Done — Fingerprint Scanned ✓
          </button>
        </div>
      </div>
    </div>
  )
}

interface EnrollmentLoadingOverlayProps {
  enrollStatus: Record<number, 'idle' | 'loading' | 'success' | 'error'>
  enrollMsg: Record<number, string>
}

export function EnrollmentLoadingOverlay({ enrollStatus, enrollMsg }: EnrollmentLoadingOverlayProps) {
  const enrollingIdStr = Object.keys(enrollStatus).find(id => enrollStatus[Number(id)] === 'loading')
  if (!enrollingIdStr) return null
  const msg = enrollMsg[Number(enrollingIdStr)] || 'Connecting to biometric device...'
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center max-w-sm mx-4 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-60"></div>
          <div className="bg-blue-50 text-blue-600 p-5 rounded-full relative shadow-sm">
            <Loader2 className="w-10 h-10 animate-spin" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Please Wait</h3>
        <p className="text-sm font-medium text-slate-500">{msg}</p>
      </div>
    </div>
  )
}
