import { useState, useEffect, useCallback } from 'react'
import { employeeSelfApi } from '@/lib/api'
import { useAttendanceStream, AttendanceStreamPayload } from '@/features/attendance/hooks/useAttendanceStream'
import { PortalAttendanceRecord } from '../utils/portal-types'

const phtStr = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

function getWeekDates(): { start: string, end: string } {
  const now = new Date()
  const todayIndex = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((todayIndex === 0 ? 7 : todayIndex) - 1))
  monday.setHours(0, 0, 0, 0)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  
  return {
    start: phtStr(monday),
    end: phtStr(sunday)
  }
}

export function useEmployeeDashboard() {
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [todayRecords, setTodayRecords] = useState<PortalAttendanceRecord[]>([])
  const [todayApprovedOts, setTodayApprovedOts] = useState<any[]>([])
  const [weeklyStats, setWeeklyStats] = useState({ present: 0, late: 0, totalHours: 0 })

  const loadData = useCallback(async () => {
    try {
      // Fetch User Profile First
      const profileRes = await employeeSelfApi.getProfile()
      if (profileRes.success && profileRes.profile) {
        setUserName(profileRes.profile.firstName)
      }

      // Fetch Today's Attendance
      const todayStr = phtStr(new Date())
      const attData = await employeeSelfApi.getAttendance(todayStr, todayStr)
      if (attData.success && attData.data) {
        setTodayRecords((attData.data as unknown as PortalAttendanceRecord[]) || [])
        setTodayApprovedOts((attData as any).approvedOts || [])
      }

      // Fetch Weekly Attendance
      const { start, end } = getWeekDates()
      const weekData = await employeeSelfApi.getAttendance(start, end)
      if (weekData.success) {
        const records: PortalAttendanceRecord[] = (weekData.data as unknown as PortalAttendanceRecord[]) || []
        
        let present = 0
        let late = 0
        let totalHrs = 0

        records.forEach(r => {
          if (r.checkInTime) {
            // Present = all days worked (on-time + late)
            present++;
            if (r.status.toLowerCase() === 'late') late++;

            // Use the backend-computed totalHours (break-aware) instead
            // of raw checkOut − checkIn which inflates hours.
            totalHrs += r.totalHours ?? 0
          }
        })

        setWeeklyStats({
          present,
          late,
          totalHours: Math.round(totalHrs * 10) / 10
        })
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
  }, [])

  // Handle SSE live records
  const handleStreamRecord = useCallback((payload: AttendanceStreamPayload) => {
    // Only update if the event is for today
    const todayStr = phtStr(new Date())
    const recDateStr = payload.record.date ? phtStr(new Date(payload.record.date)) : ''
    
    if (todayStr === recDateStr) {
      setTodayRecords(prev => {
        const existingIndex = prev.findIndex(r => r.id === payload.record.id)
        const updatedRecord = {
          ...payload.record,
          notes: existingIndex >= 0 ? prev[existingIndex].notes : null
        } as PortalAttendanceRecord
        
        if (existingIndex >= 0) {
          const newRecords = [...prev]
          newRecords[existingIndex] = updatedRecord
          return newRecords
        }
        return [updatedRecord, ...prev]
      })
    }
  }, [])

  useAttendanceStream({
    onRecord: handleStreamRecord,
    endpoint: '/api/me/attendance/stream'
  })

  useEffect(() => {
    loadData()
    // 30-second refresh fallback to sync weekly stats and metrics periodically
    const t = setInterval(loadData, 30_000)
    return () => clearInterval(t)
  }, [loadData])

  return { loading, userName, todayRecords, weeklyStats, todayApprovedOts }
}
