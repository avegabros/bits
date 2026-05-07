import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogEntry, LogMeta, CategoryKey, LevelKey } from '../utils/log-types'

const phtStr = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

interface UseSystemLogsProps {
    initialLimit?: number
}

export function useSystemLogs({ initialLimit = 30 }: UseSystemLogsProps = {}) {
    const router = useRouter()
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [meta, setMeta] = useState<LogMeta | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    // Filters
    const [activeCategory, setActiveCategory] = useState<CategoryKey>('all')
    const [activeLevel, setActiveLevel] = useState<LevelKey>('all')
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return phtStr(d)
    })
    const [endDate, setEndDate] = useState(() => phtStr(new Date()))
    const [searchQuery, setSearchQuery] = useState('')
    const [page, setPage] = useState(1)
    const limit = initialLimit

    // Debounce the search query
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery)
        }, 500)
        return () => clearTimeout(handler)
    }, [searchQuery])

    const fetchLogs = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                startDate,
                endDate,
                category: activeCategory,
                level: activeLevel,
                page: String(page),
                limit: String(limit),
                ...(debouncedSearchQuery.trim() ? { search: debouncedSearchQuery.trim() } : {})
            })

            const res = await fetch(`/api/logs?${params}`, { credentials: 'include' })

            if (res.status === 401) {
                router.replace('/login')
                return
            }

            const data = await res.json()
            if (data.success) {
                setLogs(data.data || [])
                setMeta(data.meta || null)
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [router, startDate, endDate, activeCategory, activeLevel, page, limit, debouncedSearchQuery])

    useEffect(() => {
        setLoading(true)
        fetchLogs()
    }, [fetchLogs])

    const handleRefresh = useCallback(() => {
        setRefreshing(true)
        fetchLogs()
    }, [fetchLogs])

    const handleCategoryChange = useCallback((cat: CategoryKey) => {
        setActiveCategory(cat)
        setPage(1)
    }, [])

    const handleLevelChange = useCallback((level: LevelKey) => {
        setActiveLevel(level)
        setPage(1)
    }, [])

    const handlePageChange = useCallback((newPage: number) => {
        setPage(newPage)
    }, [])

    // Filter logs by search query (client-side as per original) -> Now handled server-side!

    return {
        logs,
        rawLogs: logs,
        meta,
        loading,
        refreshing,
        activeCategory,
        activeLevel,
        startDate,
        endDate,
        searchQuery,
        page,
        limit,
        setStartDate,
        setEndDate,
        setSearchQuery,
        handleRefresh,
        handleCategoryChange,
        handleLevelChange,
        handlePageChange,
    }
}
