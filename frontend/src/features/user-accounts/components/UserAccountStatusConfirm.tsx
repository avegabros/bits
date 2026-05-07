import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface UserAccountStatusConfirmProps {
  isOpen: boolean
  onClose: () => void
  userId: number | null
  userName: string
  currentStatus: string
  onConfirm: (userId: number, currentStatus: string) => Promise<{ success: boolean; message?: string }>
}

export function UserAccountStatusConfirm({
  isOpen,
  onClose,
  userId,
  userName,
  currentStatus,
  onConfirm,
}: UserAccountStatusConfirmProps) {
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (!userId) return
    setLoading(true)
    const result = await onConfirm(userId, currentStatus)
    setLoading(false)
    if (result.success) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6 text-center space-y-4">
          <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
            currentStatus === 'active' ? 'bg-rose-100' : 'bg-emerald-100'
          }`}>
            <AlertTriangle className={`w-7 h-7 ${
              currentStatus === 'active' ? 'text-rose-600' : 'text-emerald-600'
            }`} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">
              {currentStatus === 'active' ? 'Deactivate Account?' : 'Reactivate Account?'}
            </h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              {currentStatus === 'active'
                ? <>Are you sure you want to deactivate <span className="font-bold text-slate-700">{userName}</span>? This will <span className="font-bold text-rose-600">revoke their login access</span>.&nbsp;</>
                : <>Reactivate <span className="font-bold text-slate-700">{userName}</span>? This will <span className="font-bold text-emerald-600">restore their login access</span>.&nbsp;</>
              }
            </p>
          </div>
        </div>
        <div className="flex border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-3.5 text-sm font-black transition-colors disabled:opacity-70 ${
              currentStatus === 'active'
                ? 'text-rose-600 hover:bg-rose-50'
                : 'text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            {loading
              ? 'Processing…'
              : currentStatus === 'active' ? 'Yes, Deactivate' : 'Yes, Reactivate'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
