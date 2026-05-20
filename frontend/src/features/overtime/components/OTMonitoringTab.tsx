import React, { useState, useEffect } from 'react';
import { useOTSessions } from '../hooks/useOTSessions';
import { Search, Clock, Calendar, ChevronLeft, ChevronRight, AlertTriangle, X, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { OTSession } from '../types';

interface OTMonitoringTabProps {
  departments?: { id: number; name: string }[];
  role?: 'admin' | 'manager' | 'hr';
}

const toLocalDatetimeLocal = (isoStr: string | null) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

export function OTMonitoringTab({ departments, role }: OTMonitoringTabProps) {
  const { sessions, loading, meta, filters, setFilters, page, setPage } = useOTSessions();
  const [searchInput, setSearchInput] = useState(filters.search);

  // Extend states
  const [extendingSession, setExtendingSession] = useState<OTSession | null>(null);
  const [newEndTime, setNewEndTime] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [extendError, setExtendError] = useState<string | null>(null);
  const [extendLoading, setExtendLoading] = useState(false);

  // Edit Actual Times states (Testing Only)
  const [editingSession, setEditingSession] = useState<OTSession | null>(null);
  const [editActualStart, setEditActualStart] = useState('');
  const [editActualEnd, setEditActualEnd] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    try {
      setEditLoading(true);
      setEditError(null);

      const res = await apiFetch<{ success: boolean; message: string }>(
        `/api/attendance/overtime/${editingSession.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            actualStartTime: editActualStart ? new Date(editActualStart).toISOString() : null,
            actualEndTime: editActualEnd ? new Date(editActualEnd).toISOString() : null
          })
        }
      );

      if (res.success) {
        setEditingSession(null);
        setEditActualStart('');
        setEditActualEnd('');
        // Trigger list refresh
        setFilters(f => ({ ...f }));
      } else {
        setEditError(res.message || 'Failed to update actual times.');
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Server error.');
    } finally {
      setEditLoading(false);
    }
  };

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
      case 'MISSED': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'PARTIAL': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'SCHEDULED': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'COMPLETED': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search employee..." 
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 ring-indigo-500/20"
          />
        </div>
        {departments && (
          <select 
            value={filters.departmentId || ''} 
            onChange={e => setFilters(f => ({ ...f, departmentId: e.target.value ? parseInt(e.target.value) : null }))}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 ring-indigo-500/20 bg-white"
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <select 
          value={filters.sessionState} 
          onChange={e => setFilters(f => ({ ...f, sessionState: e.target.value }))}
          className="px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 ring-indigo-500/20 bg-white"
        >
          <option value="">All States</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="ACTIVE">Active</option>
          <option value="PARTIAL">Partial</option>
          <option value="COMPLETED">Completed</option>
          <option value="MISSED">Missed</option>
        </select>
        <input 
          type="date" 
          value={filters.startDate}
          onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
          className="px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 ring-indigo-500/20 text-slate-600"
        />
        <input 
          type="date" 
          value={filters.endDate}
          onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
          className="px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 ring-indigo-500/20 text-slate-600"
        />
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <div className="text-slate-500 font-medium animate-pulse">Loading sessions...</div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-12 text-center text-slate-500 font-medium bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
          No overtime sessions found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(session => (
            <div key={session.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0 pr-3">
                  <h3 className="text-sm font-bold text-slate-800 truncate">{session.employee.firstName} {session.employee.lastName}</h3>
                  <p className="text-xs text-slate-500 font-medium truncate">{session.employee.department} • {session.employee.branch}</p>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border whitespace-nowrap ${getBadgeColors(session.sessionState)}`}>
                  {session.sessionState}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 font-medium mb-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-1.5"><Calendar size={16} className="text-slate-400" /> {new Date(session.date).toLocaleDateString()}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Clock size={12} /> Approved
                  </div>
                  <div className="text-sm font-medium text-slate-700">
                    {formatTime(session.approved.startTime)} - {formatTime(session.approved.endTime)}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {formatDuration(session.approvedDurationMinutes)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Clock size={12} /> Actual
                  </div>
                  <div className="text-sm font-medium text-slate-700">
                    {formatTime(session.actual.startTime)} - {formatTime(session.actual.endTime)}
                  </div>
                  <div className={`text-xs mt-0.5 ${session.actualDurationMinutes > session.approvedDurationMinutes ? 'text-red-600 font-bold flex items-center gap-1' : 'text-slate-500'}`}>
                    {formatDuration(session.actualDurationMinutes)}
                    {session.actualDurationMinutes > session.approvedDurationMinutes && <AlertTriangle size={12} />}
                  </div>
                </div>
              </div>

              {/* Devices if any */}
              {(session.device.checkIn || session.device.checkOut) && (
                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                  <div className="truncate pr-2">In: {session.device.checkIn || 'N/A'}</div>
                  <div className="truncate">Out: {session.device.checkOut || 'N/A'}</div>
                </div>
              )}

              {role && (role === 'admin' || role === 'manager') && (
                <div className="mt-4 flex flex-col gap-2">
                  {(session.sessionState === 'ACTIVE' || session.sessionState === 'SCHEDULED') && (
                    <button
                      onClick={() => {
                        setExtendingSession(session);
                        setNewEndTime(session.approved.endTime);
                        setExtendReason('');
                        setExtendError(null);
                      }}
                      className="w-full py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Clock size={14} /> Extend OT
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingSession(session);
                      setEditActualStart(toLocalDatetimeLocal(session.actual.startTime));
                      setEditActualEnd(toLocalDatetimeLocal(session.actual.endTime));
                      setEditError(null);
                    }}
                    className="w-full py-2 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Clock size={14} /> Edit Actual Times (Testing Only)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm mt-6">
          <div className="text-sm text-slate-500">
            Showing <span className="font-medium">{(meta.page - 1) * meta.limit + 1}</span> to <span className="font-medium">{Math.min(meta.page * meta.limit, meta.total)}</span> of <span className="font-medium">{meta.total}</span> results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 text-slate-600"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              className="p-2 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 text-slate-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {extendingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Extend Overtime
              </h2>
              <button 
                onClick={() => setExtendingSession(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExtendSubmit} className="p-5 space-y-4">
              {extendError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
                  <AlertCircle size={16} /> {extendError}
                </div>
              )}

              <div>
                <p className="text-sm font-bold text-slate-800">
                  Employee: {extendingSession.employee.firstName} {extendingSession.employee.lastName}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Current OT Approved: {extendingSession.approved.startTime} to {extendingSession.approved.endTime}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1.5">New End Time <span className="text-red-500">*</span></label>
                <input 
                  type="time" 
                  value={newEndTime} 
                  onChange={(e) => setNewEndTime(e.target.value)} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1.5">Extension Reason <span className="text-red-500">*</span></label>
                <textarea 
                  value={extendReason} 
                  onChange={(e) => setExtendReason(e.target.value)} 
                  placeholder="Why is this overtime being extended?"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[80px] resize-none"
                  required
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={extendLoading}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {extendLoading ? 'Saving Extension...' : 'Confirm Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Edit Actual Times
              </h2>
              <button 
                onClick={() => setEditingSession(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs font-medium border border-amber-200 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold mb-0.5">Testing Mode Feature</strong>
                  Please delete or disable this manual actual time editing feature after testing stage.
                </div>
              </div>

              {editError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
                  <AlertCircle size={16} /> {editError}
                </div>
              )}

              <div>
                <p className="text-sm font-bold text-slate-800">
                  Employee: {editingSession.employee.firstName} {editingSession.employee.lastName}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Approved Window: {editingSession.approved.startTime} to {editingSession.approved.endTime}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1.5">Actual Check-In Time</label>
                <input 
                  type="datetime-local" 
                  value={editActualStart} 
                  onChange={(e) => setEditActualStart(e.target.value)} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1.5">Actual Check-Out Time</label>
                <input 
                  type="datetime-local" 
                  value={editActualEnd} 
                  onChange={(e) => setEditActualEnd(e.target.value)} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditActualStart('');
                    setEditActualEnd('');
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  Clear Times
                </button>
                <button 
                  type="submit" 
                  disabled={editLoading}
                  className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Actual Times'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
