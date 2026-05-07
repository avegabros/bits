'use client'

import React from 'react'
import { X as XIcon, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import type { Toast } from '@/hooks/useToast'

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-5 right-5 z-9999 flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto animate-in slide-in-from-right-8 duration-300
            ${t.type === 'success' ? 'bg-white border-green-200' : t.type === 'warning' ? 'bg-white border-amber-200' : 'bg-white border-red-200'}`}
        >
          <span className={`mt-0.5 shrink-0 ${t.type === 'success' ? 'text-green-500' : t.type === 'warning' ? 'text-amber-500' : 'text-red-500'}`}>
            {t.type === 'success' ? <CheckCircle2 className="w-4.5 h-4.5" /> : t.type === 'warning' ? <AlertTriangle className="w-4.5 h-4.5" /> : <XCircle className="w-4.5 h-4.5" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${t.type === 'success' ? 'text-green-700' : t.type === 'warning' ? 'text-amber-700' : 'text-red-700'}`}>{t.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.message}</p>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 mt-0.5"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
