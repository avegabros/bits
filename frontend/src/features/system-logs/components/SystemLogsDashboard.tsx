'use client'

import React, { useState, useEffect } from 'react'
import {
    ScrollText, Fingerprint, KeyRound, Radio, Users, Settings, Bot,
    RefreshCw, ChevronDown, CalendarDays, Search
} from 'lucide-react'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import { CategoryKey, LevelKey, CategoryTabConfig } from '../utils/log-types'
import { useSystemLogs } from '../hooks/useSystemLogs'
import { SystemLogsTable } from './SystemLogsTable'

const CATEGORY_TABS: CategoryTabConfig[] = [
    { key: 'all', label: 'All', icon: ScrollText, color: 'text-slate-600' },
    { key: 'attendance', label: 'Attendance', icon: Fingerprint, color: 'text-violet-600' },
    { key: 'auth', label: 'Auth', icon: KeyRound, color: 'text-emerald-600' },
    { key: 'device', label: 'Device', icon: Radio, color: 'text-sky-600' },
    { key: 'employee', label: 'Employee', icon: Users, color: 'text-amber-600' },
    { key: 'config', label: 'Config', icon: Settings, color: 'text-indigo-600' },
    { key: 'system', label: 'System', icon: Bot, color: 'text-slate-500' },
]

export function SystemLogsDashboard() {
    const {
        logs, meta, loading, refreshing, activeCategory, activeLevel,
        startDate, endDate, searchQuery, page, limit,
        setStartDate, setEndDate, setSearchQuery,
        handleRefresh, handleCategoryChange, handleLevelChange, handlePageChange
    } = useSystemLogs()

    const [levelDropdownOpen, setLevelDropdownOpen] = useState(false)

    // Close dropdown on outside click
    useEffect(() => {
        const handler = () => setLevelDropdownOpen(false)
        if (levelDropdownOpen) document.addEventListener('click', handler)
        return () => document.removeEventListener('click', handler)
    }, [levelDropdownOpen])

    // Loading skeleton
    if (loading && !refreshing && logs.length === 0) {
        return (
            <div className="flex flex-col gap-4 p-4 lg:p-5 min-h-[calc(100vh-4rem)]">
                <div className="flex items-center justify-between">
                    <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg" />
                    <div className="h-9 w-28 bg-slate-200 animate-pulse rounded-lg" />
                </div>
                <div className="flex gap-2 overflow-x-auto">
                    {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="h-9 w-24 bg-slate-200 animate-pulse rounded-lg shrink-0" />)}
                </div>
                <div className="space-y-2">
                    {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-slate-200 animate-pulse rounded-lg" />)}
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 p-4 lg:p-5 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] lg:overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-lg lg:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <ScrollText className="w-5 h-5 text-red-500" /> System Logs
                    </h1>
                    <p className="text-slate-500 text-xs font-semibold mt-0.5">
                        Audit trail for all system activities
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col gap-2 shrink-0">
                {/* Category Tabs */}
                <div className="flex bg-slate-100 rounded-lg p-0.5 overflow-x-auto scrollbar-hide">
                    {CATEGORY_TABS.map(tab => {
                        const Icon = tab.icon
                        const count = meta?.counts[tab.key] ?? 0
                        const active = activeCategory === tab.key
                        return (
                            <button
                                key={tab.key}
                                onClick={() => handleCategoryChange(tab.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap shrink-0 ${active
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Icon className={`w-3.5 h-3.5 ${active ? tab.color : 'text-slate-400'}`} />
                                {tab.label}
                                <span className={`text-[10px] ${active ? 'text-red-500' : 'text-slate-400'}`}>
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Second row: Level filter + Date filters + Search */}
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2">
                    {/* Level Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setLevelDropdownOpen(!levelDropdownOpen) }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${activeLevel !== 'all'
                                ? activeLevel === 'ERROR'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : activeLevel === 'WARN'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            {activeLevel === 'all' ? 'All Levels' : activeLevel}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {levelDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[120px] py-1">
                                {(['all', 'INFO', 'WARN', 'ERROR'] as LevelKey[]).map(level => (
                                    <button
                                        key={level}
                                        onClick={(e) => { e.stopPropagation(); handleLevelChange(level) }}
                                        className={`w-full text-left px-3 py-1.5 text-xs font-bold transition-colors ${activeLevel === level ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        {level === 'all' ? 'All Levels' : (
                                            <span className="flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full ${level === 'ERROR' ? 'bg-red-500' : level === 'WARN' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                {level}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                    {/* Date Filters */}
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100 flex-1 sm:flex-none min-w-0"
                        />
                        <span className="text-slate-400 text-xs">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100 flex-1 sm:flex-none min-w-0"
                        />
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-auto sm:ml-auto">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100 w-full sm:w-44"
                        />
                    </div>
                </div>
            </div>

            {/* Logs Table Area */}
            <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col min-h-0 overflow-hidden">
                <SystemLogsTable logs={logs} />

                {/* Pagination Footer */}
                {meta && (
                    <DataTablePagination
                        currentPage={page}
                        totalPages={meta.totalPages}
                        onPageChange={handlePageChange}
                        totalCount={meta.total}
                        pageSize={limit}
                        entityName="logs"
                        loading={loading}
                    />
                )}
            </div>
        </div>
    )
}
