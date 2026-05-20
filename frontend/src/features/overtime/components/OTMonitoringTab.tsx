import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOTSessions } from '../hooks/useOTSessions';
import { Search, Clock, Calendar, AlertTriangle, X, AlertCircle, Fingerprint, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { OTSession } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { DataTablePagination } from '@/components/ui/DataTablePagination';

interface OTMonitoringTabProps {
  departments?: { id: number; name: string }[];
  role?: 'admin' | 'manager' | 'hr';
}

export function OTMonitoringTab({ departments, role }: OTMonitoringTabProps) {
  const { sessions, loading, meta, filters, setFilters, page, setPage, refresh } = useOTSessions();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const [searchInput, setSearchInput] = useState(filters.search);
  const [departmentsList, setDepartmentsList] = useState<{ id: number; name: string }[]>(departments || []);

  // Fetch departments locally if they are not passed down
  useEffect(() => {
    if (departments && departments.length > 0) {
      setDepartmentsList(departments);
      return;
    }
    const fetchDepts = async () => {
      try {
        const url = role === 'manager' ? '/api/me/departments' : '/api/departments';
        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.departments) {
          setDepartmentsList(data.departments);
        }
      } catch (err) {
        console.error('Failed to fetch departments', err);
      }
    };
    fetchDepts();
  }, [departments, role]);

  // Statistics State
  const [stats, setStats] = useState({
    scheduled: 0,
    active: 0,
    partial: 0,
    completed: 0,
    missed: 0,
    total: 0
  });

  // Fetch all sessions matching the current filters (without state filtering) to compute global stats
  useEffect(() => {
    let active = true;
    const fetchGlobalStats = async () => {
      try {
        const params = new URLSearchParams();
        params.append('limit', '1000'); // Fetch a large batch to calculate stats globally
        if (filters.search) params.append('search', filters.search);
        if (filters.departmentId) params.append('departmentId', filters.departmentId.toString());
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);

        const url = `/api/attendance/overtime/sessions?${params.toString()}`;
        const res = await apiFetch<{ success: boolean; sessions: OTSession[] }>(url);
        if (res.success && active) {
          const counts = {
            scheduled: 0,
            active: 0,
            partial: 0,
            completed: 0,
            missed: 0,
            total: res.sessions.length
          };
          res.sessions.forEach(s => {
            const state = s.sessionState;
            if (state === 'SCHEDULED') counts.scheduled++;
            else if (state === 'ACTIVE') counts.active++;
            else if (state === 'PARTIAL') counts.partial++;
            else if (state === 'COMPLETED') counts.completed++;
            else if (state === 'MISSED') counts.missed++;
          });
          setStats(counts);
        }
      } catch (err) {
        console.error('Failed to compute overtime sessions stats', err);
      }
    };
    fetchGlobalStats();
    return () => {
      active = false;
    };
  }, [filters.search, filters.departmentId, filters.startDate, filters.endDate, sessions]);

  // Sorting State
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') {
        setSortKey(null);
        setSortOrder(null);
      } else {
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Sort sessions locally
  const sortedSessions = useMemo(() => {
    if (!sortKey || !sortOrder) return sessions;
    return [...sessions].sort((a, b) => {
      let aVal: any = a;
      let bVal: any = b;

      if (sortKey === 'employeeName') {
        aVal = `${a.employee.firstName} ${a.employee.lastName}`.toLowerCase();
        bVal = `${b.employee.firstName} ${b.employee.lastName}`.toLowerCase();
      } else if (sortKey === 'date') {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      } else if (sortKey === 'approvedDuration') {
        aVal = a.approvedDurationMinutes;
        bVal = b.approvedDurationMinutes;
      } else if (sortKey === 'actualDuration') {
        aVal = a.actualDurationMinutes;
        bVal = b.actualDurationMinutes;
      } else if (sortKey === 'sessionState') {
        aVal = a.sessionState;
        bVal = b.sessionState;
      }

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
  }, [sessions, sortKey, sortOrder]);

  // Extend states
  const [extendingSession, setExtendingSession] = useState<OTSession | null>(null);
  const [newEndTime, setNewEndTime] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [extendError, setExtendError] = useState<string | null>(null);
  const [extendLoading, setExtendLoading] = useState(false);

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingSession || !newEndTime || !extendReason) {
      setExtendError('Please fill out all fields.');
      return;
    }
    if (newEndTime <= extendingSession.approved.startTime) {
      setExtendError('End time must be after start time.');
      return;
    }

    try {
      setExtendLoading(true);
      setExtendError(null);

      const res = await apiFetch<{ success: boolean; message: string }>(
        `/api/attendance/overtime/${extendingSession.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            endTime: newEndTime,
            reason: `${extendingSession.reason || ''}\n[Extended by Manager]: ${extendReason}`,
            status: 'APPROVED'
          })
        }
      );

      if (res.success) {
        setExtendingSession(null);
        setNewEndTime('');
        setExtendReason('');
        // Trigger list refresh
        setFilters(f => ({ ...f }));
      } else {
        setExtendError(res.message || 'Failed to extend session.');
      }
    } catch (err) {
      setExtendError(err instanceof Error ? err.message : 'Server error.');
    } finally {
      setExtendLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, setFilters]);

  // Format minutes into H hrs M mins
  const formatDuration = (mins: number) => {
    if (!mins) return '0 mins';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    if (/^\d{2}:\d{2}$/.test(timeStr) || /^\d{2}:\d{2}:\d{2}$/.test(timeStr)) return timeStr.substring(0, 5);
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  const getBadgeColors = (state: string) => {
    switch (state) {
      case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'MISSED': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'PARTIAL': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'SCHEDULED': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'COMPLETED': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getDurationColor = (row: OTSession) => {
    if (row.sessionState === 'SCHEDULED' || row.sessionState === 'MISSED') return 'text-slate-400';
    if (row.actualDurationMinutes > row.approvedDurationMinutes) return 'text-rose-600 font-bold';
    if (row.sessionState === 'COMPLETED') return 'text-emerald-600 font-bold';
    return 'text-slate-600 font-medium';
  };

  return (
    <div className="space-y-4">
      {/* Premium Filters Box */}
      <div className="flex flex-col md:flex-row gap-3 bg-secondary/10 p-2 rounded-2xl border border-border shadow-sm w-full">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search employee..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
          />
        </div>

        {/* Action Selects and Dates */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Department */}
          <Select
            value={filters.departmentId ? String(filters.departmentId) : 'all'}
            onValueChange={(val) => setFilters(f => ({ ...f, departmentId: val === 'all' ? null : parseInt(val) }))}
          >
            <SelectTrigger className="w-52 bg-card border-border font-bold text-xs uppercase tracking-widest text-foreground">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">ALL DEPARTMENTS</SelectItem>
              {departmentsList.map(d => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Session State */}
          <Select
            value={filters.sessionState || 'all'}
            onValueChange={(val) => setFilters(f => ({ ...f, sessionState: val === 'all' ? '' : val }))}
          >
            <SelectTrigger className="w-44 bg-card border-border font-bold text-xs uppercase tracking-widest text-foreground">
              <SelectValue placeholder="Session State" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">ALL STATES</SelectItem>
              <SelectItem value="SCHEDULED">SCHEDULED</SelectItem>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="PARTIAL">PARTIAL</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
              <SelectItem value="MISSED">MISSED</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              ref={dateInputRef}
              className="absolute opacity-0 pointer-events-none"
              value={filters.startDate}
              onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value, endDate: e.target.value }))}
            />
            <button
              onClick={() => {
                if (dateInputRef.current && 'showPicker' in dateInputRef.current) {
                  dateInputRef.current.showPicker();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-xs font-bold text-foreground hover:bg-secondary transition-all shadow-sm h-10"
            >
              <Calendar className="w-4 h-4 text-rose-500" />
              <span>
                {filters.startDate === getTodayDate()
                  ? `Today, ${new Date(filters.startDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
                  : new Date(filters.startDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-2 bg-card hover:bg-secondary border border-border text-foreground hover:text-rose-600 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-card rounded-2xl border border-border shadow-md overflow-hidden">
        
        {/* Real-time stats header */}
        <div className="px-6 py-4 border-b border-border bg-secondary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black text-foreground uppercase tracking-widest">OT Monitoring Logs</h3>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scheduled</p>
              <p className="text-xl font-black text-blue-500">{stats.scheduled}</p>
            </div>
            <div className="w-px h-8 bg-border hidden sm:block" />
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active</p>
              <p className="text-xl font-black text-emerald-500">{stats.active}</p>
            </div>
            <div className="w-px h-8 bg-border hidden sm:block" />
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Partial</p>
              <p className="text-xl font-black text-amber-500">{stats.partial}</p>
            </div>
            <div className="w-px h-8 bg-border hidden sm:block" />
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Completed</p>
              <p className="text-xl font-black text-slate-500">{stats.completed}</p>
            </div>
            <div className="w-px h-8 bg-border hidden sm:block" />
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Missed</p>
              <p className="text-xl font-black text-rose-500">{stats.missed}</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</p>
              <p className="text-xl font-black text-foreground">{stats.total}</p>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
              <div className="text-slate-500 font-medium animate-pulse">Loading sessions...</div>
            </div>
          ) : sortedSessions.length === 0 ? (
            <div className="px-6 py-16 text-center text-muted-foreground font-black uppercase text-[10px] tracking-widest">
              No overtime sessions found.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sortedSessions.map(row => (
                <div key={row.id} className="p-5 hover:bg-primary/5 transition-colors relative flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 font-bold text-[10px] uppercase tracking-tight border border-rose-500/20">
                        {row.employee.firstName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-foreground text-sm truncate uppercase tracking-tight">
                          {row.employee.firstName} {row.employee.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                          {row.employee.department} • {row.employee.branch}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border whitespace-nowrap ${getBadgeColors(row.sessionState)}`}>
                      {row.sessionState}
                    </span>
                  </div>

                  {/* Body Grid */}
                  <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Date</p>
                      <p className="text-sm font-bold text-slate-700">
                        {new Date(row.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC'
                        })}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">OT Duration</p>
                      <div className={`text-sm ${getDurationColor(row)}`}>
                        {row.sessionState === 'SCHEDULED' || row.sessionState === 'MISSED' ? (
                          <span className="text-slate-400 font-medium">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span>{formatDuration(row.actualDurationMinutes)}</span>
                            {row.actualDurationMinutes > row.approvedDurationMinutes && <AlertTriangle size={12} className="text-rose-500 shrink-0" />}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Approved OT</p>
                      <p className="font-mono font-bold text-slate-700">
                        {formatTime(row.approved.startTime)} - {formatTime(row.approved.endTime)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Duration: {formatDuration(row.approvedDurationMinutes)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Actual Punch</p>
                      {row.sessionState === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-2 text-blue-500 font-bold text-[10px] uppercase tracking-wider">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                          </span>
                          Active
                        </span>
                      ) : (
                        <>
                          <p className="font-mono font-bold text-slate-700">
                            {row.actual.startTime ? formatTime(row.actual.startTime) : '—'} - {row.actual.endTime ? formatTime(row.actual.endTime) : '—'}
                          </p>
                          {(row.device.checkIn || row.device.checkOut) && (
                            <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                              Devices: {row.device.checkIn || 'N/A'} / {row.device.checkOut || 'N/A'}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {role && (role === 'admin' || role === 'manager') && (row.sessionState === 'ACTIVE' || row.sessionState === 'SCHEDULED') && (
                    <button
                      onClick={() => {
                        setExtendingSession(row);
                        setNewEndTime(row.approved.endTime);
                        setExtendReason('');
                        setExtendError(null);
                      }}
                      className="w-full py-2.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    >
                      <Clock size={14} /> Extend OT
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden lg:block">
          <table className="w-full text-left border-collapse min-w-[900px] bg-card">
            <thead className="bg-secondary/50 backdrop-blur-sm border-b border-border">
              <tr>
                <SortableHeader label="Employee" sortKey="employeeName" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight" />
                <SortableHeader label="Date" sortKey="date" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight" />
                <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">Approved OT</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">OT Time In</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">OT Time Out</th>
                <SortableHeader label="OT Duration" sortKey="actualDuration" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight" />
                <SortableHeader label="Live State" sortKey="sessionState" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight text-center" />
                {role && (role === 'admin' || role === 'manager') && (
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={role && (role === 'admin' || role === 'manager') ? 8 : 7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm font-medium">Loading overtime sessions...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedSessions.length === 0 ? (
                <tr>
                  <td colSpan={role && (role === 'admin' || role === 'manager') ? 8 : 7} className="px-6 py-16 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest">
                    No overtime sessions found.
                  </td>
                </tr>
              ) : (
                sortedSessions.map(row => (
                  <tr key={row.id} className="hover:bg-primary/5 transition-colors duration-200 group cursor-default">
                    {/* Employee */}
                    <td className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 font-bold text-[10px] uppercase tracking-tight border border-rose-500/20 shrink-0">
                        {row.employee.firstName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground leading-tight uppercase tracking-tight">
                          {row.employee.firstName} {row.employee.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                          {row.employee.department} • {row.employee.branch}
                        </p>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-600">
                      {new Date(row.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        timeZone: 'UTC'
                      })}
                    </td>

                    {/* Approved OT */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-bold text-slate-700">
                          {formatTime(row.approved.startTime)} - {formatTime(row.approved.endTime)}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          Approved: {formatDuration(row.approvedDurationMinutes)}
                        </span>
                      </div>
                    </td>

                    {/* OT Time In */}
                    <td className="px-4 py-3.5 text-center text-sm font-mono font-bold text-slate-700">
                      <div className="flex flex-col items-center">
                        <span>{row.actual.startTime ? formatTime(row.actual.startTime) : '—'}</span>
                        {row.actual.startTime && row.device.checkIn && (
                          <div title={`Check In Device: ${row.device.checkIn}`} className="inline-flex items-center gap-1 mt-1 bg-secondary/60 hover:bg-secondary border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                            <Fingerprint className="w-2.5 h-2.5 text-rose-500 shrink-0 opacity-80" />
                            <span className="text-[9px] text-muted-foreground font-bold truncate leading-none pt-px">{row.device.checkIn}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* OT Time Out */}
                    <td className="px-4 py-3.5 text-center text-sm font-mono font-bold text-slate-700">
                      <div className="flex flex-col items-center">
                        {row.sessionState === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-2 text-blue-500 font-bold text-[10px] uppercase tracking-wider">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            Active
                          </span>
                        ) : (
                          <>
                            <span>{row.actual.endTime ? formatTime(row.actual.endTime) : '—'}</span>
                            {row.actual.endTime && row.device.checkOut && (
                              <div title={`Check Out Device: ${row.device.checkOut}`} className="inline-flex items-center gap-1 mt-1 bg-secondary/60 hover:bg-secondary border border-border/50 px-1.5 py-0.5 rounded-md transition-colors w-fit max-w-[130px]">
                                <Fingerprint className="w-2.5 h-2.5 text-rose-500 shrink-0 opacity-80" />
                                <span className="text-[9px] text-muted-foreground font-bold truncate leading-none pt-px">{row.device.checkOut}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    {/* OT Duration */}
                    <td className="px-4 py-3.5">
                      {row.sessionState === 'SCHEDULED' || row.sessionState === 'MISSED' ? (
                        <span className="text-slate-400 font-medium">—</span>
                      ) : (
                        <div className={`flex items-center gap-1 text-sm ${getDurationColor(row)}`}>
                          <span>{formatDuration(row.actualDurationMinutes)}</span>
                          {row.actualDurationMinutes > row.approvedDurationMinutes && <AlertTriangle size={14} className="text-rose-500" />}
                        </div>
                      )}
                    </td>

                    {/* Live State */}
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border whitespace-nowrap ${getBadgeColors(row.sessionState)}`}>
                        {row.sessionState}
                      </span>
                    </td>

                    {/* Actions */}
                    {role && (role === 'admin' || role === 'manager') && (
                      <td className="px-4 py-3.5 text-center">
                        {(row.sessionState === 'ACTIVE' || row.sessionState === 'SCHEDULED') ? (
                          <button
                            onClick={() => {
                              setExtendingSession(row);
                              setNewEndTime(row.approved.endTime);
                              setExtendReason('');
                              setExtendError(null);
                            }}
                            className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                            title="Extend Overtime"
                          >
                            <Clock size={12} />
                            <span>Extend</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic font-medium">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination block */}
        {meta && (
          <DataTablePagination
            currentPage={page}
            totalPages={meta.totalPages}
            onPageChange={setPage}
            totalCount={meta.total}
            pageSize={meta.limit}
            entityName="overtime sessions"
            loading={loading}
          />
        )}
      </div>

      {/* Premium Glassmorphic Extend Modal */}
      {extendingSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 border border-slate-100">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/20">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-rose-600" />
                Extend Overtime
              </h2>
              <button 
                onClick={() => setExtendingSession(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleExtendSubmit} className="p-6 space-y-4">
              {extendError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{extendError}</span>
                </div>
              )}

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <p className="text-sm font-bold text-slate-800">
                  Employee: {extendingSession.employee.firstName} {extendingSession.employee.lastName}
                </p>
                <p className="text-xs text-slate-500 mt-1 font-semibold">
                  Approved OT: {formatTime(extendingSession.approved.startTime)} to {formatTime(extendingSession.approved.endTime)} ({formatDuration(extendingSession.approvedDurationMinutes)})
                </p>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5">New End Time <span className="text-rose-500">*</span></label>
                <input 
                  type="time" 
                  value={newEndTime} 
                  onChange={(e) => setNewEndTime(e.target.value)} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5">Extension Reason <span className="text-rose-500">*</span></label>
                <textarea 
                  value={extendReason} 
                  onChange={(e) => setExtendReason(e.target.value)} 
                  placeholder="State the operational reason for this overtime extension..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all min-h-[90px] resize-none"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setExtendingSession(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={extendLoading}
                  className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {extendLoading ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
