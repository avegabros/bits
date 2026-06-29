'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll'
import { useToast } from '@/hooks/useToast'
import { useTableSort } from '@/hooks/useTableSort'
import { useAttendanceStream, AttendanceStreamPayload } from '@/features/attendance/hooks/useAttendanceStream'
import { fmtHours, formatLate, fmtMins, toTimeInput } from '@/features/attendance/utils/attendance-formatters'
import { AttendanceRecord, AttendanceConflict } from '@/features/attendance/types'
import { processAttendanceData } from '@/features/attendance/utils/attendance-logic'
import * as XLSX from 'xlsx'

interface RawAttendanceLog {
  employee?: {
    role?: string
    firstName: string
    middleName?: string
    lastName: string
    suffix?: string
    Department?: { name: string }
    Section?: { name: string }
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
  approvedOts?: any[]
}

interface RawEmployee {
  id: number
  role: string
  employmentStatus: string
  firstName: string
  lastName: string
  branchId?: number | null
  Department?: { name: string }
  Section?: { name: string }
  Branch?: { name: string }
  Company?: { id: number; name: string } | null
  Shift?: { name?: string; shiftCode: string; isNightShift: boolean; startTime?: string; endTime?: string; workDays?: string }
  EmployeeShift?: { shift: { id: number; name: string; shiftCode: string; isNightShift: boolean; startTime?: string; endTime?: string; workDays?: string } }[]
  profilePicture?: string | null
  hireDate?: string
}

interface EditRequestBody {
  reason: string
  employeeId?: number
  date?: string
  checkInTime?: string
  checkOutTime?: string
}

interface RawHoliday {
  id: number
  date: string
  name: string
  branches?: { branchId: number }[]
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
  const [sectionFilter, setSectionFilter] = useState('All Sections')
  const [shiftFilter, setShiftFilter] = useState('All Shifts')

  // ── Data State ────────────────────────────────────────────────────────────
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branchesList, setBranchesList] = useState<{ id: number; name: string; companies?: { companyId: number; branchId: number; company: { id: number; name: string } }[] }[]>([])
  const [companiesList, setCompaniesList] = useState<{ id: number; name: string }[]>([])
  const [companyFilter, setCompanyFilter] = useState('All Companies')
  const [departmentsList, setDepartmentsList] = useState<{ id: number; name: string }[]>([])
  const [sectionsList, setSectionsList] = useState<{ id: number; name: string; departments?: { departmentId: number }[] }[]>([])
  const [stats, setStats] = useState({ onTime: 0, late: 0, absent: 0, restDay: 0, incomplete: 0, total: 0, avgHours: '0', totalOT: '0', totalUT: '0' })
  const [availableShifts, setAvailableShifts] = useState<string[]>(['All Shifts'])

  // ── Holiday State (used for CSV export only) ──────────────────────────────
  const [isHolidayDate, setIsHolidayDate] = useState(false)

  // ── Pagination ────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // ── Edit Modal State ──────────────────────────────────────────────────────
  const [editingLog, setEditingLog] = useState<AttendanceRecord | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [editCheckIn, setEditCheckIn] = useState('')
  const [editCheckOut, setEditCheckOut] = useState('')
  const [editReason, setEditReason] = useState('')
  const [deletingLog, setDeletingLog] = useState<AttendanceRecord | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [conflictErrors, setConflictErrors] = useState<AttendanceConflict[]>([])

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

  const filteredSectionsList = useMemo(() => {
    if (deptFilter === allDeptLabel) return sectionsList;
    const dept = departmentsList.find(d => d.name === deptFilter);
    if (!dept) return [];
    return sectionsList.filter(s => s.departments?.some(d => d.departmentId === dept.id));
  }, [sectionsList, departmentsList, deptFilter, allDeptLabel]);

  const sections = ['All Sections', ...filteredSectionsList.map(s => s.name)]
  const statuses = [
    { value: 'all', label: 'All Status' },
    { value: 'present', label: 'On Time' },
    { value: 'late', label: 'Late' },
    { value: 'undertime', label: 'Undertime' },
    { value: 'overtime', label: 'Overtime' },
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
      setStatusFilter(
        s === 'present' ? 'present'
        : s === 'late' ? 'late'
        : s === 'absent' ? 'absent'
        : s === 'undertime' ? 'undertime'
        : s === 'overtime' ? 'overtime'
        : s === 'incomplete' ? 'incomplete'
        : s === 'rest_day' ? 'rest_day'
        : 'all'
      )
    }
  }, [searchParams])

  // Debounce search — 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  // ⚠️ FILTER RESET: page resets to 1 on any filter or date change
  useEffect(() => { setCurrentPage(1) }, [selectedDate, statusFilter, debouncedSearch, branchFilter, deptFilter, sectionFilter, companyFilter, shiftFilter])

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

  // Fetch sections — on mount only
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/sections', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.sections) setSectionsList(data.sections)
        }
      } catch { /* ignore */ }
    }
    run()
  }, [])

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

  // Reset section filter when department changes
  useEffect(() => {
    setSectionFilter('All Sections')
  }, [deptFilter])

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
      let matchedHoliday: RawHoliday | null = null
      try {
        const holidayRes = await fetch(`/api/holidays?year=${year}`, { credentials: 'include', signal })
        if (holidayRes.ok) {
          const holidayData = await holidayRes.json()
          if (holidayData.success && holidayData.holidays) {
            const match = holidayData.holidays.find((h: RawHoliday) =>
              new Date(h.date).toISOString().split('T')[0] === selectedDate
            )
            if (match) {
              dateIsHoliday = true
              dateHolidayName = match.name
              matchedHoliday = match
            }
          }
        }
      } catch { /* ignore holiday fetch errors */ }

      setIsHolidayDate(dateIsHoliday)

      // Always fetch all records for the selected date to compute correct absent rows
      const params = new URLSearchParams({
        startDate: selectedDate,
        endDate: selectedDate,
        limit: '10000',
      })

      const res = await fetch(`/api/attendance?${params}`, { 
        credentials: 'include', 
        signal,
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      })
      if (res.status === 401) { window.location.href = '/login'; return }

      const data = await res.json()
      if (data.success) {
        // Fetch all active employees to inject absent rows
        let allEmployees: RawEmployee[] = []
        try {
          const empRes = await fetch('/api/employees?limit=9999', { credentials: 'include', signal })
          const empData = await empRes.json()
          if (empData.success) allEmployees = (empData.employees || empData.data || []).filter((e: RawEmployee) =>
            (e.role === 'USER' || !e.role) && (e.employmentStatus === 'ACTIVE' || !e.employmentStatus)
          )
        } catch { /* ignore */ }

        // Filter out manager or admin logs (only keep USER logs)
        const userRecords = data.data.filter((log: RawAttendanceLog) => {
          const emp = log.employee
          return !emp || emp.role === 'USER' || !emp.role
        })

        // Call the unified data processing utility
        const { records: processedRecords } = processAttendanceData(
          userRecords,
          allEmployees,
          selectedDate,
          matchedHoliday ? [matchedHoliday] : []
        )

        // Apply client-side filters (except status and shift for overall stats)
        let filtered = processedRecords;

        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase()
          filtered = filtered.filter(r => r.employeeName.toLowerCase().includes(q) || (r.shiftCode ?? '').toLowerCase().includes(q) || (r.shiftName ?? '').toLowerCase().includes(q))
        }

        if (companyFilter !== 'All Companies') {
          filtered = filtered.filter(r => (r as any).companyName === companyFilter)
        }
        if (branchFilter !== 'All Branches') filtered = filtered.filter(r => r.branchName === branchFilter)
        if (deptFilter !== allDeptLabel) filtered = filtered.filter(r => r.department === deptFilter)
        if (sectionFilter !== 'All Sections') filtered = filtered.filter(r => r.sectionName === sectionFilter)

        // --- Calculate Stats on the filtered subset (before status and shift filters) ---
        const statsRecords = filtered.filter(r => r.isPending !== true || !(r.notes ?? '').includes('[Pending] Manual creation'))
        const empGroups = new Map<number, typeof statsRecords>()
        statsRecords.forEach(r => {
          const list = empGroups.get(r.employeeId) || []
          list.push(r)
          empGroups.set(r.employeeId, list)
        })

        let onTime = 0
        let late = 0
        let absent = 0
        let restDay = 0
        let incomplete = 0

        empGroups.forEach((recs) => {
          const checkedIn = recs.filter(r => r.status !== 'absent' && r.status !== 'rest_day')
          if (checkedIn.length > 0) {
            const hasLate = checkedIn.some(r => r.lateMinutes > 0)
            if (hasLate) {
              late++
            } else {
              onTime++
            }
            if (checkedIn.some(r => r.status === 'incomplete' || r.displayStatus === 'missing_checkout')) {
              incomplete++
            }
          } else {
            const isWorking = recs.some(r => r.status === 'absent')
            if (isWorking) {
              absent++
            } else {
              restDay++
            }
          }
        })

        const total = onTime + late + absent + restDay
        const avgHours = statsRecords.length > 0
          ? (statsRecords.filter(r => r.totalHours > 0).reduce((s, r) => s + r.totalHours, 0) /
            (statsRecords.filter(r => r.totalHours > 0).length || 1)).toFixed(1) : '0'
        const totalOT = (statsRecords.reduce((s, r) => s + (r.overtimeMinutes ?? 0), 0) / 60).toFixed(1)
        const totalUT = (statsRecords.reduce((s, r) => s + (r.undertimeMinutes ?? 0), 0) / 60).toFixed(1)

        setStats({ onTime, late, absent, restDay, incomplete, total, avgHours, totalOT, totalUT })

        // Extract available shifts from the filtered list (before shiftFilter is applied)
        const uniqueShifts = new Set<string>()
        const shiftStartTimes = new Map<string, string>()
        
        for (const r of filtered) {
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

        // Apply client-side shift filter
        let full = filtered
        if (shiftFilter !== 'All Shifts') {
          full = full.filter(r => (r.shiftName ?? r.shiftCode ?? 'No Shift') === shiftFilter)
        }

        // Apply client-side status filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'present') {
            full = full.filter(r => r.status !== 'absent' && r.status !== 'rest_day' && r.status !== 'holiday' && r.lateMinutes === 0)
          } else if (statusFilter === 'late') {
            full = full.filter(r => r.status !== 'absent' && r.status !== 'rest_day' && r.status !== 'holiday' && r.lateMinutes > 0)
          } else if (statusFilter === 'undertime') {
            full = full.filter(r => r.undertimeMinutes > 0)
          } else if (statusFilter === 'overtime') {
            full = full.filter(r => r.overtimeMinutes > 0)
          } else if (statusFilter === 'absent') {
            full = full.filter(r => r.status === 'absent')
          } else if (statusFilter === 'incomplete') {
            full = full.filter(r => r.status === 'incomplete' || r.displayStatus === 'missing_checkout')
          } else if (statusFilter === 'rest_day') {
            full = full.filter(r => r.status === 'rest_day')
          }
        }

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
              
              const hasLate = sortedGroup.some(g => g.status === 'late')
              mergedFull.push({
                ...primary,
                id: `merged-${primary.employeeId}-${primary.date}`,
                isMerged: true,
                subRecords: sortedGroup,
                status: hasLate ? 'late' : 'present',
                displayStatus: hasLate ? 'late' : 'present',
                shiftCode: sortedGroup.map(g => g.shiftCode).filter(Boolean).join(', '),
                totalHours: group.reduce((sum, r) => sum + r.totalHours, 0),
                lateMinutes: group.reduce((sum, r) => sum + r.lateMinutes, 0),
                overtimeMinutes: group.reduce((sum, r) => sum + r.overtimeMinutes, 0),
                undertimeMinutes: group.reduce((sum, r) => sum + r.undertimeMinutes, 0),
                approvedOts: group.find(r => r.approvedOts && r.approvedOts.length > 0)?.approvedOts || [],
              })
            }
          }
          full = mergedFull
        }

        setRecords(full)
        setTotalPages(Math.max(1, Math.ceil(full.length / ROW_PER_PAGE)))
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
  }, [selectedDate, statusFilter, debouncedSearch, branchFilter, deptFilter, sectionFilter, companyFilter, shiftFilter, branchesList, sectionsList])

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
    setConflictErrors([])
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

        if (res.status === 409 && data.conflicts) {
          setConflictErrors(data.conflicts)
          throw new Error(data.message || 'Attendance conflict detected')
        }

        if (!data.success) {
          throw new Error(data.message || `Failed to update ${edit.shiftName || edit.shiftCode || 'record'}`)
        }
        return data
      })

      await Promise.all(promises)

      showToast('success', role === 'admin' ? 'Records Updated' : 'Adjustments Submitted',
        role === 'admin' ? 'Attendance records successfully updated!' : 'Adjustments submitted for admin approval!')
      setConflictErrors([])
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
    const sectionLabel = sectionFilter === 'All Sections' ? 'All Sections' : sectionFilter

    const presentCount = records.filter(r => r.status === 'present' || r.status === 'IN_PROGRESS').length
    const lateCount = records.filter(r => r.status === 'late').length
    const absentCount = records.filter(r => r.status === 'absent').length
    const incompleteCount = records.filter(r => r.status === 'incomplete' || r.displayStatus === 'missing_checkout').length

    const allRows: (string | number)[][] = []
    allRows.push(['BITS Attendance Report'])
    allRows.push(['Branch', branchLabel])
    allRows.push(['Department', deptLabel])
    allRows.push(['Section', sectionLabel])
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
    allRows.push(['#', 'Employee', 'Branch', 'Department', 'Section', 'Shift', 'Check In', 'Check Out', 'Checkout Source', 'Hours Worked', 'Late By', 'Overtime', 'Undertime', 'Status'])

    sortedRecords.forEach((r, i) => {
      const statusLabel = r.isAnomaly ? 'Anomaly' : r.displayStatus === 'IN_PROGRESS' ? 'In Progress' : r.displayStatus === 'missing_checkout' ? 'Missing Checkout' : (isHolidayDate && r.status === 'absent') ? 'Holiday' : r.status === 'rest_day' ? 'Rest Day' : r.status.charAt(0).toUpperCase() + r.status.slice(1)
      const checkoutSourceLabel = r.checkoutSource === 'device' ? '' : r.checkoutSource === 'manual' ? 'Manual' : r.checkoutSource === 'auto_closed' ? 'Auto-Closed' : r.displayStatus === 'missing_checkout' ? 'Missing' : ''
      allRows.push([
        i + 1, r.employeeName, r.branchName, r.department, r.sectionName || '', r.shiftCode || r.shiftName || (r.approvedOts && r.approvedOts.length > 0 ? 'OT Approved' : 'No Shift'),
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
        filters: { branch: branchLabel, date: selectedDate, department: deptFilter !== allDeptLabel ? deptFilter : undefined, section: sectionFilter !== 'All Sections' ? sectionFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined },
        recordCount: records.length,
        fileFormat: 'xlsx',
        fileName,
      }),
    }).catch(() => { })
  }, [selectedDate, branchFilter, deptFilter, sectionFilter, records, sortedRecords, stats, statusFilter, role])

  // ── Return ───────────────────────────────────────────────────────────────

  return {
    // Filter state
    selectedDate, setSelectedDate,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    branchFilter, setBranchFilter,
    deptFilter, setDeptFilter,
    sectionFilter, setSectionFilter,
    companyFilter, setCompanyFilter,
    shiftFilter, setShiftFilter,
    // Refs
    dateInputRef, dragScrollRef,
    // Data
    records, loading, error, stats,
    companies, branches, departments, sections, statuses, shifts: availableShifts,
    // Sort
    sortedRecords, sortKeyStr, sortOrder, handleSort,
    // Pagination
    currentPage, setCurrentPage, totalPages,
    rowsPerPage: ROW_PER_PAGE,
    // Edit modal
    editingLog, setEditingLog,
    actionLoading,
    editCheckIn, setEditCheckIn,
    editCheckOut, setEditCheckOut,
    editReason, setEditReason,
    deletingLog, setDeletingLog,
    deleteReason, setDeleteReason,
    conflictErrors,
    // Actions
    handleEditClick, handleApplyChanges, handleDeleteClick, handleDeleteSubmit, exportToCSV,
    // Toast
    toasts, dismissToast,
    getTodayDate,
  }
}
