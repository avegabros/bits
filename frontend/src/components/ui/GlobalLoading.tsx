import React from 'react'
import { Loader2 } from 'lucide-react'

interface GlobalLoadingProps {
  message?: string
}

export function GlobalLoading({ message = 'Loading...' }: GlobalLoadingProps) {
  return (
    <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xl transition-all duration-300">
      <div className="flex flex-col items-center gap-6 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Corporate Logo Card with Biometric Scan */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden border border-slate-200/20">
          <img
            src="/images/av.jpg"
            alt="AVEGA Logo"
            className="relative z-10 h-12 w-12 object-contain"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23DC2626" width="200" height="200"/%3E%3Ctext x="50%" y="50%" fontSize="48" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold"%3EAB%3C/text%3E%3C/svg%3E'
            }}
          />

          {/* Minimal Biometric Scanning Line - reflecting the 'Biometric Timekeeping' aspect */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-red-600/80 shadow-[0_0_10px_rgba(220,38,38,0.5)] z-20 animate-[scan_2s_ease-in-out_infinite]" />
        </div>

        {/* Status indicator pill */}
        <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-slate-700/50 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-red-500" />
          <span className="text-sm font-medium text-slate-200 tracking-wide font-sans">
            {message}
          </span>
        </div>

      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scan {
          0% { top: -5%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 105%; opacity: 0; }
        }
      `}</style>
    </div>
  )
}
