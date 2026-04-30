import { useState, useCallback, useEffect, useMemo } from 'react'
import { AuditLog, GroupedAuditLog } from '../utils/adjustment-log-types'

interface RawBranch {
    name: string
}

interface UseAdjustmentLogsProps {
    initialItemsPerPage?: number;
    initialEntityId?: number | null;
}

export function useAdjustmentLogs({ initialItemsPerPage = 15, initialEntityId = null }: UseAdjustmentLogsProps = {}) {
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [currentPage, setCurrentPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState('')
    const [branchFilter, setBranchFilter] = useState('All Branches')

    const [entityId, setEntityId] = useState<number | null>(initialEntityId)
    const [branches, setBranches] = useState<string[]>(['All Branches'])
    const itemsPerPage = initialItemsPerPage

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            params.set('page', String(currentPage))
            params.set('limit', String(itemsPerPage))
            if (searchQuery) params.set('search', searchQuery)
            if (branchFilter && branchFilter !== 'All Branches') params.set('branch', branchFilter)
            if (entityId) params.set('entityId', String(entityId))

            const res = await fetch(`/api/attendance/audit-logs?${params.toString()}`, { credentials: 'include' })
            if (res.status === 401) { window.location.href = '/login'; return }
            if (!res.ok) {
                const errData = await res.json().catch(() => null)
                throw new Error(errData?.message || `Server error ${res.status}`)
            }
            const data = await res.json()

            if (data.success) {
                setAuditLogs(data.data)
                setTotalCount(data.meta.total)
                setTotalPages(data.meta.totalPages)


            }
        } catch (err) {
            console.error('Failed to fetch audit logs:', err)
        } finally {
            setLoading(false)
        }
    }, [currentPage, searchQuery, branchFilter, itemsPerPage, branches.length])

    // Also fetch all branches on mount
    useEffect(() => {
        fetch('/api/branches', { credentials: 'include' })
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    const names = (d.branches || d.data || []).map((b: RawBranch) => b.name)
                    setBranches(['All Branches', ...names.sort()])
                }
            })
            .catch(() => { })
    }, [])

    useEffect(() => {
        fetchLogs()
    }, [fetchLogs])

    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, branchFilter])

    const groupedLogs = useMemo(() => {
        const groups: { key: string; logs: AuditLog[] }[] = []
        const groupMap = new Map<string, AuditLog[]>()
        auditLogs.forEach((log) => {
            const emp = log.attendance?.employee
            const adj = log.adjustedBy
            // Group by adjuster, employee, and timestamp (minutes)
            const key = `${adj?.firstName}_${adj?.lastName}_${emp?.firstName}_${emp?.lastName}_${log.createdAt.slice(0, 16)}`
            if (!groupMap.has(key)) {
                const arr: AuditLog[] = []
                groupMap.set(key, arr)
                groups.push({ key, logs: arr })
            }
            if (log.oldValue !== log.newValue) {
                groupMap.get(key)!.push(log)
            }
        })

        return groups.filter(g => g.logs.length > 0).map(group => {
            const first = group.logs[0]
            const emp = first.attendance?.employee
            const adjuster = first.adjustedBy
            const employeeName = emp ? `${emp.firstName}${ emp.middleName ? ` ${ emp.middleName[0]}.` : ''} ${emp.lastName}${ emp.suffix ? ` ${ emp.suffix}` : ''}` : 'Unknown'
            const adjusterName = adjuster ? `${adjuster.firstName} ${adjuster.lastName}` : 'System'
            const approver = first.approvedBy
            const approverName = approver ? `${approver.firstName} ${approver.lastName}` : undefined
            const branch = emp?.Branch?.name || ''
            const reason = group.logs.find(l => l.reason)?.reason || '—'
            const actionType = first.actionType || 'Edit'
            const attendanceDate = first.attendance?.date

            return {
                ...group,
                createdAt: first.createdAt,
                actionType,
                attendanceDate,
                adjusterName,
                approverName,
                employeeName,
                branch,
                reason,
                first
            } as GroupedAuditLog
        })
    }, [auditLogs])

    return {
        auditLogs,
        groupedLogs,
        loading,
        totalCount,
        totalPages,
        currentPage,
        searchQuery,
        branchFilter,
        branches,
        itemsPerPage,
        setCurrentPage,
        setSearchQuery,
        setBranchFilter,
        refresh: fetchLogs
    }
}
