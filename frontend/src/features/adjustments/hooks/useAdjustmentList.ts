'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll'
import { useTableSort } from '@/hooks/useTableSort'
import { Adjustment } from '@/features/adjustments/types'

interface EmployeeName {
  firstName: string
  middleName?: string | null
  lastName: string
  suffix?: string | null
}

// ─── Local Formatters ─────────────────────────────────────────────────────────
export function formatTime(iso: string | null): string {
    if (!iso) return '—'
    try {
        const d = new Date(iso)
        if (isNaN(d.getTime())) return '—'
        return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true })
    } catch { return '—' }
}

export function formatTimestamp(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-US', {
            timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: true,
        })
    } catch { return iso }
}

export function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
        })
    } catch { return iso }
}

export function empName(emp: EmployeeName | null | undefined): string {
    if (!emp) return 'Unknown'
    return `${emp.firstName}${emp.middleName ? ` ${emp.middleName[0]}.` : ''} ${emp.lastName}${emp.suffix ? ` ${emp.suffix}` : ''}`
}
// ─────────────────────────────────────────────────────────────────────────────

export function useAdjustmentList(role: 'admin' | 'hr') {
    // Filter state
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState(role === 'admin' ? 'pending' : '')
    const [logDate, setLogDate] = useState('')
    const logDateRef = useRef<HTMLInputElement>(null)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 15

    // Data state
    const [adjustments, setAdjustments] = useState<Adjustment[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)
    const [totalPages, setTotalPages] = useState(1)

    // Modal state
    const [rejectingId, setRejectingId] = useState<number | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [approvingId, setApprovingId] = useState<number | null>(null)
    const [actionLoading, setActionLoading] = useState(false)

    const { toasts, showToast, dismissToast } = useToast()

    // Scroll and sort
    const dragScrollRef = useHorizontalDragScroll()
    const { sortedData: sortedAdjustments, sortKey, sortOrder, handleSort } = useTableSort<Adjustment>({
        initialData: adjustments
    })
    const sortKeyStr = sortKey as string | null

    // ── Derived ──────────────────────────────────────────────────────────────
    const isAdmin = role === 'admin'
    const pendingCount = (isAdmin && statusFilter === 'pending') ? totalCount : null

    const formatDateLabel = (dateStr: string) => {
        if (!dateStr) return 'Select Date'
        const [year, month, day] = dateStr.split('-')
        return `${day}/${month}/${year}`
    }

    // ── Data Fetching ─────────────────────────────────────────────────────────
    const fetchAdjustments = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            params.set('page', String(currentPage))
            params.set('limit', String(itemsPerPage))
            if (searchQuery) params.set('search', searchQuery)
            if (statusFilter) params.set('status', statusFilter)
            if (logDate) params.set('date', logDate)

            const res = await fetch(`/api/attendance/adjustments?${params.toString()}`, { credentials: 'include' })
            if (res.status === 401) { window.location.href = '/login'; return }
            const data = await res.json()

            if (data.success) {
                setAdjustments(data.data)
                setTotalCount(data.meta.total)
                setTotalPages(data.meta.totalPages)
            }
        } catch (err) {
            console.error('Failed to fetch adjustments:', err)
        } finally {
            setLoading(false)
        }
    }, [currentPage, searchQuery, statusFilter, logDate])

    // Fetch on filter/page change
    useEffect(() => { fetchAdjustments() }, [fetchAdjustments])

    // ⚠️ FILTER RESET: page resets to 1 when any filter changes
    useEffect(() => { setCurrentPage(1) }, [searchQuery, statusFilter, logDate])

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleApprove = async (id: number) => {
        setApprovingId(null)
        setActionLoading(true)
        try {
            const res = await fetch(`/api/attendance/adjustments/${id}/review`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ action: 'approve' }),
            })
            const data = await res.json()
            if (data.success) {
                showToast('success', 'Adjustment Approved', 'Adjustment approved and applied!')
                fetchAdjustments()
            } else {
                showToast('error', 'Approval Failed', data.message || 'Failed to approve')
            }
        } catch (e: unknown) {
            showToast('error', 'Approval Failed', e instanceof Error ? e.message : 'Network error')
        } finally {
            setActionLoading(false)
        }
    }

    const handleReject = async () => {
        if (!rejectingId) return
        if (!rejectionReason.trim()) {
            showToast('warning', 'Reason Required', 'Please provide a reason for rejection.')
            return
        }
        setActionLoading(true)
        try {
            const res = await fetch(`/api/attendance/adjustments/${rejectingId}/review`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ action: 'reject', rejectionReason: rejectionReason.trim() }),
            })
            const data = await res.json()
            if (data.success) {
                showToast('success', 'Adjustment Rejected', 'Adjustment rejected.')
                setRejectingId(null)
                setRejectionReason('')
                fetchAdjustments()
            } else {
                showToast('error', 'Rejection Failed', data.message || 'Failed to reject')
            }
        } catch (e: unknown) {
            showToast('error', 'Rejection Failed', e instanceof Error ? e.message : 'Network error')
        } finally {
            setActionLoading(false)
        }
    }

    return {
        // Filter state
        searchQuery, setSearchQuery,
        statusFilter, setStatusFilter,
        logDate, setLogDate,
        logDateRef,
        // Pagination
        currentPage, setCurrentPage,
        itemsPerPage,
        totalCount, totalPages,
        // Data + sort
        loading,
        sortedAdjustments,
        sortKeyStr, sortOrder, handleSort,
        dragScrollRef,
        // Modal state
        rejectingId, setRejectingId,
        rejectionReason, setRejectionReason,
        approvingId, setApprovingId,
        actionLoading,
        // Actions
        handleApprove,
        handleReject,
        // Derived
        isAdmin, pendingCount,
        formatDateLabel,
        // Toast
        toasts, dismissToast,
    }
}
