import React, { useState } from 'react'
import {
    ScrollText, Info
} from 'lucide-react'
import { LogEntry } from '../utils/log-types'
import {
    formatTimestamp, getActionIcon, getActionBadge,
    getCategoryBadge, getLevelBadge, getAvatarBg, formatActionLabel
} from './LogHelpers'

interface SystemLogsTableProps {
    logs: LogEntry[]
}

export function SystemLogsTable({ logs }: SystemLogsTableProps) {
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <ScrollText className="w-7 h-7 text-slate-300" />
                </div>
                <div className="text-center">
                    <p className="text-slate-500 font-bold text-sm">No logs found</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                        Try adjusting your date range or filters
                    </p>
                </div>
            </div>
        )
    }

    return (
        <>
            {/* Desktop Table Header (hidden on mobile) */}
            <div className="hidden lg:grid grid-cols-[140px_1fr_150px_1fr_100px_90px_70px] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">
                <span>Timestamp</span>
                <span>Employee</span>
                <span>Action</span>
                <span>Details</span>
                <span>Source</span>
                <span>Category</span>
                <span>Level</span>
            </div>

            {/* Mobile Header */}
            <div className="lg:hidden px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">
                Log Entries
            </div>

            {/* Body */}
            <div
              className="flex-1 overflow-y-auto scrollbar-light min-h-0"
              tabIndex={0}
              role="region"
              aria-label="System log entries — scroll vertically"
            >
                {logs.map(log => {
                    const { date, time } = formatTimestamp(log.timestamp)
                    const isExpanded = expandedLogId === log.id

                    return (
                        <div key={log.id}>
                            {/* Desktop row (lg+) */}
                            <div
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className={`hidden lg:grid grid-cols-[140px_1fr_150px_1fr_100px_90px_70px] gap-3 px-4 py-2.5 border-b border-slate-50 transition-colors cursor-pointer items-center ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                            >
                                {/* Timestamp */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-700">{time}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{date}</p>
                                </div>

                                {/* Employee */}
                                <div className="flex items-center gap-2 min-w-0">
                                    {log.employeePhoto ? (
                                        <img 
                                            src={log.employeePhoto} 
                                            alt={log.employeeName} 
                                            className="w-7 h-7 rounded-full object-cover shadow-sm shrink-0 border border-slate-200" 
                                        />
                                    ) : (
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm ${getAvatarBg(log.employeeRole)}`}>
                                            <span className="text-white text-[9px] font-black">
                                                {log.employeeName === 'System' ? 'SY' : log.employeeName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                                            </span>
                                        </div>
                                    )}
                                    <span className="text-xs font-bold text-slate-800 truncate">{log.employeeName}</span>
                                </div>

                                {/* Action */}
                                <div className="flex items-center gap-1.5">
                                    {getActionIcon(log.action)}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getActionBadge(log.action)}`}>
                                        {formatActionLabel(log.action)}
                                    </span>
                                </div>

                                {/* Details */}
                                <p className="text-xs text-slate-500 truncate" title={log.details}>{log.details}</p>

                                {/* Source */}
                                <p className="text-xs font-semibold text-slate-600 truncate">{log.source}</p>

                                {/* Category */}
                                <div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit capitalize ${getCategoryBadge(log.category)}`}>
                                        {log.category || 'system'}
                                    </span>
                                </div>

                                {/* Level */}
                                <div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit ${getLevelBadge(log.level)}`}>
                                        {log.level || 'INFO'}
                                    </span>
                                </div>
                            </div>

                            {/* Mobile card (< lg) */}
                            <div
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className={`lg:hidden px-4 py-3 border-b border-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {log.employeePhoto ? (
                                            <img 
                                                src={log.employeePhoto} 
                                                alt={log.employeeName} 
                                                className="w-8 h-8 rounded-full object-cover shadow-sm shrink-0 border border-slate-200" 
                                            />
                                        ) : (
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${getAvatarBg(log.employeeRole)}`}>
                                                <span className="text-white text-[10px] font-black">
                                                    {log.employeeName === 'System' ? 'SY' : log.employeeName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                                                </span>
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{log.employeeName}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{date} · {time}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 items-end">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 capitalize ${getCategoryBadge(log.category)}`}>
                                            {log.category || 'system'}
                                        </span>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getLevelBadge(log.level)}`}>
                                            {log.level || 'INFO'}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1">
                                        {getActionIcon(log.action)}
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getActionBadge(log.action)}`}>
                                            {formatActionLabel(log.action)}
                                        </span>
                                    </div>
                                    {log.source && (
                                        <span className="text-[10px] font-semibold text-slate-400">
                                            via {log.source}
                                        </span>
                                    )}
                                </div>
                                {log.details && (
                                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{log.details}</p>
                                )}
                            </div>

                            {/* Expanded Metadata Viewer */}
                            {isExpanded && (
                                <div className="px-4 lg:px-[156px] py-4 bg-slate-50/80 border-b border-slate-100 shadow-inner">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                            <Info className="w-4 h-4 text-blue-500" /> Event Details & Context
                                        </div>
                                        {/* Correlation ID */}
                                        {log.correlationId && (
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                <span className="font-black uppercase tracking-wider">Trace ID</span>
                                                <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">
                                                    {log.correlationId}
                                                </code>
                                            </div>
                                        )}
                                    </div>

                                    {log.metadata && Object.keys(log.metadata).length > 0 ? (
                                        <div className="mt-3 flex flex-col gap-3">
                                            {/* Render human-readable array updates if they exist */}
                                            {Array.isArray(log.metadata.updates) && log.metadata.updates.length > 0 && (
                                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-3">Actual Changes</h4>
                                                    <ul className="space-y-2">
                                                        {log.metadata.updates.map((update: string, i: number) => (
                                                            <li key={i} className="flex items-start gap-2 text-xs font-medium text-slate-700">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                                                {update}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Render structured changes array */}
                                            {Array.isArray(log.metadata.changes) && log.metadata.changes.length > 0 && (
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Modified Fields</h4>
                                                    </div>
                                                    <div className="divide-y divide-slate-100">
                                                        {log.metadata.changes.map((change: any, i: number) => (
                                                            <div key={i} className="grid grid-cols-3 text-xs transition-colors hover:bg-slate-50/50">
                                                                <div className="p-3 bg-slate-50/30 border-r border-slate-100 font-semibold text-slate-600 capitalize flex items-center">
                                                                    {change.field.replace(/([A-Z])/g, ' $1').trim()}
                                                                </div>
                                                                <div className="p-3 text-red-600 line-through decoration-red-300 opacity-80 break-all bg-red-50/10 flex items-center">
                                                                    {change.oldValue === null ? 'null' : String(change.oldValue)}
                                                                </div>
                                                                <div className="p-3 text-emerald-600 font-medium break-all bg-emerald-50/10 flex items-center border-l border-emerald-50">
                                                                    {change.newValue === null ? 'null' : String(change.newValue)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Render structured snapshot object */}
                                            {log.metadata.snapshot && typeof log.metadata.snapshot === 'object' && Object.keys(log.metadata.snapshot).length > 0 && (
                                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-sky-600">Data Snapshot</h4>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-slate-100">
                                                        {Object.entries(log.metadata.snapshot).map(([key, value]) => (
                                                            <div key={key} className="bg-white p-3 flex flex-col gap-1 hover:bg-slate-50 transition-colors">
                                                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                                                </span>
                                                                <span className="text-xs font-semibold text-slate-800 break-all">
                                                                    {value === null ? 'null' : String(value)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Render distinct error card if an error exists */}
                                            {(log.metadata.error || log.metadata.errorMessage) && (
                                                <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm flex flex-col gap-1">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-red-500">Error Details</span>
                                                    <span className="text-xs font-bold text-red-700 break-all">{log.metadata.error || log.metadata.errorMessage}</span>
                                                </div>
                                            )}

                                            {/* Render other primitive info fields, stripping objects/arrays and internal fields */}
                                            {Object.entries(log.metadata).filter(([key, val]) =>
                                                key !== 'updates' &&
                                                key !== 'changes' &&
                                                key !== 'snapshot' &&
                                                key !== 'error' &&
                                                key !== 'errorMessage' &&
                                                key !== 'body' &&
                                                key !== 'password' &&
                                                key !== 'changedFields' &&
                                                key !== 'category' &&
                                                typeof val !== 'object'
                                            ).length > 0 && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                    {Object.entries(log.metadata).filter(([key, val]) =>
                                                        key !== 'updates' &&
                                                        key !== 'changes' &&
                                                        key !== 'snapshot' &&
                                                        key !== 'error' &&
                                                        key !== 'errorMessage' &&
                                                        key !== 'body' &&
                                                        key !== 'password' &&
                                                        key !== 'changedFields' &&
                                                        key !== 'category' &&
                                                        typeof val !== 'object'
                                                    ).map(([key, value]) => (
                                                        <div key={key} className="flex flex-col gap-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                            <span className="text-xs font-semibold text-slate-800 break-all">
                                                                {String(value)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-slate-400 font-medium italic mt-2 ml-1">
                                            No additional metadata payload was attached to this event.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </>
    )
}
