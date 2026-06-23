'use client'

import { useState, useEffect, useCallback } from 'react'

export interface DeviceSyncStatus {
  deviceId: number
  deviceName: string
  enrolled: boolean
  enrolledAt?: string
  isActive: boolean
  syncEnabled: boolean
  excluded: boolean
  pendingDeletion: boolean
}

export interface FingerprintSlot {
  slot: number
  label: string
  fingerIndex: number | null
  enrolled: boolean
  devices: DeviceSyncStatus[]
}

export interface FingerprintSummary {
  totalEnrolled: number
  maxSlots: number
  canEnrollMore: boolean
}

export interface FingerprintDashboardState {
  loading: boolean
  slots: FingerprintSlot[]
  devices: DeviceSyncStatus[]
  allDevices: { id: number; name: string; isActive: boolean; syncEnabled: boolean }[]
  summary: FingerprintSummary
  syncingDevice: number | null
  syncResult: { success: boolean; message: string } | null
  showDevicePicker: number | null
  selectedDeviceId: number | null
  confirmExclusion: { deviceId: number; isLast: boolean } | null
}

export interface FingerprintDashboardActions {
  setShowDevicePicker: (slot: number | null) => void
  setSelectedDeviceId: (id: number | null) => void
  setConfirmExclusion: (val: { deviceId: number; isLast: boolean } | null) => void
  handleDeviceSync: (deviceId: number) => Promise<void>
  handleToggleExclusion: (deviceId: number, type: 'FINGERPRINT', exclude: boolean, force?: boolean) => Promise<void>
  handleDeleteFinger: (fingerIndex: number) => Promise<void>
  startEnrollment: () => void
}

export function useFingerprintDashboard(
  isOpen: boolean,
  employeeId: number | null,
  onScanNow: (fingerIndex: number, deviceId: number) => void,
  onClose: () => void
): { state: FingerprintDashboardState; actions: FingerprintDashboardActions } {
  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState<FingerprintSlot[]>([])
  const [devices, setDevices] = useState<DeviceSyncStatus[]>([])
  const [allDevices, setAllDevices] = useState<{ id: number; name: string; isActive: boolean; syncEnabled: boolean }[]>([])
  const [summary, setSummary] = useState<FingerprintSummary>({ totalEnrolled: 0, maxSlots: 3, canEnrollMore: true })

  // Action states
  const [syncingDevice, setSyncingDevice] = useState<number | null>(null)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showDevicePicker, setShowDevicePicker] = useState<number | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [confirmExclusion, setConfirmExclusion] = useState<{ deviceId: number; isLast: boolean } | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}/fingerprint-status`)
      const data = await res.json()
      if (data.success) {
        setSlots(data.slots || [])
        setDevices(data.devices || [])
        setAllDevices(data.allDevices || [])
        setSummary(data.summary || { totalEnrolled: 0, maxSlots: 3, canEnrollMore: true })
      }
    } catch (err) {
      console.error('Failed to load fingerprint status', err)
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => {
    if (isOpen) {
      setShowDevicePicker(null)
      setSelectedDeviceId(null)
      setSyncResult(null)
      setConfirmExclusion(null)
      fetchStatus()
    }
  }, [isOpen, fetchStatus])

  const handleDeviceSync = useCallback(async (deviceId: number) => {
    setSyncingDevice(deviceId)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/sync-fingerprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      })
      const data = await res.json()
      setSyncResult({
        success: data.success,
        message: data.message || (data.success ? 'Sync complete' : 'Sync failed')
      })
      if (data.success) {
        await fetchStatus()
      }
    } catch {
      setSyncResult({ success: false, message: 'Network error during sync' })
    } finally {
      setSyncingDevice(null)
    }
  }, [employeeId, fetchStatus])

  const handleToggleExclusion = useCallback(async (deviceId: number, type: 'FINGERPRINT', exclude: boolean, force = false) => {
    if (exclude && !force) {
      const allowedDevices = devices.filter(d => !d.excluded);
      const syncedAllowedDevices = devices.filter(d => !d.excluded && d.enrolled);
      const isLast = 
        (allowedDevices.length === 1 && allowedDevices[0].deviceId === deviceId) ||
        (syncedAllowedDevices.length === 1 && syncedAllowedDevices[0].deviceId === deviceId);
      setConfirmExclusion({ deviceId, isLast });
      return;
    }

    setConfirmExclusion(null)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/device-exclusions/${deviceId}`, {
        method: exclude ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })
      const data = await res.json()
      if (data.success) {
        setSyncResult({ success: true, message: data.message })
        await fetchStatus()
      } else {
        setSyncResult({ success: false, message: data.message || 'Failed to update exclusion.' })
      }
    } catch {
      setSyncResult({ success: false, message: 'Network error while updating exclusion' })
    }
  }, [employeeId, fetchStatus, slots, devices])

  const handleDeleteFinger = useCallback(async (fingerIndex: number) => {
    setLoading(true)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/fingerprint/${fingerIndex}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      setSyncResult({
        success: data.success,
        message: data.message || (data.success ? 'Fingerprint deleted successfully' : 'Failed to delete fingerprint')
      })
      if (data.success) {
        await fetchStatus()
      }
    } catch {
      setSyncResult({ success: false, message: 'Network error during deletion' })
    } finally {
      setLoading(false)
    }
  }, [employeeId, fetchStatus])

  const startEnrollment = useCallback(() => {
    if (!selectedDeviceId || showDevicePicker === null) return
    const usedIndices = slots.filter(s => s.fingerIndex !== null).map(s => s.fingerIndex!)
    let nextFingerIndex = 0
    while (usedIndices.includes(nextFingerIndex) && nextFingerIndex < 10) nextFingerIndex++
    const fingerIndex = showDevicePicker >= 0 && showDevicePicker < slots.length
      ? (slots[showDevicePicker].fingerIndex ?? nextFingerIndex)
      : nextFingerIndex
    onScanNow(fingerIndex, selectedDeviceId)
    onClose()
  }, [selectedDeviceId, showDevicePicker, slots, onScanNow, onClose])

  const state: FingerprintDashboardState = {
    loading, slots, devices, allDevices, summary,
    syncingDevice, syncResult,
    showDevicePicker, selectedDeviceId, confirmExclusion,
  }

  const actions: FingerprintDashboardActions = {
    setShowDevicePicker,
    setSelectedDeviceId,
    setConfirmExclusion,
    handleDeviceSync,
    handleToggleExclusion,
    handleDeleteFinger,
    startEnrollment,
  }

  return { state, actions }
}
