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
    Shift?: { shiftCode: string; isNightShift: boolean; startTime?: string; endTime?: string }
    profilePicture?: string | null
  }
  shift?: { id: number; name: string; shiftCode: string; isNightShift: boolean; startTime?: string; endTime?: string } | null
  shiftId?: number | null
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
  Company?: { id: number; name: string } | null
  Shift?: { shiftCode: string; isNightShift: boolean; startTime?: string; endTime?: string; workDays?: string }
  profilePicture?: string | null
}

interface EditRequestBody {
  reason: string
  employeeId?: number
  date?: string
  checkInTime?: string
  checkOutTime?: string
}

const ROW_PER_PAGE = 10

export function useAttendanceDashboard(role: 'admin' | 'hr' | 'manager') {
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
  const allDeptLabel = role === 'manager' ? 'All Assigned Departments' : 'All Departments'
  const [deptFilter, setDeptFilter] = useState(allDeptLabel)
  const [shiftFilter, setShiftFilter] = useState('All Shifts')

  // ── Data State ────────────────────────────────────────────────────────────
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branchesList, setBranchesList] = useState<{ id: number; name: string; companies?: { companyId: number; branchId: number; company: { id: number; name: string } }[] }[]>([])
  const [companiesList, setCompaniesList] = useState<{ id: number; name: string }[]>([])
  const [companyFilter, setCompanyFilter] = useState('All Companies')
  const [departmentsList, setDepartmentsList] = useState<{ id: number; name: string }[]>([])
  const [stats, setStats] = useState({ onTime: 0, late: 0, absent: 0, restDay: 0, incomplete: 0, total: 0, avgHours: '0', totalOT: '0', totalUT: '0' })
  const [availableShifts, setAvailableShifts] = useState<string[]>(['All Shifts'])

  // ── Holiday State (used for CSV export only) ──────────────────────────────
  const [isHolidayDate, setIsHolidayDate] = useState(false)

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
  const [deletingLog, setDeletingLog] = useState<AttendanceRecord | null>(null)
  const [deleteReason, setDeleteReason] = useState('')

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
  const companies = ['All Companies', ...companiesList.map(c => c.name)]
  const filteredBranchesList = companyFilter === 'All Companies'
    ? branchesList
    : branchesList.filter(b => b.companies?.some(link => link.company.name === companyFilter))
  const branches = ['All Branches', ...filteredBranchesList.map(b => b.name)]
  const departments = [allDeptLabel, ...departmentsList.map(d => d.name)]
  const statuses = [
    { value: 'all', label: 'All Status' },
    { value: 'present', label: 'On Time' },
    { value: 'late', label: 'Late' },
    { value: 'absent', label: 'Absent' },
    { value: 'rest_day', label: 'Rest Day' },
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
  useEffect(() => { setCurrentPage(1) }, [selectedDate, statusFilter, debouncedSearch, branchFilter, deptFilter, companyFilter, shiftFilter])

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
        const url = role === 'manager' ? '/api/me/departments' : '/api/departments'
        const res = await fetch(url, { credentials: 'include' })
        const data = await res.json()
        if (data.success && data.departments) setDepartmentsList(data.departments)
      } catch { /* ignore */ }
    }
    run()
  }, [role])

  // Fetch companies — on mount only
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/companies', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.companies) setCompaniesList(data.companies)
        }
      } catch { /* ignore */ }
    }
    run()
  }, [])

  // Reset branch filter when company changes
  useEffect(() => {
    setBranchFilter('All Branches')
  }, [companyFilter])

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
      // Check if the selected date is a holiday
      const [year] = selectedDate.split('-')
      let dateIsHoliday = false
      let dateHolidayName: string | null = null
      try {
        const holidayRes = await fetch(`/api/holidays?year=${year}`, { credentials: 'include', signal })
        if (holidayRes.ok) {
          const holidayData = await holidayRes.json()
          if (holidayData.success && holidayData.holidays) {
            const match = holidayData.holidays.find((h: { date: string; name: string }) =>
              new Date(h.date).toISOString().split('T')[0] === selectedDate
            )
            if (match) {
              dateIsHoliday = true
              dateHolidayName = match.name
            }
          }
        }
      } catch { /* ignore holiday fetch errors */ }
      setIsHolidayDate(dateIsHoliday)

      const params = new URLSearchParams({
        startDate: selectedDate,
        endDate: selectedDate,
        limit: '500',
      })
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const res = await fetch(`/api/attendance?${params}`, { 
        credentials: 'include', 
        signal,
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      })
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
          const shiftCode: string | null = log.shift?.shiftCode ?? log.shiftCode ?? emp?.Shift?.shiftCode ?? null
          const shiftId: number | null = log.shift?.id ?? log.shiftId ?? null
          const shiftName: string | null = log.shift?.name ?? null
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
            profilePicture: emp?.profilePicture,
            department: emp?.Department?.name || 'General',
            branchName: emp?.Branch?.name || '—',
            date: new Date(log.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
            checkIn: isPendingManualCreation ? '—' : (log.checkInTime ? checkIn.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'),
            checkOut: isPendingManualCreation ? '—' : (checkOut ? checkOut.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'),
            status: computedStatus, 
            displayStatus, lateMinutes, totalHours, overtimeMinutes, undertimeMinutes,
            shiftId,
            shiftCode,
            shiftName,
            shiftStartTime: log.shift?.startTime ?? emp?.Shift?.startTime,
            shiftEndTime: log.shift?.endTime ?? emp?.Shift?.endTime,
            isNightShift: log.shift?.isNightShift ?? emp?.Shift?.isNightShift ?? false,
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

        // Build employee → company lookup for company filtering on attendance records
        const companyByEmployeeId = new Map<number, string | null>()
        for (const e of allEmployees) {
          companyByEmployeeId.set(e.id, e.Company?.name ?? null)
        }

        // Stamp companyName onto each mapped attendance record
        for (const r of mapped) {
          (r as any).companyName = companyByEmployeeId.get(r.employeeId) ?? null
        }

        // Pending manual creations should NOT count as "present" for absent-row injection.
        // Records with UPDATE/DELETE adjustments (isPending + real status) still count as present.
        // Only brand-new unapproved creation placeholders (isPending + notes flag) are excluded.
        const isPendingManualCreation = (r: AttendanceRecord) =>
          r.isPending === true && (r.notes ?? '').includes('[Pending] Manual creation')
        const presentIds = new Set(mapped.filter(r => !isPendingManualCreation(r)).map(r => r.employeeId))
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
        const isFutureDate = selectedDate > todayStr

        // Helper: determine if the selected date is a working day for a given employee
        const selectedDayName = new Date(selectedDate + 'T00:00:00Z')
          .toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })

        const isWorkingDayForEmployee = (emp: RawEmployee): boolean => {
          if (emp.Shift?.workDays) {
            try {
              const wDays = typeof emp.Shift.workDays === 'string'
                ? JSON.parse(emp.Shift.workDays)
                : emp.Shift.workDays
              if (Array.isArray(wDays)) return wDays.includes(selectedDayName)
            } catch { /* fallback to default */ }
          }
          // Default: Mon-Fri are working days
          return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(selectedDayName)
        }

        const absentRows: AttendanceRecord[] = (dateIsHoliday || isFutureDate)
          ? [] // On holidays or future dates, no one is injected as absent
          : allEmployees
            .filter((e: RawEmployee) => !presentIds.has(e.id))
            .map((e: RawEmployee) => {
              const isWorking = isWorkingDayForEmployee(e)
              const rowStatus = isWorking ? 'absent' : 'rest_day'
              return {
                id: `absent-${e.id}`,
                employeeId: e.id,
                employeeName: `${e.firstName} ${e.lastName}`,
                profilePicture: e.profilePicture,
                department: e.Department?.name || 'General',
                branchName: e.Branch?.name || '—',
                companyName: e.Company?.name ?? null,
                date: selectedDate,
                checkIn: '—', checkOut: '—', status: rowStatus, displayStatus: rowStatus,
                lateMinutes: 0, totalHours: 0, overtimeMinutes: 0, undertimeMinutes: 0,
                shiftId: null,
                shiftCode: e.Shift?.shiftCode ?? null,
                shiftName: e.Shift?.name ?? null,
                shiftStartTime: e.Shift?.startTime,
                shiftEndTime: e.Shift?.endTime,
                isNightShift: e.Shift?.isNightShift ?? false,
                isAnomaly: false, isEarlyOut: false, isShiftActive: false, gracePeriodApplied: false,
                isEarlyPunch: false, isMissingCheckout: false,
              }
            })

        // All mapped records (including pending manual creations) go into the table so the PR badge
        // is visible — consistent with how UPDATE/DELETE adjustment records are displayed.
        let full = (statusFilter === 'all' || statusFilter === 'absent' || statusFilter === 'rest_day')
          ? [...mapped, ...absentRows]
          : [...mapped]

        // When filtering by 'absent' or 'rest_day', exclude the other type
        if (statusFilter === 'absent') full = full.filter(r => r.status !== 'rest_day')
        if (statusFilter === 'rest_day') full = full.filter(r => r.status !== 'absent' && r.status !== 'present' && r.status !== 'late' && r.status !== 'incomplete')

        // Apply client-side filters
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase()
          full = full.filter(r => r.employeeName.toLowerCase().includes(q) || (r.shiftCode ?? '').toLowerCase().includes(q) || (r.shiftName ?? '').toLowerCase().includes(q))
        }
        // Company filter: use direct companyName — null-company employees excluded from specific tabs
        if (companyFilter !== 'All Companies') {
          full = full.filter(r => (r as any).companyName === companyFilter)
        }
        if (branchFilter !== 'All Branches') full = full.filter(r => r.branchName === branchFilter)
        if (deptFilter !== allDeptLabel) full = full.filter(r => r.department === deptFilter)

        // Extract available shifts from the filtered (by department/branch/etc) list before applying shiftFilter
        const uniqueShifts = new Set<string>()
        const shiftStartTimes = new Map<string, string>()
        
        for (const r of full) {
          const shiftKey = r.shiftName ?? r.shiftCode ?? 'No Shift'
          uniqueShifts.add(shiftKey)
          if (!shiftStartTimes.has(shiftKey) && r.shiftStartTime) {
            shiftStartTimes.set(shiftKey, r.shiftStartTime)
          }
        }

        const sortedShifts = Array.from(uniqueShifts).sort((a, b) => {
          if (a === 'No Shift') return 1;
          if (b === 'No Shift') return -1;
          const timeA = shiftStartTimes.get(a) || '24:00';
          const timeB = shiftStartTimes.get(b) || '24:00';
          return timeA.localeCompare(timeB);
        });
        
        setAvailableShifts(['All Shifts', ...sortedShifts])

        if (shiftFilter !== 'All Shifts') full = full.filter(r => (r.shiftName ?? r.shiftCode ?? 'No Shift') === shiftFilter)

        // --- MERGE MULTIPLE SHIFTS FOR "ALL SHIFTS" VIEW ---
        if (shiftFilter === 'All Shifts') {
          const grouped = new Map<string, AttendanceRecord[]>()
          for (const r of full) {
            const key = `${r.employeeId}-${r.date}`
            if (!grouped.has(key)) grouped.set(key, [])
            grouped.get(key)!.push(r)
          }

          const mergedFull: AttendanceRecord[] = []
          for (const group of grouped.values()) {
            if (group.length === 1) {
              mergedFull.push(group[0])
            } else {
              const sortedGroup = [...group].sort((a, b) => {
                const timeA = a.shiftStartTime || '24:00';
                const timeB = b.shiftStartTime || '24:00';
                return timeA.localeCompare(timeB);
              });
              const primary = sortedGroup[0]
              mergedFull.push({
                ...primary,
                id: `merged-${primary.employeeId}-${primary.date}`,
                isMerged: true,
                subRecords: sortedGroup,
                status: 'Multiple',
                displayStatus: 'Multiple',
                shiftCode: sortedGroup.map(g => g.shiftCode).filter(Boolean).join(', '),
                totalHours: group.reduce((sum, r) => sum + r.totalHours, 0),
                lateMinutes: group.reduce((sum, r) => sum + r.lateMinutes, 0),
                overtimeMinutes: group.reduce((sum, r) => sum + r.overtimeMinutes, 0),
                undertimeMinutes: group.reduce((sum, r) => sum + r.undertimeMinutes, 0),
              })
            }
          }
          full = mergedFull
        }
        // ----------------------------------------------------

        setRecords(full)
        setTotalPages(Math.max(1, Math.ceil(full.length / ROW_PER_PAGE)))

        // Stats: exclude pending manual creation records — they are unapproved and must not
        // inflate or deflate any stat counter (present, late, absent, hours, etc.).
        const statsRecords = full.filter(r => !isPendingManualCreation(r))
        setStats({
          onTime: statsRecords.filter(r => r.status === 'present').length,
          late: statsRecords.filter(r => r.status === 'late').length,
          absent: statsRecords.filter(r => r.status === 'absent').length,
          restDay: statsRecords.filter(r => r.status === 'rest_day').length,
          incomplete: statsRecords.filter(r => r.status === 'incomplete' || r.displayStatus === 'missing_checkout').length,
          total: statsRecords.length,
          avgHours: statsRecords.length > 0
            ? (statsRecords.filter(r => r.totalHours > 0).reduce((s, r) => s + r.totalHours, 0) /
              (statsRecords.filter(r => r.totalHours > 0).length || 1)).toFixed(1) : '0',
          totalOT: (statsRecords.reduce((s, r) => s + (r.overtimeMinutes ?? 0), 0) / 60).toFixed(1),
          totalUT: (statsRecords.reduce((s, r) => s + (r.undertimeMinutes ?? 0), 0) / 60).toFixed(1),
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
  }, [selectedDate, statusFilter, debouncedSearch, branchFilter, deptFilter, companyFilter, shiftFilter, branchesList])

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

  const handleApplyChanges = useCallback(async (multiEdits?: any[]) => {
    if (!editingLog) return

    const editsToProcess = editingLog.isMerged && multiEdits ? multiEdits : [{
      id: editingLog.id,
      checkIn: editCheckIn,
      checkOut: editCheckOut,
      reason: editReason,
      isPending: editingLog.isPending,
      isAbsent: String(editingLog.id).startsWith('absent-'),
      employeeId: editingLog.employeeId,
      date: editingLog.date,
      isNightShift: editingLog.isNightShift,
      shiftName: editingLog.shiftName,
      shiftCode: editingLog.shiftCode
    }]

    // ── Time Validation ──────────────────────────────────────────────────
    const MAX_SHIFT_HOURS = 16

    for (const edit of editsToProcess) {
      if (edit.isPending) {
        showToast('warning', 'Pending Request Exists', 'One or more records already have a pending adjustment. Cancel it first or wait for admin review.')
        return
      }

      if (!edit.reason?.trim()) {
        showToast('error', 'Reason Required', `Please provide a reason for the ${edit.shiftName || edit.shiftCode || ''} adjustment.`)
        return
      }

      const effectiveCheckIn = edit.checkIn || null
      const effectiveCheckOut = edit.checkOut || null

      if (!effectiveCheckIn) {
        showToast('error', 'Invalid Time', `Check-in time is required for ${edit.shiftName || edit.shiftCode || 'the shift'}.`)
        return
      }

      if (effectiveCheckOut && !effectiveCheckIn) {
        showToast('error', 'Invalid Time', 'Cannot set a check-out time without a check-in time.')
        return
      }

      const checkInDate = new Date(`${edit.date}T${effectiveCheckIn}:00+08:00`)

      if (effectiveCheckOut) {
        let checkOutDate = new Date(`${edit.date}T${effectiveCheckOut}:00+08:00`)

        if (checkOutDate <= checkInDate) {
          checkOutDate = new Date(checkOutDate.getTime() + 24 * 60 * 60 * 1000)
        }

        if (checkOutDate <= checkInDate) {
          showToast('error', 'Invalid Time', `Check-out time must be later than check-in time for ${edit.shiftName || edit.shiftCode || 'the shift'}.`)
          return
        }

        const diffHours = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60)
        if (diffHours > MAX_SHIFT_HOURS) {
          showToast('error', 'Invalid Time', `Total work hours cannot exceed ${MAX_SHIFT_HOURS} hours for ${edit.shiftName || edit.shiftCode || 'the shift'}.`)
          return
        }
      }
    }

    setActionLoading(true)

    // Fetch exact server time to prevent client-side clock tampering/drift bypassing future checks
    let serverNow = new Date()
    let serverTodayPHT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
    try {
      const timeRes = await fetch('/api/time/now', { credentials: 'include' })
      if (timeRes.ok) {
        const timeData = await timeRes.json()
        if (timeData.success && timeData.data?.utc) {
          serverNow = new Date(timeData.data.utc)
          serverTodayPHT = serverNow.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
        }
      }
    } catch {
      // Fallback to client clock if server time fetch fails
    }

    for (const edit of editsToProcess) {
      const effectiveCheckIn = edit.checkIn || null
      const checkInDate = new Date(`${edit.date}T${effectiveCheckIn}:00+08:00`)
      if (edit.isNightShift) {
        if (edit.date > serverTodayPHT) {
          setActionLoading(false)
          showToast('error', 'Invalid Date', 'Cannot set check-in for a future date.')
          return
        }
      } else {
        if (checkInDate > serverNow) {
          setActionLoading(false)
          showToast('error', 'Invalid Time', 'Check-in time cannot be in the future.')
          return
        }
      }
    }

    try {
      const promises = editsToProcess.map(async (edit) => {
        const body: any = { 
          reason: edit.reason,
          roleContext: role
        }

        if (edit.isAbsent) {
          body.employeeId = edit.employeeId
          body.date = edit.date
        }

        if (edit.checkIn) body.checkInTime = `${edit.date}T${edit.checkIn}:00+08:00`
        if (edit.checkOut) {
          let checkOutDateStr = edit.date
          if (edit.checkIn && edit.checkOut < edit.checkIn) {
            const nextDay = new Date(`${edit.date}T00:00:00+08:00`)
            nextDay.setDate(nextDay.getDate() + 1)
            checkOutDateStr = nextDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
          }
          body.checkOutTime = `${checkOutDateStr}T${edit.checkOut}:00+08:00`
        } else {
          body.checkOutTime = null
        }

        const endpoint = edit.isAbsent ? '/api/attendance/manual' : `/api/attendance/${edit.id}`
        const method = edit.isAbsent ? 'POST' : 'PUT'

        const res = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!data.success) {
          throw new Error(data.message || `Failed to update ${edit.shiftName || edit.shiftCode || 'record'}`)
        }
        return data
      })

      await Promise.all(promises)

      showToast('success', role === 'admin' ? 'Records Updated' : 'Adjustments Submitted',
        role === 'admin' ? 'Attendance records successfully updated!' : 'Adjustments submitted for admin approval!')
      setEditingLog(null)
      fetchRecords()
    } catch (e: unknown) {
      showToast('error', 'Update Failed', e instanceof Error ? e.message : 'Network error')
    } finally {
      setActionLoading(false)
    }
  }, [editingLog, editCheckIn, editCheckOut, editReason, role, showToast, fetchRecords])

  const handleDeleteClick = useCallback((row: AttendanceRecord) => {
    setDeletingLog(row)
    setDeleteReason('')
  }, [])

  const handleDeleteSubmit = useCallback(async () => {
    if (!deletingLog) return

    if (deletingLog.isPending) {
      showToast('warning', 'Pending Request Exists', 'This record already has a pending adjustment. Cancel it first or wait for admin review.')
      return
    }

    if (!deleteReason.trim()) {
      showToast('error', 'Reason Required', 'Please provide a reason for deleting this record.')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/attendance/${deletingLog.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: deleteReason }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', role === 'admin' ? 'Record Deleted' : 'Deletion Requested',
          role === 'admin' ? 'Attendance record successfully deleted!' : 'Deletion request submitted for admin approval!')
        setDeletingLog(null)
        fetchRecords()
      } else {
        showToast('error', 'Delete Failed', data.message || 'Delete failed')
      }
    } catch (e: unknown) {
      showToast('error', 'Network Error', e instanceof Error ? e.message : 'Network error')
    } finally {
      setActionLoading(false)
    }
  }, [deletingLog, deleteReason, role, showToast, fetchRecords])

  const exportToCSV = useCallback(() => {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const date = new Date(selectedDate + 'T00:00:00Z')
    const formattedDate = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
    const branchLabel = branchFilter === 'All Branches' ? 'All Branches' : branchFilter
    const deptLabel = deptFilter === allDeptLabel ? allDeptLabel : deptFilter

    const presentCount = records.filter(r => r.status === 'present').length
    const lateCount = records.filter(r => r.status === 'late').length
    const absentCount = records.filter(r => r.status === 'absent').length
    const incompleteCount = records.filter(r => r.status === 'incomplete' || r.displayStatus === 'missing_checkout').length

    const allRows: (string | number)[][] = []
    allRows.push(['BITS Attendance Report'])
    allRows.push(['Branch', branchLabel])
    allRows.push(['Department', deptLabel])
    allRows.push(['Date', formattedDate])
    if (isHolidayDate) allRows.push(['⚠️ This date is a Holiday'])
    allRows.push(['Generated', new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })])
    allRows.push([])
    allRows.push(['SUMMARY'])
    allRows.push(['Total Employees', records.length, '', 'Avg Hours', `${stats.avgHours}h`])
    allRows.push(['Present', presentCount, '', 'Overtime Total', `${stats.totalOT}h`])
    allRows.push(['Late', lateCount, '', 'Undertime Total', `${stats.totalUT}h`])
    allRows.push(['Absent', absentCount])
    if (isHolidayDate) allRows.push(['Note', '⚠️ This is a holiday — absent tracking is suspended for this date'])
    allRows.push(['Missing Checkout', incompleteCount])
    allRows.push([])
    allRows.push(['#', 'Employee', 'Branch', 'Department', 'Shift', 'Check In', 'Check Out', 'Checkout Source', 'Hours Worked', 'Late By', 'Overtime', 'Undertime', 'Status'])

    sortedRecords.forEach((r, i) => {
      const statusLabel = r.isAnomaly ? 'Anomaly' : r.displayStatus === 'IN_PROGRESS' ? 'In Progress' : r.displayStatus === 'missing_checkout' ? 'Missing Checkout' : (isHolidayDate && r.status === 'absent') ? 'Holiday' : r.status === 'rest_day' ? 'Rest Day' : r.status.charAt(0).toUpperCase() + r.status.slice(1)
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
      cache: 'no-store',
      body: JSON.stringify({
        exportType: 'attendance',
        entityType: 'Attendance',
        source: role === 'admin' ? 'admin-panel' : 'hr-panel',
        details: `Exported attendance records (${records.length} rows) for ${selectedDate}`,
        filters: { branch: branchLabel, date: selectedDate, department: deptFilter !== allDeptLabel ? deptFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined },
        recordCount: records.length,
        fileFormat: 'xlsx',
        fileName,
      }),
    }).catch(() => { })
  }, [selectedDate, branchFilter, deptFilter, records, sortedRecords, stats, statusFilter, role])

  // ── Return ───────────────────────────────────────────────────────────────

  return {
    // Filter state
    selectedDate, setSelectedDate,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    branchFilter, setBranchFilter,
    deptFilter, setDeptFilter,
    companyFilter, setCompanyFilter,
    shiftFilter, setShiftFilter,
    // Refs
    dateInputRef, dragScrollRef,
    // Data
    records, loading, error, stats,
    companies, branches, departments, statuses, shifts: availableShifts,
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
    deletingLog, setDeletingLog,
    deleteReason, setDeleteReason,
    // Actions
    handleEditClick, handleApplyChanges, handleDeleteClick, handleDeleteSubmit, exportToCSV,
    // Toast
    toasts, dismissToast,
    getTodayDate,
  }
}
