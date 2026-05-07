import { useState, useEffect, useCallback } from 'react'
import { employeeSelfApi } from '@/lib/api'
import { PortalAttendanceRecord } from '../utils/portal-types'

const phtStr = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

export function useEmployeeAttendance() {
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<PortalAttendanceRecord[]>([])
  
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  
  const [startDate, setStartDate] = useState(phtStr(firstDay))
  const [endDate, setEndDate] = useState(phtStr(lastDay))

  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await employeeSelfApi.getAttendance(startDate, endDate)
      if (res.success) {
        setRecords((res.data as unknown as PortalAttendanceRecord[]) || [])
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err.message)
      } else {
        console.error('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const handleApplyFilter = () => {
    setCurrentPage(1)
    fetchRecords()
  }

  const paginatedRecords = records.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  return {
    loading,
    records,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    handleApplyFilter,
    paginatedRecords
  }
}
