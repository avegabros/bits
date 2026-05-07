import { useState, useEffect } from 'react'
import { employeeSelfApi } from '@/lib/api'
import { PortalShiftData } from '../utils/portal-types'

export function useEmployeeShift() {
  const [loading, setLoading] = useState(true)
  const [shift, setShift] = useState<PortalShiftData | null>(null)

  useEffect(() => {
    const loadShift = async () => {
      try {
        const res = await employeeSelfApi.getShift()
        if (res.success) {
          setShift(res.shift as PortalShiftData)
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
    }
    loadShift()
  }, [])

  return { loading, shift }
}
