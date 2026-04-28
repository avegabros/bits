'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll'
import { useToast } from '@/hooks/useToast'
import { useTableSort } from '@/hooks/useTableSort'
import { useAttendanceStream, AttendanceStreamPayload } from '@/features/attendance/hooks/useAttendanceStream'
import { fmtHours, formatLate, fmtMins, toTimeInput } from '@/features/attendance/utils/attendance-formatters'
import { AttendanceRecord } from '@/features/attendance/types'
import * as XLSX from 'xlsx'

interface RawAttendanceLog {
  employee?: {
    role?: string
    firstName: string
    middleName?: string
    lastName: string
    suffix?: string
    Department?: { name: string }
    Branch?: { name: string }
    Shift?: { shiftCode: string; isNightShift: boolean }
  }
  status: string
  checkInTime: string | null
  checkOutTime: string | null
  date: string
  id: number
  employeeId: number
  totalHours: number
  lateMinutes: number
  overtimeMinutes: number
  undertimeMinutes: number
  shiftCode: string | null
  isAnomaly?: boolean
  isEarlyOut?: boolean
  isShiftActive?: boolean
  gracePeriodApplied?: boolean
  notes?: string
  isEarlyPunch?: boolean
  isMissingCheckout?: boolean
  checkInDeviceName?: string | null
  checkOutDeviceName?: string | null
  checkoutSource?: string | null
  isEdited?: boolean
  isPending?: boolean
  displayStatus?: string
}

interface RawEmployee {
  id: number
  role: string
  employmentStatus: string
  firstName: string
  lastName: string
  Department?: { name: string }
  Branch?: { name: string }
  Shift?: { shiftCode: string; isNightShift: boolean }
}

interface EditRequestBody {
  reason: string
  employeeId?: number
  date?: string
  checkInTime?: string
  checkOutTime?: string
}

const ROW_PER_PAGE = 10

export function useAttendanceDashboard(role: 'admin' | 'hr') {
  const searchParams = useSearchParams()
  const { toasts, showToast, dismissToast } = useToast()

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getTodayDate = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

  // ── Filter State ──────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(getTodayDate)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('All Branches')
  const [deptFilter, setDeptFilter] = useState('All Departments')

  // ── Data State ────────────────────────────────────────────────────────────
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branchesList, setBranchesList] = useState<{ id: number; name: string }[]>([])
  const [departmentsList, setDepartmentsList] = useState<{ id: number; name: string }[]>([])
  const [stats, setStats] = useState({ onTime: 0, late: 0, absent: 0, incomplete: 0, total: 0, avgHours: '0', totalOT: '0', totalUT: '0' })

  // ── Pagination ────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // ── Edit Modal State ──────────────────────────────────────────────────────
  const [editingLog, setEditingLog] = useState<AttendanceRecord | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [editCheckIn, setEditCheckIn] = useState('')
  const [editCheckOut, setEditCheckOut] = useState('')
  const [editReason, setEditReason] = useState('')

  // ── Refs ──────────────────────────────────────────────────────────────────
  const dateInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const dragScrollRef = useHorizontalDragScroll()

  // ── Sort ──────────────────────────────────────────────────────────────────
  const { sortedData: sortedRecords, sortKey, sortOrder, handleSort } = useTableSort<AttendanceRecord>({
    initialData: records
  })
  const sortKeyStr = sortKey as string | null

  // ── Derived filter lists ──────────────────────────────────────────────────
  const branches = ['All Branches', ...branchesList.map(b => b.name)]
  const departments = ['All Departments', ...departmentsList.map(d => d.name)]
  const statuses = [
    { value: 'all', label: 'All Status' },
    { value: 'present', label: 'On Time' },
    { value: 'late', label: 'Late' },
    { value: 'absent', label: 'Absent' },
    { value: 'incomplete', label: 'Missing Checkout' },
  ]

  // ── Effects ───────────────────────────────────────────────────────────────
  // Read URL query params from dashboard navigation
  useEffect(() => {
    const branchQuery = searchParams.get('branch')
    const statusQuery = searchParams.get('status')
    if (branchQuery) setBranchFilter(branchQuery)
    if (statusQuery) {
      const s = statusQuery.toLowerCase()
      setStatusFilter(s === 'present' ? 'present' : s === 'late' ? 'late' : s === 'absent' ? 'absent' : 'all')
    }
  }, [searchParams])

  // Debounce search — 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ⚠️ FILTER RESET: page resets to 1 on any filter or date change
  useEffect(() => { setCurrentPage(1) }, [selectedDate, statusFilter, debouncedSearch, branchFilter, deptFilter])

  // Fetch branches — on mount only
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/branches', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.branches) setBranchesList(data.branches)
        }
      } catch { /* ignore */ }
    }
    run()
  }, [])

  // Fetch departments — on mount only
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/departments', { credentials: 'include' })
        const data = await res.json()
        if (data.success && data.departments) setDepartmentsList(data.departments)
      } catch { /* ignore */ }
    }
    run()
  }, [])

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    // Abort any in-flight request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    const { signal } = controller

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        startDate: selectedDate,
        endDate: selectedDate,
        limit: '500',
      })
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const res = await fetch(`/api/attendance?${params}`, { credentials: 'include', signal })
      if (res.status === 401) { window.location.href = '/login'; return }

      const data = await res.json()
      if (data.success) {
        const userRecords = data.data.filter((log: RawAttendanceLog) => {
          const emp = log.employee
          return !emp || emp.role === 'USER' || !emp.role
        })

        const mapped: AttendanceRecord[] = userRecords.map((log: RawAttendanceLog) => {
          const emp = log.employee
          const isPending = log.isPending === true
          const isPendingManualCreation = isPending && log.notes?.includes('[Pending] Manual creation');

          const checkIn = log.checkInTime ? new Date(log.checkInTime) : new Date()
          const checkOut = log.checkOutTime ? new Date(log.checkOutTime) : null
          const totalHours: number = isPendingManualCreation ? 0 : (log.totalHours ?? (checkOut ? (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) : 0))
          const lateMinutes: number = isPendingManualCreation ? 0 : (log.lateMinutes ?? 0)
          const overtimeMinutes: number = isPendingManualCreation ? 0 : (log.overtimeMinutes ?? 0)
          const undertimeMinutes: number = isPendingManualCreation ? 0 : (log.undertimeMinutes ?? 0)
          const shiftCode: string | null = log.shiftCode ?? emp?.Shift?.shiftCode ?? null
          const isAnomaly: boolean = isPendingManualCreation ? false : (log.isAnomaly ?? false)
          const isEarlyOut: boolean = isPendingManualCreation ? false : (log.isEarlyOut ?? false)
          const isShiftActive: boolean = isPendingManualCreation ? false : (log.isShiftActive ?? false)
          const gracePeriodApplied: boolean = log.gracePeriodApplied ?? false
          let computedStatus = isEarlyOut ? 'early-out' : isAnomaly ? 'anomaly' : lateMinutes > 0 ? 'late' : undertimeMinutes > 0 ? 'undertime' : (log.status || 'present')
          const hasMissingCheckout = log.checkOutTime === null && log.status === 'incomplete';
          
          let displayStatus = isShiftActive ? 'IN_PROGRESS' : hasMissingCheckout ? 'missing_checkout' : computedStatus

          if (isPendingManualCreation) {
            computedStatus = 'absent'
            displayStatus = 'absent'
          }

          return {
            id: log.id,
            employeeId: log.employeeId,
            employeeName: emp?.firstName ? `${emp.firstName}${emp.middleName ? ` ${emp.middleName[0]}.` : ''} ${emp.lastName}${emp.suffix ? ` ${emp.suffix}` : ''}` : 'Unknown',
            department: emp?.Department?.name || 'General',
            branchName: emp?.Branch?.name || '—',
            date: new Date(log.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
            checkIn: isPendingManualCreation ? '—' : (log.checkInTime ? checkIn.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'),
            checkOut: isPendingManualCreation ? '—' : (checkOut ? checkOut.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'),
            status: computedStatus, 
            displayStatus, lateMinutes, totalHours, overtimeMinutes, undertimeMinutes, shiftCode,
            isNightShift: emp?.Shift?.isNightShift ?? false,
            isAnomaly, isEarlyOut, isShiftActive, gracePeriodApplied,
            notes: log.notes || null,
            isEarlyPunch: log.isEarlyPunch ?? false,
            isMissingCheckout: log.isMissingCheckout ?? false,
            checkInDevice: log.checkInDeviceName ?? null,
            checkOutDevice: log.checkOutDeviceName ?? null,
            checkoutSource: log.checkoutSource ?? null,
            isEdited: log.isEdited ?? false,
            isPending,
          }
        })

        // Fetch all active employees to inject absent rows
        let allEmployees: RawEmployee[] = []
        try {
          const empRes = await fetch('/api/employees?limit=9999', { credentials: 'include', signal })
          const empData = await empRes.json()
          if (empData.success) allEmployees = (empData.employees || empData.data || []).filter((e: RawEmployee) =>
            (e.role === 'USER' || !e.role) && (e.employmentStatus === 'ACTIVE' || !e.employmentStatus)
          )
        } catch { /* ignore */ }

        const presentIds = new Set(mapped.map(r => r.employeeId))
        const absentRows: AttendanceRecord[] = allEmployees
          .filter((e: RawEmployee) => !presentIds.has(e.id))
          .map((e: RawEmployee) => ({
            id: `absent-${e.id}`,
            employeeId: e.id,
            employeeName: `${e.firstName} ${e.lastName}`,
            department: e.Department?.name || 'General',
            branchName: e.Branch?.name || '—',
            date: selectedDate,
            checkIn: '—', checkOut: '—', status: 'absent', displayStatus: 'absent',
            lateMinutes: 0, totalHours: 0, overtimeMinutes: 0, undertimeMinutes: 0,
            shiftCode: e.Shift?.shiftCode ?? null,
            isNightShift: e.Shift?.isNightShift ?? false,
            isAnomaly: false, isEarlyOut: false, isShiftActive: false, gracePeriodApplied: false,
            isEarlyPunch: false, isMissingCheckout: false,
          }))

        let full = (statusFilter === 'all' || statusFilter === 'absent')
          ? [...mapped, ...absentRows]
          : [...mapped]

        // Apply client-side filters
        if (debouncedSearch) full = full.filter(r => r.employeeName.toLowerCase().includes(debouncedSearch.toLowerCase()))
        if (branchFilter !== 'All Branches') full = full.filter(r => r.branchName === branchFilter)
        if (deptFilter !== 'All Departments') full = full.filter(r => r.department === deptFilter)

        setRecords(full)
        setTotalPages(Math.max(1, Math.ceil(full.length / ROW_PER_PAGE)))
        setStats({
          onTime: full.filter(r => r.status === 'present').length,
          late: full.filter(r => r.status === 'late').length,
          absent: full.filter(r => r.status === 'absent').length,
          incomplete: full.filter(r => r.status === 'incomplete' || r.displayStatus === 'missing_checkout').length,
          total: full.length,
          avgHours: full.length > 0
            ? (full.filter(r => r.totalHours > 0).reduce((s, r) => s + r.totalHours, 0) /
              (full.filter(r => r.totalHours > 0).length || 1)).toFixed(1) : '0',
          totalOT: (full.reduce((s, r) => s + (r.overtimeMinutes ?? 0), 0) / 60).toFixed(1),
          totalUT: (full.reduce((s, r) => s + (r.undertimeMinutes ?? 0), 0) / 60).toFixed(1),
        })
      } else {
        setError(data.message || 'Failed to fetch attendance')
      }
    } catch (e: unknown) {
      // Silently ignore aborted requests — they are intentional cancellations
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      // Only clear loading if this controller is still the active one
      if (abortControllerRef.current === controller) {
        setLoading(false)
      }
    }
  }, [selectedDate, statusFilter, debouncedSearch, branchFilter, deptFilter])

  // SSE stream — teardown is managed internally by useAttendanceStream
  const handleStreamRecord = useCallback((payload: AttendanceStreamPayload) => {
    const recordDateStr = new Date(payload.record.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
    if (recordDateStr === selectedDate) fetchRecords()
  }, [selectedDate, fetchRecords])

  useAttendanceStream({
    onRecord: handleStreamRecord,
    onConnected: fetchRecords,
  })

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleEditClick = useCallback((row: AttendanceRecord) => {
    setEditingLog(row)
    setEditCheckIn(toTimeInput(row.checkIn))
    setEditCheckOut(toTimeInput(row.checkOut))
    setEditReason('')
  }, [])

  const handleApplyChanges = useCallback(async () => {
    if (!editingLog) return

    // ── Time Validation ──────────────────────────────────────────────────
    const MAX_SHIFT_HOURS = 16

    // Determine the effective check-in and check-out for validation
    const effectiveCheckIn = editCheckIn || null
    const effectiveCheckOut = editCheckOut || null

    // Can't clear check-in (check-in is always required)
    if (!effectiveCheckIn) {
      showToast('error', 'Invalid Time', 'Check-in time is required.')
      return
    }

    // Can't set check-out without a check-in
    if (effectiveCheckOut && !effectiveCheckIn) {
      showToast('error', 'Invalid Time', 'Cannot set a check-out time without a check-in time.')
      return
    }

    // Build full Date objects for comparison using the record's date
    const checkInDate = new Date(`${editingLog.date}T${effectiveCheckIn}:00+08:00`)

    // Check-in can't be in the future
    const nowPHT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    if (checkInDate > nowPHT) {
      showToast('error', 'Invalid Time', 'Check-in time cannot be in the future.')
      return
    }

    if (effectiveCheckOut) {
      const checkOutDate = new Date(`${editingLog.date}T${effectiveCheckOut}:00+08:00`)

      // Check-out must be after check-in
      if (checkOutDate <= checkInDate) {
        showToast('error', 'Invalid Time', 'Check-out time must be later than check-in time.')
        return
      }

      // Maximum shift hours validation
      const diffHours = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60)
      if (diffHours > MAX_SHIFT_HOURS) {
        showToast('error', 'Invalid Time', `Total work hours cannot exceed ${MAX_SHIFT_HOURS} hours. Currently: ${diffHours.toFixed(1)} hours.`)
        return
      }
    }

    setActionLoading(true)
    try {
      const isAbsentRecord = String(editingLog.id).startsWith('absent-')
      
      const body: EditRequestBody = { 
        reason: editReason,
      }
      
      if (isAbsentRecord) {
        body.employeeId = editingLog.employeeId
        body.date = editingLog.date
      }
      
      if (editCheckIn) body.checkInTime = `${editingLog.date}T${editCheckIn}:00+08:00`
      if (editCheckOut) body.checkOutTime = `${editingLog.date}T${editCheckOut}:00+08:00`

      const endpoint = isAbsentRecord ? '/api/attendance/manual' : `/api/attendance/${editingLog.id}`
      const method = isAbsentRecord ? 'POST' : 'PUT'

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', role === 'admin' ? 'Record Updated' : 'Adjustment Submitted',
          role === 'admin' ? 'Attendance record successfully updated!' : 'Adjustment submitted for admin approval!')
        setEditingLog(null)
        fetchRecords()
      } else {
        showToast('error', 'Update Failed', data.message || 'Update failed')
      }
    } catch (e: unknown) {
      showToast('error', 'Network Error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setActionLoading(false)
    }
  }, [editingLog, editCheckIn, editCheckOut, editReason, role, showToast, fetchRecords])

  const exportToCSV = useCallback(() => {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const date = new Date(selectedDate + 'T00:00:00Z')
    const formattedDate = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
    const branchLabel = branchFilter === 'All Branches' ? 'All Branches' : branchFilter
    const deptLabel = deptFilter === 'All Departments' ? 'All Departments' : deptFilter

    const presentCount = records.filter(r => r.status === 'present').length
    const lateCount = records.filter(r => r.status === 'late').length
    const absentCount = records.filter(r => r.status === 'absent').length
    const incompleteCount = records.filter(r => r.status === 'incomplete' || r.displayStatus === 'missing_checkout').length

    const allRows: (string | number)[][] = []
    allRows.push(['BITS Attendance Report'])
    allRows.push(['Branch', branchLabel])
    allRows.push(['Department', deptLabel])
    allRows.push(['Date', formattedDate])
    allRows.push(['Generated', new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })])
    allRows.push([])
    allRows.push(['SUMMARY'])
    allRows.push(['Total Employees', records.length, '', 'Avg Hours', `${stats.avgHours}h`])
    allRows.push(['Present', presentCount, '', 'Overtime Total', `${stats.totalOT}h`])
    allRows.push(['Late', lateCount, '', 'Undertime Total', `${stats.totalUT}h`])
    allRows.push(['Absent', absentCount])
    allRows.push(['Missing Checkout', incompleteCount])
    allRows.push([])
    allRows.push(['#', 'Employee', 'Branch', 'Department', 'Shift', 'Check In', 'Check Out', 'Checkout Source', 'Hours Worked', 'Late By', 'Overtime', 'Undertime', 'Status'])

    sortedRecords.forEach((r, i) => {
      const statusLabel = r.isAnomaly ? 'Anomaly' : r.displayStatus === 'IN_PROGRESS' ? 'In Progress' : r.displayStatus === 'missing_checkout' ? 'Missing Checkout' : r.status.charAt(0).toUpperCase() + r.status.slice(1)
      const checkoutSourceLabel = r.checkoutSource === 'device' ? '' : r.checkoutSource === 'manual' ? 'Manual' : r.checkoutSource === 'auto_closed' ? 'Auto-Closed' : r.displayStatus === 'missing_checkout' ? 'Missing' : ''
      allRows.push([
        i + 1, r.employeeName, r.branchName, r.department, r.shiftCode || 'No Shift',
        r.checkIn,
        r.isShiftActive ? 'ACTIVE' : r.checkOut,
        r.isShiftActive ? '' : checkoutSourceLabel,
        r.isShiftActive ? 'LIVE' : (r.totalHours > 0 ? fmtHours(r.totalHours) : '—'),
        formatLate(r.lateMinutes),
        r.overtimeMinutes > 0 ? `+${fmtMins(r.overtimeMinutes)}` : '—',
        r.undertimeMinutes > 0 ? `-${fmtMins(r.undertimeMinutes)}` : '—',
        statusLabel
      ])
    })

    const fileName = `Attendance_${branchLabel.replace(/\s+/g, '_')}_${selectedDate}.xlsx`
    const worksheet = XLSX.utils.aoa_to_sheet(allRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance')
    XLSX.writeFile(workbook, fileName)

    // Fire-and-forget export log
    fetch('/api/logs/export-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        exportType: 'attendance',
        entityType: 'Attendance',
        source: role === 'admin' ? 'admin-panel' : 'hr-panel',
        details: `Exported attendance records (${records.length} rows) for ${selectedDate}`,
        filters: { branch: branchLabel, date: selectedDate, department: deptFilter !== 'All Departments' ? deptFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined },
        recordCount: records.length,
        fileFormat: 'xlsx',
        fileName,
      }),
    }).catch(() => {})
  }, [selectedDate, branchFilter, deptFilter, records, sortedRecords, stats, statusFilter, role])

  return {
    // Filter state
    selectedDate, setSelectedDate,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    branchFilter, setBranchFilter,
    deptFilter, setDeptFilter,
    // Refs
    dateInputRef, dragScrollRef,
    // Data
    records, loading, error, stats,
    branches, departments, statuses,
    // Sort
    sortedRecords, sortKeyStr, sortOrder, handleSort,
    // Pagination
    currentPage, setCurrentPage, totalPages,
    rowsPerPage: ROW_PER_PAGE,
    // Edit modal
    editingLog, setEditingLog,
    showCancelModal, setShowCancelModal,
    actionLoading,
    editCheckIn, setEditCheckIn,
    editCheckOut, setEditCheckOut,
    editReason, setEditReason,
    // Actions
    handleEditClick, handleApplyChanges, exportToCSV,
    // Toast
    toasts, dismissToast,
    getTodayDate,
  }
}
