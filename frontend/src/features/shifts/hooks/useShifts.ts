'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import type { Shift, ShiftFormData } from '../types'
import { emptyForm } from '../types'
import { toMinutes } from '../utils/shift-formatters'

export function useShifts() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [form, setForm] = useState<ShiftFormData>({ ...emptyForm })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  const { toasts, showToast, dismissToast } = useToast()

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch('/api/shifts', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setShifts(data.shifts)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  const filtered = shifts.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.shiftCode.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = filterActive === 'all' ? true : filterActive === 'active' ? s.isActive : !s.isActive
    return matchSearch && matchStatus
  })

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1) }, [searchTerm, filterActive])

  const activeCount = shifts.filter(s => s.isActive).length

  // Break validation helper
  const hasInvalidBreaks = form.breaks.some(b => {
    if (!b.start || !b.end) return false
    if (toMinutes(b.end) <= toMinutes(b.start)) return true
    if (form.startTime && form.endTime) {
      const shiftStartMins = toMinutes(form.startTime)
      const shiftEndMins = toMinutes(form.endTime)
      const breakStartMins = toMinutes(b.start)
      const breakEndMins = toMinutes(b.end)
      const isOvernight = shiftEndMins <= shiftStartMins
      if (isOvernight) {
        const validStart = breakStartMins >= shiftStartMins || breakStartMins < shiftEndMins
        const validEnd = breakEndMins > shiftStartMins || breakEndMins <= shiftEndMins
        if (!validStart || !validEnd) return true
      } else {
        if (breakStartMins < shiftStartMins || breakEndMins > shiftEndMins) return true
      }
    }
    return false
  })

  const openCreate = () => {
    setEditingShift(null)
    setForm({ ...emptyForm })
    setFormError('')
    setIsFormOpen(true)
  }

  const openEdit = (s: Shift) => {
    setEditingShift(s)
    let parsedDays: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    try { parsedDays = JSON.parse(s.workDays || '[]') } catch { }
    let parsedHalfDays: string[] = []
    try { parsedHalfDays = JSON.parse(s.halfDays || '[]') } catch { }
    let parsedBreaks: any[] = []
    try { parsedBreaks = JSON.parse(s.breaks || '[]') } catch { }
    setForm({
      shiftCode: s.shiftCode,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      graceMinutes: s.graceMinutes,
      breakMinutes: s.breakMinutes,
      isNightShift: s.isNightShift,
      description: s.description || '',
      workDays: parsedDays,
      halfDays: parsedHalfDays,
      halfDayHours: s.halfDayHours ?? null,
      breaks: parsedBreaks,
    })
    setFormError('')
    setIsFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.shiftCode.trim() || !form.name.trim() || !form.startTime || !form.endTime) {
      setFormError('Shift Code, Name, Start Time, and End Time are required.')
      return
    }
    if (hasInvalidBreaks) {
      setFormError('Please fix invalid break time ranges before saving.')
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      const url = editingShift ? `/api/shifts/${editingShift.id}` : '/api/shifts'
      const method = editingShift ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!data.success) { setFormError(data.message || 'An error occurred'); return }
      showToast('success', editingShift ? 'Shift Updated' : 'Shift Created', editingShift ? 'Shift updated successfully!' : 'Shift created successfully!')
      setIsFormOpen(false)
      fetchShifts()
    } catch { setFormError('Failed to save shift. Please try again.') }
    finally { setFormLoading(false) }
  }

  const handleToggle = async (s: Shift) => {
    try {
      const res = await fetch(`/api/shifts/${s.id}/toggle`, {
        method: 'PATCH', credentials: 'include'
      })
      const data = await res.json()
      if (data.success) { showToast('success', 'Shift Toggled', data.message); fetchShifts() }
    } catch { showToast('error', 'Toggle Failed', 'Failed to toggle shift') }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/shifts/${deleteTarget.id}`, {
        method: 'DELETE', credentials: 'include'
      })
      const data = await res.json()
      if (data.success) { showToast('success', 'Shift Deleted', 'Shift deleted'); setDeleteTarget(null); fetchShifts() }
      else showToast('error', 'Delete Failed', data.message || 'Delete failed')
    } catch { showToast('error', 'Delete Failed', 'Failed to delete shift') }
    finally { setDeleteLoading(false) }
  }

  return {
    shifts, loading, searchTerm, setSearchTerm,
    filterActive, setFilterActive,
    filtered, activeCount,
    // Modal
    isFormOpen, setIsFormOpen, editingShift,
    form, setForm, formLoading, formError, setFormError,
    hasInvalidBreaks,
    // Delete
    deleteTarget, setDeleteTarget, deleteLoading,
    // Pagination
    currentPage, setCurrentPage, rowsPerPage,
    // Actions
    openCreate, openEdit, handleSubmit, handleToggle, handleDelete,
    // Toast
    toasts, showToast, dismissToast,
  }
}
