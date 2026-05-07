'use client'

import { X, CheckCircle2, Smartphone, WifiOff, Check } from 'lucide-react'

interface Device {
  id: number
  name: string
  isActive: boolean
  syncEnabled: boolean
}

export interface FingerprintDevicePickerProps {
  allDevices: Device[]
  selectedDeviceId: number | null
  onSelectDevice: (id: number) => void
  onClose: () => void
  onStartEnrollment: () => void
}

export function FingerprintDevicePicker({
  allDevices,
  selectedDeviceId,
  onSelectDevice,
  onClose,
  onStartEnrollment,
}: FingerprintDevicePickerProps) {
  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col">
      <div className="p-4 border-b flex items-center gap-3 bg-slate-50">
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"
        >
          <X className="w-4 h-4" />
        </button>
        <div>
          <h4 className="font-bold text-slate-800">Select Device</h4>
          <p className="text-xs text-slate-500">Choose which device to enroll on</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {allDevices.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">No active devices found.</p>
        ) : (
          allDevices.map(device => {
            const isDeviceActive = device.isActive
            return (
              <button
                key={device.id}
                disabled={!isDeviceActive}
                onClick={() => onSelectDevice(device.id)}
                className={`w-full flex items-center justify-between p-4 border rounded-xl transition-all text-left ${
                  !isDeviceActive ? 'opacity-50 cursor-not-allowed bg-slate-50' :
                  selectedDeviceId === device.id ? 'border-red-500 ring-1 ring-red-500 bg-red-50' : 'hover:border-red-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Smartphone className={`w-5 h-5 ${isDeviceActive ? 'text-slate-700' : 'text-slate-400'}`} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{device.name}</p>
                    {!isDeviceActive ? (
                      <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                        <WifiOff className="w-3 h-3" /> Offline
                      </p>
                    ) : !device.syncEnabled ? (
                      <p className="text-xs text-amber-500 font-medium">Sync Paused</p>
                    ) : (
                      <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Online &amp; Ready
                      </p>
                    )}
                  </div>
                </div>
                {selectedDeviceId === device.id && (
                  <CheckCircle2 className="w-5 h-5 text-red-600" />
                )}
              </button>
            )
          })
        )}
      </div>

      <div className="p-4 border-t bg-slate-50">
        <button
          disabled={!selectedDeviceId}
          onClick={onStartEnrollment}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-xl transition-colors shadow-lg"
        >
          Start Scanning on Device
        </button>
      </div>
    </div>
  )
}
