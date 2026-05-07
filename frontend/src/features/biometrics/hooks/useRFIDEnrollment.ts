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

interface CardStatusResponse {
  success: boolean
  employee: {
    id: number
    name: string
    cardNumber: number | null
  }
  devices: DeviceSyncStatus[]
}

export interface SyncResult {
  success: boolean
  message: string
}

export interface DetailedResult {
  deviceName: string
  status: 'synced' | 'failed'
  error?: string
}

export interface RFIDEnrollmentState {
  loading: boolean
  cardNumber: number | null
  devices: DeviceSyncStatus[]
  cardInput: string
  syncResult: SyncResult | null
  detailedResults: DetailedResult[] | null
  activeActions: { [key: string]: boolean }
  confirmGlobalDelete: boolean
}

export interface RFIDEnrollmentActions {
  setCardInput: (value: string) => void
  setConfirmGlobalDelete: (value: boolean) => void
  setDetailedResults: (value: DetailedResult[] | null) => void
  handleGlobalEnroll: () => Promise<void>
  handleManualSync: () => Promise<void>
  handleGlobalDelete: () => Promise<void>
  handlePushToDevice: (deviceId: number) => Promise<void>
  handleDeleteFromDevice: (deviceId: number) => Promise<void>
}

export function useRFIDEnrollment(
  isOpen: boolean,
  employeeId: number | null,
  onSuccess: (message: string) => void,
  _onError: (message: string) => void
): { state: RFIDEnrollmentState; actions: RFIDEnrollmentActions } {
  const [loading, setLoading] = useState(true)
  const [cardNumber, setCardNumber] = useState<number | null>(null)
  const [devices, setDevices] = useState<DeviceSyncStatus[]>([])

  // Action states
  const [cardInput, setCardInput] = useState('')
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [detailedResults, setDetailedResults] = useState<DetailedResult[] | null>(null)

  // Track ongoing granular actions
  const [activeActions, setActiveActions] = useState<{ [key: string]: boolean }>({})
  const [confirmGlobalDelete, setConfirmGlobalDelete] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}/card-status`)
      const data: CardStatusResponse = await res.json()
      if (data.success) {
        setCardNumber(data.employee.cardNumber)
        setDevices(data.devices || [])
        // If they had a card initially, populate the input just in case they lose it
        if (data.employee.cardNumber) {
          setCardInput(data.employee.cardNumber.toString())
        }
      }
    } catch (err) {
      console.error('Failed to load card status', err)
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  // Optimistically mark active+sync-enabled devices (or a specific device) as synced
  // right after the API confirms success. A deferred re-fetch then reconciles with the DB.
  const optimisticallySetEnrolled = useCallback((enrolledCardNumber: number, targetDeviceId?: number) => {
    const now = new Date().toISOString()
    setCardNumber(enrolledCardNumber)
    setDevices(prev => prev.map(d => {
      if (targetDeviceId !== undefined) {
        // Per-device push: only update the target device
        return d.deviceId === targetDeviceId
          ? { ...d, enrolled: true, enrolledAt: now, pendingDeletion: false }
          : d
      }
      // Global enroll: mark all active+sync-enabled devices as synced
      if (d.isActive && d.syncEnabled) {
        return { ...d, enrolled: true, enrolledAt: now, pendingDeletion: false }
      }
      return d
    }))
  }, [])

  useEffect(() => {
    if (isOpen) {
      setSyncResult(null)
      setDetailedResults(null)
      setCardInput('')
      setConfirmGlobalDelete(false)
      setActiveActions({})
      fetchStatus()
    }
  }, [isOpen, fetchStatus])

  const handleGlobalEnroll = useCallback(async () => {
    if (!employeeId) return
    const raw = cardInput.replace(/\D/g, '')
    const parsedNumber = parseInt(raw, 10)

    if (isNaN(parsedNumber) || parsedNumber < 1 || parsedNumber > 4294967295) {
      setSyncResult({ success: false, message: 'Please enter a valid card number (1–4294967295)' })
      return
    }

    setActiveActions(prev => ({ ...prev, globalEnroll: true }))
    setSyncResult(null)
    setDetailedResults(null)

    try {
      const res = await fetch(`/api/employees/${employeeId}/enroll-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber: parsedNumber }),
      })
      const data = await res.json()

      if (data.results) setDetailedResults(data.results)

      if (data.success) {
        setSyncResult({ success: true, message: data.message || 'Card enrolled globally successfully.' })
        onSuccess(data.message || 'Card enrolled successfully.')
        // Immediately update state so the UI reflects synced status without waiting for re-fetch
        optimisticallySetEnrolled(parsedNumber)
        // Deferred reconciliation giving the backend queue time to write to DB
        setTimeout(() => fetchStatus(), 3000)
      } else {
        setSyncResult({ success: false, message: data.message || 'Global enrollment failed' })
      }
    } catch (error) {
      setSyncResult({ success: false, message: 'Network error while enrolling card' })
    } finally {
      setActiveActions(prev => ({ ...prev, globalEnroll: false }))
    }
  }, [employeeId, cardInput, onSuccess, optimisticallySetEnrolled, fetchStatus])

  const handleManualSync = useCallback(async () => {
    if (!employeeId || !cardNumber) return

    setActiveActions(prev => ({ ...prev, manualSync: true }))
    setSyncResult(null)
    setDetailedResults(null)

    try {
      const res = await fetch(`/api/employees/${employeeId}/enroll-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber }),
      })
      const data = await res.json()

      if (data.results) setDetailedResults(data.results)

      if (data.success) {
        setSyncResult({ success: true, message: data.message || 'Sync complete.' })
        if (cardNumber) optimisticallySetEnrolled(cardNumber)
        setTimeout(() => fetchStatus(), 3000)
      } else {
        setSyncResult({ success: false, message: data.message || 'Sync failed.' })
      }
    } catch (error) {
      setSyncResult({ success: false, message: 'Network error while syncing card' })
    } finally {
      setActiveActions(prev => ({ ...prev, manualSync: false }))
    }
  }, [employeeId, cardNumber, optimisticallySetEnrolled, fetchStatus])

  const handleGlobalDelete = useCallback(async () => {
    setActiveActions(prev => ({ ...prev, globalDelete: true }))
    setSyncResult(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/card`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        setSyncResult({ success: true, message: 'Card successfully removed from all devices.' })
        onSuccess(data.message || 'Badge removed successfully.')
        setCardInput('')
        await fetchStatus()
      } else {
        setSyncResult({ success: false, message: data.message || 'Failed to delete card.' })
      }
    } catch {
      setSyncResult({ success: false, message: 'Network error while globally deleting card' })
    } finally {
      setActiveActions(prev => ({ ...prev, globalDelete: false }))
      setConfirmGlobalDelete(false)
    }
  }, [employeeId, onSuccess, fetchStatus])

  const handlePushToDevice = useCallback(async (deviceId: number) => {
    setActiveActions(prev => ({ ...prev, [`push-${deviceId}`]: true }))
    setSyncResult(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/enroll-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber, deviceId }),
      })
      const data = await res.json()
      if (data.success) {
        setSyncResult({ success: true, message: `Card pushed to device successfully.` })
        if (cardNumber) optimisticallySetEnrolled(cardNumber, deviceId)
        setTimeout(() => fetchStatus(), 3000)
      } else {
        setSyncResult({ success: false, message: data.message || 'Push to device failed' })
      }
    } catch {
      setSyncResult({ success: false, message: 'Network error while pushing to device' })
    } finally {
      setActiveActions(prev => ({ ...prev, [`push-${deviceId}`]: false }))
    }
  }, [employeeId, cardNumber, optimisticallySetEnrolled, fetchStatus])

  const handleDeleteFromDevice = useCallback(async (deviceId: number) => {
    setActiveActions(prev => ({ ...prev, [`delete-${deviceId}`]: true }))
    setSyncResult(null)
    try {
      const res = await fetch(`/api/employees/${employeeId}/card/device/${deviceId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        setSyncResult({ success: true, message: `Card removed from device successfully.` })
        // Optimistically mark that specific device as unenrolled
        setDevices(prev => prev.map(d =>
          d.deviceId === deviceId ? { ...d, enrolled: false, enrolledAt: undefined } : d
        ))
        setTimeout(() => fetchStatus(), 3000)
      } else {
        setSyncResult({ success: false, message: data.message || 'Removal from device failed' })
      }
    } catch {
      setSyncResult({ success: false, message: 'Network error while removing from device' })
    } finally {
      setActiveActions(prev => ({ ...prev, [`delete-${deviceId}`]: false }))
    }
  }, [employeeId, fetchStatus])

  const state: RFIDEnrollmentState = {
    loading,
    cardNumber,
    devices,
    cardInput,
    syncResult,
    detailedResults,
    activeActions,
    confirmGlobalDelete,
  }

  const actions: RFIDEnrollmentActions = {
    setCardInput,
    setConfirmGlobalDelete,
    setDetailedResults,
    handleGlobalEnroll,
    handleManualSync,
    handleGlobalDelete,
    handlePushToDevice,
    handleDeleteFromDevice,
  }

  return { state, actions }
}
