'use client'

import { useState, useEffect, useCallback } from 'react'

export interface DeviceSyncStatus {
  deviceId: number
  deviceName: string
  enrolled: boolean
  enrolledAt?: string
  isActive: boolean
  syncEnabled: boolean
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
  allDevices: { id: number; name: string; isActive: boolean; syncEnabled: boolean }[]
  summary: FingerprintSummary
  deletingKey: string | null
  syncing: boolean
  syncResult: { success: boolean; message: string } | null
  showDevicePicker: number | null
  selectedDeviceId: number | null
  confirmDelete: number | null
}

export interface FingerprintDashboardActions {
  setShowDevicePicker: (slot: number | null) => void
  setSelectedDeviceId: (id: number | null) => void
  setConfirmDelete: (fingerIndex: number | null) => void
  handleDelete: (fingerIndex: number) => Promise<void>
  handleSync: () => Promise<void>
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
  const [allDevices, setAllDevices] = useState<{ id: number; name: string; isActive: boolean; syncEnabled: boolean }[]>([])
  const [summary, setSummary] = useState<FingerprintSummary>({ totalEnrolled: 0, maxSlots: 3, canEnrollMore: true })

  // Action states
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showDevicePicker, setShowDevicePicker] = useState<number | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}/fingerprint-status`)
      const data = await res.json()
      if (data.success) {
        setSlots(data.slots || [])
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
      fetchStatus()
    }
  }, [isOpen, fetchStatus])

  const handleDelete = useCallback(async (fingerIndex: number) => {
    setDeletingKey(`${fingerIndex}-global`)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/fingerprint/${fingerIndex}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        setSyncResult({ success: true, message: 'Fingerprint successfully removed from all devices.' })
        await fetchStatus()
      } else {
        setSyncResult({ success: false, message: data.message || 'Failed to delete fingerprint. Some devices may still hold the record.' })
      }
    } catch {
      setSyncResult({ success: false, message: 'Network error while globally deleting fingerprint' })
    } finally {
      setDeletingKey(null)
      setConfirmDelete(null)
    }
  }, [employeeId, fetchStatus])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/sync-fingerprints`, {
        method: 'POST'
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
      setSyncing(false)
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
    loading, slots, allDevices, summary,
    deletingKey, syncing, syncResult,
    showDevicePicker, selectedDeviceId, confirmDelete,
  }

  const actions: FingerprintDashboardActions = {
    setShowDevicePicker,
    setSelectedDeviceId,
    setConfirmDelete,
    handleDelete,
    handleSync,
    startEnrollment,
  }

  return { state, actions }
}
