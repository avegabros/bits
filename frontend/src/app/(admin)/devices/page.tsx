'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ui/ToastContainer'
import { Card } from '@/components/ui/card'
import { useDeviceStream, DeviceStatusPayload, DeviceConnectedPayload } from '@/features/devices/hooks/useDeviceStream'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Plus, Server, RadioTower, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

import { DeviceConfigureModal, Device, FormState } from '@/features/devices/components/DeviceConfigureModal'
import { DeviceReconcileModal } from '@/features/devices/components/DeviceReconcileModal'
import { DeviceCard } from '@/features/devices/components/DeviceCard'

const EMPTY_FORM: FormState = { name: '', ip: '', port: '4370', location: '' }

export default function DevicesPage() {
    const [devices, setDevices] = useState<Device[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [editingDevice, setEditingDevice] = useState<Device | null>(null)
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    // Global Sync State
    const [globalSyncEnabled, setGlobalSyncEnabled] = useState(true)

    // Delete confirm
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

    // Test connection state
    const [testingId, setTestingId] = useState<number | null>(null)
    const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string; info?: any }>>({})

    // Toggle sync state
    const [togglingId, setTogglingId] = useState<number | null>(null)

    // Reconcile state
    const [reconcilingId, setReconcilingId] = useState<number | null>(null)
    const [reconcileTarget, setReconcileTarget] = useState<Device | null>(null)

    const { toasts, showToast, dismissToast } = useToast()

    const fetchDevices = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [devRes, syncRes] = await Promise.all([
                fetch('/api/devices', { credentials: 'include' }),
                fetch('/api/system/sync-status', { credentials: 'include' })
            ])
            const data = await devRes.json()
            if (data.success) setDevices(data.devices)
            else setError(data.message || 'Failed to fetch devices')

            if (syncRes.ok) {
                const syncData = await syncRes.json()
                if (syncData.success) {
                    setGlobalSyncEnabled(syncData.status.globalSyncEnabled)
                }
            }
        } catch (e: any) {
            setError(e.message || 'Network error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchDevices() }, [fetchDevices])

    const handleDeviceConnected = useCallback((payload: DeviceConnectedPayload) => {
        setDevices(prev => prev.map(device => {
            const fresh = payload.devices.find(d => d.id === device.id)
            if (!fresh) return device
            return { 
                ...device, 
                isActive: fresh.isActive, 
                syncEnabled: fresh.syncEnabled,
                lastPolledAt: fresh.lastPolledAt !== undefined ? fresh.lastPolledAt : device.lastPolledAt,
                lastSyncedAt: fresh.lastSyncedAt !== undefined ? fresh.lastSyncedAt : device.lastSyncedAt,
                lastSyncStatus: fresh.lastSyncStatus !== undefined ? fresh.lastSyncStatus : device.lastSyncStatus,
                lastSyncError: fresh.lastSyncError !== undefined ? fresh.lastSyncError : device.lastSyncError,
                lastReconciledAt: fresh.lastReconciledAt !== undefined ? fresh.lastReconciledAt : device.lastReconciledAt,
            }
        }))
    }, [])

    const handleDeviceStatus = useCallback((payload: DeviceStatusPayload) => {
        setDevices(prev => prev.map(device =>
            device.id === payload.id
                ? { ...device, isActive: payload.isActive }
                : device
        ))
        showToast(
            payload.isActive ? 'success' : 'warning',
            payload.isActive ? 'Device Online' : 'Device Offline',
            payload.isActive
                ? `${payload.name} is back online`
                : `${payload.name} went offline`
        )
    }, [])

    const handleSyncResult = useCallback((payload: any) => {
        setDevices(prev => prev.map(device =>
            device.id === payload.id
                ? { 
                    ...device, 
                    lastSyncStatus: payload.lastSyncStatus, 
                    lastSyncedAt: payload.lastSyncedAt, 
                    lastSyncError: payload.lastSyncError,
                    lastPolledAt: payload.lastPolledAt ?? device.lastPolledAt
                  }
                : device
        ))
    }, [])

    useDeviceStream({
        onConnected: handleDeviceConnected,
        onStatusChange: handleDeviceStatus,
        onSyncResult: handleSyncResult,
    })

    const openAdd = () => {
        setEditingDevice(null)
        setForm(EMPTY_FORM)
        setFormError(null)
        setShowModal(true)
    }

    const openEdit = (device: Device) => {
        setEditingDevice(device)
        setForm({ name: device.name, ip: device.ip, port: String(device.port), location: device.location || '' })
        setFormError(null)
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingDevice(null)
        setForm(EMPTY_FORM)
        setFormError(null)
    }

    const handleSave = async () => {
        if (!form.name.trim()) { setFormError('Device name is required'); return }
        if (!form.ip.trim()) { setFormError('IP address is required'); return }
        if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(form.ip.trim())) { setFormError('Invalid IP address format (e.g. 192.168.0.201)'); return }
        const port = parseInt(form.port)
        if (isNaN(port) || port < 1 || port > 65535) { setFormError('Port must be between 1 and 65535'); return }

        setSaving(true)
        setFormError(null)
        try {
            const url = editingDevice ? `/api/devices/${editingDevice.id}` : '/api/devices'
            const method = editingDevice ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: form.name.trim(), ip: form.ip.trim(), port, location: form.location.trim() || null })
            })
            const data = await res.json()
            if (data.success) {
                showToast('success', editingDevice ? 'Device Updated' : 'Device Added', data.message || (editingDevice ? 'Device updated' : 'Device added'))
                closeModal()
                fetchDevices()
            } else {
                setFormError(data.message || 'Failed to save device')
            }
        } catch (e: any) {
            setFormError(e.message || 'Network error')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: number) => {
        setDeletingId(id)
        try {
            const res = await fetch(`/api/devices/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            const data = await res.json()
            if (data.success) {
                showToast('success', 'Device Removed', data.message || 'Device removed')
                setDeleteConfirmId(null)
                fetchDevices()
            } else {
                showToast('error', 'Delete Failed', data.message || 'Failed to delete device')
            }
        } catch (e: any) {
            showToast('error', 'Delete Failed', e.message || 'Network error')
        } finally {
            setDeletingId(null)
        }
    }

    const handleTest = async (device: Device) => {
        setTestingId(device.id)
        setTestResults(prev => ({ ...prev, [device.id]: { success: false, message: 'Connecting...' } }))
        try {
            const res = await fetch(`/api/devices/${device.id}/test`, {
                method: 'POST',
                credentials: 'include'
            })
            const data = await res.json()
            setTestResults(prev => ({ ...prev, [device.id]: { success: data.success, message: data.message, info: data.info } }))
            fetchDevices()
        } catch (e: any) {
            setTestResults(prev => ({ ...prev, [device.id]: { success: false, message: e.message || 'Connection failed' } }))
        } finally {
            setTestingId(null)
        }
    }

    const handleReconcile = async () => {
        if (!reconcileTarget) return;

        setReconcilingId(reconcileTarget.id)
        try {
            const res = await fetch(`/api/devices/${reconcileTarget.id}/reconcile`, {
                method: 'POST',
                credentials: 'include'
            })
            const data = await res.json()
            if (data.success) {
                showToast('success', 'Reconcile Queued', data.message || 'Reconcile task queued successfully')
            } else {
                showToast('error', 'Reconcile Failed', data.message || 'Failed to queue reconcile')
            }
        } catch (e: any) {
            showToast('error', 'Network Error', e.message || 'Network error')
        } finally {
            setReconcilingId(null)
            setReconcileTarget(null)
        }
    }

    const handleToggleSync = async (device: Device) => {
        setTogglingId(device.id)
        setDevices(prev => prev.map(d =>
            d.id === device.id ? { ...d, syncEnabled: !d.syncEnabled } : d
        ))
        try {
            const res = await fetch(`/api/devices/${device.id}/toggle`, {
                method: 'PATCH',
                credentials: 'include'
            })
            const data = await res.json()
            if (!data.success) {
                setDevices(prev => prev.map(d =>
                    d.id === device.id ? { ...d, syncEnabled: device.syncEnabled } : d
                ))
                showToast('error', 'Sync Toggle Failed', data.message || 'Failed to toggle sync')
            } else {
                showToast(data.device.syncEnabled ? 'success' : 'warning', 'Sync Updated', data.message)
            }
        } catch (e: any) {
            setDevices(prev => prev.map(d =>
                d.id === device.id ? { ...d, syncEnabled: device.syncEnabled } : d
            ))
            showToast('error', 'Sync Toggle Failed', e.message || 'Network error')
        } finally {
            setTogglingId(null)
        }
    }


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <RadioTower className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Biometric Devices</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Manage ZKTeco device configurations</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button variant="outline" size="sm" onClick={fetchDevices} className="gap-2 border-border">
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                    <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 gap-2">
                        <Plus className="w-4 h-4" />
                        Add Device
                    </Button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive"><AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {!globalSyncEnabled && (
                <Alert variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="font-bold">Global Synchronization is Paused</AlertTitle>
                    <AlertDescription>
                        System-wide synchronization is currently disabled in System Settings. 
                        Even if individual devices have sync enabled below, no logs will be pulled until global sync is resumed.
                    </AlertDescription>
                </Alert>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="text-sm">Loading devices...</span>
                    </div>
                </div>
            ) : devices.length === 0 ? (
                <Card className="bg-card border-border">
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center">
                            <Server className="w-8 h-8 text-muted-foreground/40" />
                        </div>
                        <div className="text-center">
                            <p className="text-base font-semibold text-foreground">No devices configured</p>
                            <p className="text-sm text-muted-foreground mt-1">Add your first ZKTeco biometric device to get started</p>
                        </div>
                        <Button onClick={openAdd} className="bg-primary gap-2">
                            <Plus className="w-4 h-4" />
                            Add Device
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                    {devices.map(device => (
                        <DeviceCard
                            key={device.id}
                            device={device}
                            testResult={testResults[device.id]}
                            isTesting={testingId === device.id}
                            isConfirmingDelete={deleteConfirmId === device.id}
                            isToggling={togglingId === device.id}
                            isReconciling={reconcilingId === device.id}
                            deletingId={deletingId}
                            onToggleSync={handleToggleSync}
                            onTest={handleTest}
                            onConfirmReconcile={(d) => setReconcileTarget(d)}
                            onOpenEdit={openEdit}
                            onSetDeleteConfirm={setDeleteConfirmId}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            <DeviceConfigureModal 
                isOpen={showModal} 
                editingDevice={editingDevice} 
                form={form} 
                setForm={setForm} 
                formError={formError} 
                saving={saving} 
                onClose={closeModal} 
                onSave={handleSave} 
            />

            <DeviceReconcileModal 
                reconcileTarget={reconcileTarget} 
                reconcilingId={reconcilingId} 
                onClose={() => setReconcileTarget(null)} 
                onReconcile={handleReconcile} 
            />

            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
    )
}