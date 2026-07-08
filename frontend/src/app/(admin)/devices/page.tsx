'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import ToastContainer from '@/components/ui/ToastContainer'
import { Card } from '@/components/ui/card'
import { useDeviceStream, DeviceStatusPayload, DeviceConnectedPayload } from '@/features/devices/hooks/useDeviceStream'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Plus, Server, RadioTower, Loader2, AlertCircle, RefreshCw, ShieldCheck, Users, Trash2, Search, X, Check } from 'lucide-react'

import { DeviceConfigureModal, Device, FormState } from '@/features/devices/components/DeviceConfigureModal'
import { DeviceReconcileModal } from '@/features/devices/components/DeviceReconcileModal'
import { DeviceDeleteConfirmModal } from '@/features/devices/components/DeviceDeleteConfirmModal'
import { DeviceCard } from '@/features/devices/components/DeviceCard'

const EMPTY_FORM: FormState = { name: '', ip: '', port: '4370', location: '', branchId: '' }

interface AdminEnrollment {
    id: number
    employeeId: number
    deviceId: number
    isDeviceAdmin: boolean
    enrolledAt: string
    employee: {
        id: number
        firstName: string
        lastName: string
        employeeNumber: string | null
        zkId: number | null
    }
    device: {
        id: number
        name: string
        ip: string
        isActive: boolean
    }
}

interface MinimalEmployee {
    id: number
    firstName: string
    lastName: string
    employeeNumber: string | null
    zkId: number | null
}

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

    // Branches state
    const [branches, setBranches] = useState<any[]>([])

    // Global Sync State
    const [globalSyncEnabled, setGlobalSyncEnabled] = useState(true)

    // Delete confirm
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Device | null>(null)

    // Test connection state
    const [testingId, setTestingId] = useState<number | null>(null)
    const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string; info?: any }>>({})

    // Toggle sync state
    const [togglingId, setTogglingId] = useState<number | null>(null)

    // Reconcile state
    const [reconcilingId, setReconcilingId] = useState<number | null>(null)
    const [reconcileTarget, setReconcileTarget] = useState<Device | null>(null)

    // Device Admin state
    const [administrators, setAdministrators] = useState<AdminEnrollment[]>([])
    const [employees, setEmployees] = useState<MinimalEmployee[]>([])
    const [showAdminModal, setShowAdminModal] = useState(false)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [savingAdmin, setSavingAdmin] = useState(false)
    const [removeAdminTarget, setRemoveAdminTarget] = useState<{ employeeId: number; fullName: string } | null>(null)
    const [removingAdmin, setRemovingAdmin] = useState(false)

    const { toasts, showToast, dismissToast } = useToast()

    // Group administrators by employee
    const groupedAdmins = React.useMemo(() => {
        const map = new Map<number, {
            employeeId: number
            firstName: string
            lastName: string
            employeeNumber: string | null
            zkId: number | null
            deviceMappings: { deviceId: number; deviceName: string; isActive: boolean }[]
        }>()

        administrators.forEach(admin => {
            const emp = admin.employee
            if (!emp) return
            if (!map.has(emp.id)) {
                map.set(emp.id, {
                    employeeId: emp.id,
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    employeeNumber: emp.employeeNumber,
                    zkId: emp.zkId,
                    deviceMappings: []
                })
            }
            map.get(emp.id)!.deviceMappings.push({
                deviceId: admin.deviceId,
                deviceName: admin.device?.name || 'Unknown Device',
                isActive: admin.device?.isActive || false
            })
        })

        return Array.from(map.values())
    }, [administrators])

    const fetchAdministrators = useCallback(async () => {
        try {
            const res = await fetch('/api/devices/administrators', { credentials: 'include' })
            const data = await res.json()
            if (data.success) {
                setAdministrators(data.administrators)
            }
        } catch (e) {
            console.error('Error fetching administrators:', e)
        }
    }, [])

    const fetchEmployees = useCallback(async () => {
        try {
            const res = await fetch('/api/employees?fields=minimal', { credentials: 'include' })
            const data = await res.json()
            if (data.success) {
                setEmployees(data.employees)
            }
        } catch (e) {
            console.error('Error fetching employees:', e)
        }
    }, [])

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

    const fetchBranches = useCallback(async () => {
        try {
            const res = await fetch('/api/branches', { credentials: 'include' })
            const data = await res.json()
            if (data.success) {
                setBranches(data.branches)
            }
        } catch (e) {
            console.error('Error fetching branches:', e)
        }
    }, [])

    useEffect(() => {
        fetchDevices()
        fetchAdministrators()
        fetchEmployees()
        fetchBranches()
    }, [fetchDevices, fetchAdministrators, fetchEmployees, fetchBranches])

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
        setForm({
            name: device.name,
            ip: device.ip,
            port: String(device.port),
            location: device.location || '',
            branchId: device.branchId ? String(device.branchId) : ''
        })
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
                body: JSON.stringify({
                    name: form.name.trim(),
                    ip: form.ip.trim(),
                    port,
                    location: form.location.trim() || null,
                    branchId: form.branchId ? Number(form.branchId) : null
                })
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

    const handleDelete = async () => {
        if (!deleteTarget) return
        setDeletingId(deleteTarget.id)
        try {
            const res = await fetch(`/api/devices/${deleteTarget.id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            const data = await res.json()
            if (data.success) {
                showToast('success', 'Device Removed', data.message || 'Device removed')
                setDeleteTarget(null)
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


    const openManageAdmin = (empId?: number) => {
        if (empId) {
            setSelectedEmployeeId(String(empId));
            const existing = administrators.filter(a => a.employeeId === empId);
            setSelectedDeviceIds(existing.map(a => a.deviceId));
        } else {
            setSelectedEmployeeId('');
            setSelectedDeviceIds([]);
        }
        setSearchTerm('');
        setShowAdminModal(true);
    };

    const toggleDeviceSelection = (deviceId: number) => {
        setSelectedDeviceIds(prev =>
            prev.includes(deviceId)
                ? prev.filter(id => id !== deviceId)
                : [...prev, deviceId]
        );
    };

    const handleSaveAdmin = async () => {
        if (!selectedEmployeeId) return;
        setSavingAdmin(true);
        try {
            const res = await fetch('/api/devices/administrators', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    employeeId: Number(selectedEmployeeId),
                    deviceIds: selectedDeviceIds
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast('success', 'Administrators Updated', data.message || 'Device administrator roles updated.');
                setShowAdminModal(false);
                setSelectedEmployeeId('');
                setSelectedDeviceIds([]);
                setSearchTerm('');
                fetchAdministrators();
                fetchDevices();
            } else {
                showToast('error', 'Update Failed', data.message || 'Failed to update administrators');
            }
        } catch (e: any) {
            showToast('error', 'Error', e.message || 'Network error');
        } finally {
            setSavingAdmin(false);
        }
    };

    const handleRemoveAdmin = (employeeId: number, fullName: string) => {
        setRemoveAdminTarget({ employeeId, fullName });
    };

    const confirmRemoveAdmin = async () => {
        if (!removeAdminTarget) return;
        setRemovingAdmin(true);
        try {
            const res = await fetch(`/api/devices/administrators/${removeAdminTarget.employeeId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('success', 'Privileges Revoked', data.message || 'Device administrator privileges revoked.');
                fetchAdministrators();
                fetchDevices();
            } else {
                showToast('error', 'Revocation Failed', data.message || 'Failed to revoke privileges');
            }
        } catch (e: any) {
            showToast('error', 'Error', e.message || 'Network error');
        } finally {
            setRemovingAdmin(false);
            setRemoveAdminTarget(null);
        }
    };


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
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
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
                            isToggling={togglingId === device.id}
                            isReconciling={reconcilingId === device.id}
                            onToggleSync={handleToggleSync}
                            onTest={handleTest}
                            onConfirmReconcile={(d) => setReconcileTarget(d)}
                            onOpenEdit={openEdit}
                            onDeleteClick={(d) => setDeleteTarget(d)}
                        />
                    ))}
                </div>
            )}

            {/* ── Device Administrators Section ────────────────────────── */}
            <div className="space-y-4 pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Device Administrators</h2>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Manage employee administrative privileges on physical terminals</p>
                        </div>
                    </div>
                    <div>
                        <Button onClick={() => openManageAdmin()} className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
                            <Plus className="w-4 h-4" />
                            Manage Administrators
                        </Button>
                    </div>
                </div>

                <Card className="bg-card border-border overflow-hidden">
                    {/* Desktop View Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border bg-secondary/10">
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrator</th>
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ZK ID</th>
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Terminals</th>
                                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {groupedAdmins.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12 text-sm text-muted-foreground">
                                            <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                            No device administrators designated yet.
                                        </td>
                                    </tr>
                                ) : (
                                    groupedAdmins.map((admin) => (
                                        <tr key={admin.employeeId} className="hover:bg-secondary/10 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="font-bold text-foreground">
                                                    {admin.firstName} {admin.lastName}
                                                </div>
                                                {admin.employeeNumber && (
                                                    <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                                                        ID: {admin.employeeNumber}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-xs text-muted-foreground font-mono font-bold bg-secondary/30 px-2 py-1 rounded-md">
                                                    {admin.zkId || '—'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {admin.deviceMappings.map((mapping) => (
                                                        <span
                                                            key={mapping.deviceId}
                                                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                                                                mapping.isActive
                                                                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                                            }`}
                                                        >
                                                            <span className={`w-1.5 h-1.5 rounded-full ${mapping.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                                                            {mapping.deviceName}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openManageAdmin(admin.employeeId)}
                                                        className="text-xs font-bold text-primary hover:bg-primary/10"
                                                    >
                                                        Manage
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveAdmin(admin.employeeId, `${admin.firstName} ${admin.lastName}`)}
                                                        className="text-xs font-bold text-red-500 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View Cards */}
                    <div className="block md:hidden divide-y divide-border">
                        {groupedAdmins.length === 0 ? (
                            <div className="text-center py-12 text-sm text-muted-foreground px-5">
                                <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                No device administrators designated yet.
                            </div>
                        ) : (
                            groupedAdmins.map((admin) => (
                                <div key={admin.employeeId} className="p-5 space-y-3.5 hover:bg-secondary/5 transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-bold text-foreground text-sm sm:text-base">
                                                {admin.firstName} {admin.lastName}
                                            </div>
                                            {admin.employeeNumber && (
                                                <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                                                    ID: {admin.employeeNumber}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0">
                                            <span className="text-[10px] text-muted-foreground font-mono font-bold bg-secondary/30 px-2 py-1 rounded-md">
                                                ZK ID: {admin.zkId || '—'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Terminals</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {admin.deviceMappings.map((mapping) => (
                                                <span
                                                    key={mapping.deviceId}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                                                        mapping.isActive
                                                            ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                                            : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full ${mapping.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                                                    {mapping.deviceName}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openManageAdmin(admin.employeeId)}
                                            className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 h-auto"
                                        >
                                            Manage
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveAdmin(admin.employeeId, `${admin.firstName} ${admin.lastName}`)}
                                            className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 h-auto"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Remove
                                            </span>
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            <DeviceConfigureModal 
                isOpen={showModal} 
                editingDevice={editingDevice} 
                form={form} 
                setForm={setForm} 
                formError={formError} 
                saving={saving} 
                branches={branches}
                onClose={closeModal} 
                onSave={handleSave} 
            />

            <DeviceReconcileModal 
                reconcileTarget={reconcileTarget} 
                reconcilingId={reconcilingId} 
                onClose={() => setReconcileTarget(null)} 
                onReconcile={handleReconcile} 
            />

            <DeviceDeleteConfirmModal 
                device={deleteTarget} 
                deleting={deletingId !== null} 
                onClose={() => setDeleteTarget(null)} 
                onConfirm={handleDelete} 
            />

            {/* ── Manage Device Administrators Modal ─────────────────────── */}
            {showAdminModal && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-100 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-secondary/20 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Manage Device Admin</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Configure device-level administrator access</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setShowAdminModal(false); setSelectedEmployeeId(''); setSelectedDeviceIds([]); setSearchTerm(''); }} 
                                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                            >
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4 overflow-visible">
                            {/* Search and Select Employee */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Employee *</label>
                                {selectedEmployeeId ? (
                                    (() => {
                                        const emp = employees.find(e => e.id === Number(selectedEmployeeId))
                                        return (
                                            <div className="flex items-center justify-between p-3 bg-secondary/40 border border-border rounded-xl">
                                                <div>
                                                    <p className="font-bold text-sm text-foreground">{emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee'}</p>
                                                    <p className="text-xs text-muted-foreground font-semibold mt-0.5">ZK ID: {emp?.zkId || '—'} | ID: {emp?.employeeNumber || '—'}</p>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => { setSelectedEmployeeId(''); setSelectedDeviceIds([]); }}
                                                    className="text-xs text-muted-foreground hover:text-red-500"
                                                >
                                                    Change
                                                </Button>
                                            </div>
                                        )
                                    })()
                                ) : (
                                    <div className="relative font-sans">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search by name or employee ID..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-secondary/40 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-800"
                                        />
                                        {searchTerm.trim() !== '' && (
                                            <div className="absolute z-999 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100" style={{boxShadow: '0 8px 32px rgba(0,0,0,0.18)'}}>
                                                {(() => {
                                                    const filtered = employees.filter(emp => {
                                                        const full = `${emp.firstName} ${emp.lastName}`.toLowerCase()
                                                        const num = (emp.employeeNumber || '').toLowerCase()
                                                        const term = searchTerm.toLowerCase()
                                                        return (full.includes(term) || num.includes(term)) && emp.zkId !== null
                                                    })

                                                    if (filtered.length === 0) {
                                                        return <p className="p-3 text-xs text-muted-foreground text-center">No synchronized employees found</p>
                                                    }

                                                    return filtered.map(emp => (
                                                        <button
                                                            key={emp.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedEmployeeId(String(emp.id));
                                                                const existing = administrators.filter(a => a.employeeId === emp.id);
                                                                setSelectedDeviceIds(existing.map(a => a.deviceId));
                                                            }}
                                                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 flex justify-between items-center text-slate-700"
                                                        >
                                                            <div>
                                                                <p className="font-bold text-slate-800">{emp.firstName} {emp.lastName}</p>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">ID: {emp.employeeNumber || '—'}</p>
                                                            </div>
                                                            <span className="text-[10px] font-bold font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">ZK: {emp.zkId}</span>
                                                        </button>
                                                    ))
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Device Checklist */}
                            {selectedEmployeeId && (
                                <div className="space-y-2.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Authorized Terminals</label>
                                    {devices.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">No terminals configured in system.</p>
                                    ) : (
                                        <div className="border border-border rounded-xl bg-secondary/20 divide-y divide-border max-h-48 overflow-y-auto">
                                            {devices.map(device => (
                                                <label 
                                                    key={device.id} 
                                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                                                >
                                                    <div className="min-w-0 pr-3">
                                                        <p className="text-xs font-bold text-foreground truncate">{device.name}</p>
                                                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{device.ip}</p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDeviceIds.includes(device.id)}
                                                        onChange={() => toggleDeviceSelection(device.id)}
                                                        className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-border bg-card cursor-pointer"
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 pb-6 pt-2 flex gap-3 rounded-b-2xl">
                            <Button 
                                variant="outline" 
                                onClick={() => { setShowAdminModal(false); setSelectedEmployeeId(''); setSelectedDeviceIds([]); setSearchTerm(''); }} 
                                className="flex-1 border-border"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveAdmin}
                                disabled={savingAdmin || !selectedEmployeeId}
                                className="flex-1 bg-primary hover:bg-primary/90 gap-2"
                            >
                                {savingAdmin
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                    : <><Check className="w-4 h-4" /> Save Mappings</>}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Remove Admin Confirmation Modal ─────────────────────── */}
            {removeAdminTarget && (
                <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-200 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 px-6 pt-6 pb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground">Revoke Admin Privileges</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone</p>
                            </div>
                        </div>
                        <div className="px-6 pb-4">
                            <p className="text-sm text-muted-foreground">
                                Are you sure you want to revoke all device administrator privileges for{' '}
                                <span className="font-bold text-foreground">{removeAdminTarget.fullName}</span>?
                            </p>
                        </div>
                        <div className="flex gap-3 px-6 pb-6">
                            <Button
                                variant="outline"
                                onClick={() => setRemoveAdminTarget(null)}
                                disabled={removingAdmin}
                                className="flex-1 border-border"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={confirmRemoveAdmin}
                                disabled={removingAdmin}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white gap-2"
                            >
                                {removingAdmin
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Revoking...</>
                                    : <><Trash2 className="w-4 h-4" /> Revoke</>}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
    )
}