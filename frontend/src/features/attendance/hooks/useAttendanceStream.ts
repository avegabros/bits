'use client'

import { useEffect, useRef, useCallback } from 'react'

export interface AttendanceStreamPayload {
    type: 'check-in' | 'check-out'
    record: {
        id: number
        employeeId: number
        date: string
        checkInTime: string
        checkOutTime: string | null
        status: string
        lateMinutes: number
        undertimeMinutes: number
        overtimeMinutes: number
        totalHours: number
        isAnomaly: boolean
        employee: {
            id: number
            firstName: string
            lastName: string
            departmentId: number | null
            Department?: { name: string } | null
            branchId: number | null
            Branch?: { name: string } | null
            Shift?: any
        }
    }
}

interface UseAttendanceStreamOptions {
    /**
     * Called each time the server pushes a new attendance record.
     * The callback must be stable (use useCallback in the parent) or
     * it will cause the hook to reconnect on every render.
     */
    onRecord: (payload: AttendanceStreamPayload) => void
    /**
     * Called when the SSE connection is established.
     * Use this to trigger an initial data fetch so the page is populated
     * before the first scan arrives.
     */
    onConnected?: () => void
    /**
     * Set to false to disable the stream (e.g. while the page is hidden).
     * Defaults to true.
     */
    enabled?: boolean
    /**
     * Custom endpoint URL for the SSE stream.
     * Defaults to '/api/attendance/stream'
     */
    endpoint?: string
}

/**
 * Subscribes to the /api/attendance/stream SSE endpoint and calls
 * `onRecord` each time a new attendance event is pushed by the server.
 *
 * Reconnect: The browser's native EventSource API auto-reconnects after
 * a dropped connection (~3 second default retry).
 *
 * Visibility pause: When the tab is hidden, the stream closes to avoid
 * accumulating a backlog. On return, onConnected() fires to re-fetch.
 */
export function useAttendanceStream({
    onRecord,
    onConnected,
    enabled = true,
    endpoint = '/api/attendance/stream'
}: UseAttendanceStreamOptions): void {
    const esRef = useRef<EventSource | null>(null)

    // ── Stable callback refs ────────────────────────────────────────────
    // Store the latest callbacks in refs so the EventSource connection
    // never tears down when the parent re-renders with new closures.
    const onRecordRef = useRef(onRecord)
    const onConnectedRef = useRef(onConnected)

    useEffect(() => {
        onRecordRef.current = onRecord
        onConnectedRef.current = onConnected
    }, [onRecord, onConnected])

    const connect = useCallback(() => {
        if (esRef.current) {
            esRef.current.close()
            esRef.current = null
        }

        const es = new EventSource(endpoint)
        esRef.current = es

        es.addEventListener('connected', () => {
            console.log(`[SSE] Attendance stream connected to ${endpoint}`)
            onConnectedRef.current?.()
        })

        es.addEventListener('attendance', (event: MessageEvent) => {
            try {
                const payload: AttendanceStreamPayload = JSON.parse(event.data)
                onRecordRef.current(payload)
            } catch (err) {
                console.error('[SSE] Failed to parse attendance event:', err)
            }
        })

        es.onerror = () => {
            // Browser EventSource auto-retries — just log for visibility.
            console.warn('[SSE] Attendance stream error — browser will retry')
        }
    }, [endpoint])

    useEffect(() => {
        if (!enabled) {
            esRef.current?.close()
            esRef.current = null
            return
        }

        connect()

        // ── Visibility-based pause ──────────────────────────────────────
        // Close when hidden, reconnect when visible (triggers onConnected →
        // re-fetch current state to fill any gap).
        const handleVisibilityChange = () => {
            if (document.hidden) {
                esRef.current?.close()
                esRef.current = null
            } else {
                connect()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            esRef.current?.close()
            esRef.current = null
        }
    }, [enabled, connect])
}
