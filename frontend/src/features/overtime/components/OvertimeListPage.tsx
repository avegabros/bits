import React, { useState, useEffect, useRef } from 'react';
import { useOvertimeList } from '../hooks/useOvertimeList';
import { CheckCircle, XCircle, Search, Clock, Calendar, UserPlus } from 'lucide-react';
import { DataTablePagination } from '@/components/ui/DataTablePagination';

interface OvertimeListPageProps {
  role: 'admin' | 'manager' | 'hr';
  statusFilter?: string;
  hidePending?: boolean;
  departments?: { id: number; name: string }[];
  refreshKey?: number;
}

export function OvertimeListPage({ role, statusFilter, hidePending, departments, refreshKey = 0 }: OvertimeListPageProps) {
  const { requests, loading, actionLoading, meta, filters, setFilters, page, setPage, handleReview, handleDelete } = useOvertimeList(role, statusFilter, refreshKey);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchInput, setSearchInput] = useState(filters.search);
  
  const [departmentsList, setDepartmentsList] = useState<{ id: number; name: string }[]>(departments || []);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const getTodayDate = () => new Date().toISOString().split('T')[0];

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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, setFilters]);

  const displayedRequests = hidePending ? requests.filter(r => r.status !== 'PENDING') : requests;

  const getInitials = (first?: string | null, last?: string | null) => {
    const f = first ? first.charAt(0) : '';
    const l = last ? last.charAt(0) : '';
    return `${f}${l}`.toUpperCase() || 'OT';
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Row */}
      <div className="flex flex-col md:flex-row gap-3 bg-white/80 backdrop-blur-md p-3 rounded-3xl border border-slate-200/60 shadow-sm w-full">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search employee by name..." 
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full h-11 pl-11 pr-4 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all bg-white font-medium text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Action Selects and Dates */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full md:w-auto">
          {/* Department Select */}
          {departmentsList.length > 0 && (
            <select 
              value={filters.departmentId || ''} 
              onChange={e => setFilters(f => ({ ...f, departmentId: e.target.value ? parseInt(e.target.value) : null }))}
              className="flex-1 sm:flex-none h-11 px-4 text-sm border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all bg-white font-bold text-slate-700 cursor-pointer shadow-sm w-full sm:w-[180px] max-w-full"
            >
              <option value="">All Departments</option>
              {departmentsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          {/* Date Selector */}
          <div className="flex items-center gap-2 flex-1 sm:flex-none w-full sm:w-auto">
            <input
              type="date"
              ref={dateInputRef}
              className="absolute opacity-0 pointer-events-none w-0 h-0"
              value={filters.startDate || ''}
              onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value, endDate: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => {
                if (dateInputRef.current && 'showPicker' in dateInputRef.current) {
                  dateInputRef.current.showPicker();
                }
              }}
              className="w-full sm:w-auto flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-11 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Calendar className="w-4 h-4 text-red-500" />
              <span>
                {filters.startDate
                  ? filters.startDate === getTodayDate()
                    ? `Today, ${new Date(filters.startDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
                    : new Date(filters.startDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                  : 'Filter Date'}
              </span>
            </button>
            {filters.startDate && (
              <button
                type="button"
                onClick={() => setFilters(f => ({ ...f, startDate: '', endDate: '' }))}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all shrink-0 cursor-pointer"
                title="Clear date filter"
              >
                <XCircle size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Lists / Loading / Empty States */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white/50 border border-slate-200/50 rounded-3xl backdrop-blur-sm shadow-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-100 border-t-red-600"></div>
          <div className="text-slate-500 font-black text-xs animate-pulse tracking-widest uppercase">Loading Requests...</div>
        </div>
      ) : displayedRequests.length === 0 ? (
        <div className="py-20 text-center text-slate-500 font-bold bg-white/50 rounded-3xl border border-slate-200 border-dashed backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="bg-slate-100 p-4 rounded-full border border-slate-200/50">
            <Clock className="w-8 h-8 text-slate-400 animate-pulse" />
          </div>
          <div>
            <p className="text-slate-700 text-base font-black tracking-tight">No Requests Found</p>
            <p className="text-slate-400 text-xs mt-1 font-semibold max-w-xs mx-auto">There are no records matching your current filter criteria in this section.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRequests.map(req => {
            const extensionMatch = req.reason?.match(/^\[EXTENSION:(\d+)\]\s*(.*)$/);
            const displayReason = extensionMatch ? extensionMatch[2] : req.reason;

            // Status design system values
            const statusConfig = {
              APPROVED: {
                bar: 'from-emerald-500 to-teal-500',
                badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                reviewBg: 'bg-emerald-500/[0.03] text-emerald-700 border-emerald-500/10',
                dot: 'bg-emerald-500'
              },
              REJECTED: {
                bar: 'from-rose-500 to-red-500',
                badge: 'bg-red-500/10 text-red-600 border-red-500/20',
                reviewBg: 'bg-rose-500/[0.03] text-rose-700 border-rose-500/10',
                dot: 'bg-rose-500'
              },
              DELETED: {
                bar: 'from-slate-400 to-slate-500',
                badge: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
                reviewBg: 'bg-slate-500/[0.03] text-slate-700 border-slate-500/10',
                dot: 'bg-slate-400'
              },
              PENDING: {
                bar: 'from-amber-500 to-yellow-500',
                badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                reviewBg: 'bg-amber-500/[0.03] text-amber-700 border-amber-500/10',
                dot: 'bg-amber-500'
              }
            };

            const config = statusConfig[req.status as keyof typeof statusConfig] || statusConfig.PENDING;

            return (
              <div key={req.id} className="bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-3xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden group">
                {/* Visual indicator bar top */}
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${config.bar}`} />
                
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    {/* Header Info Block */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      {/* Avatar Initials + Name */}
                      <div className="flex items-center gap-3">
                        {req.employee.profilePicture ? (
                          <img 
                            src={req.employee.profilePicture} 
                            alt={`${req.employee.firstName} ${req.employee.lastName}`} 
                            className="w-10 h-10 rounded-2xl object-cover shadow-sm shrink-0 border border-slate-200" 
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500/10 to-rose-500/10 text-red-600 border border-red-500/10 flex items-center justify-center font-bold text-sm shrink-0">
                            {getInitials(req.employee.firstName, req.employee.lastName)}
                          </div>
                        )}
                        <div>
                          <span className="block text-sm font-black text-slate-800 tracking-tight leading-tight">
                            {req.employee.firstName} {req.employee.lastName}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            {req.employee.Department?.name || 'No Department'}
                          </span>
                        </div>
                      </div>

                      {/* Status Badges Group */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-xl border ${config.badge}`}>
                          {req.status}
                        </span>
                        {req.source === 'ASSIGNED' && (
                          <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-xl border bg-blue-50/10 text-blue-600 border-blue-500/20 flex items-center gap-1">
                            <UserPlus size={11} /> Assigned
                          </span>
                        )}
                        {extensionMatch && (
                          <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-xl border bg-purple-500/10 text-purple-600 border-purple-500/20">
                            Extension
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Date / Time Group */}
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                        <Calendar size={14} className="text-slate-400" />
                        <span>
                          {new Date(req.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                        <Clock size={14} className="text-slate-400" />
                        <span>{req.startTime} to {req.endTime}</span>
                      </div>
                    </div>

                    {/* Reason Text */}
                    <div className="bg-slate-50/50 hover:bg-slate-50 transition-colors p-4 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reason for Overtime</span>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">{displayReason}</p>
                    </div>

                    {/* Rejection Reason */}
                    {req.status === 'REJECTED' && req.rejectionReason && (
                      <div className="bg-rose-500/[0.02] border border-red-500/10 p-4 rounded-2xl">
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-1">Rejection Reason</span>
                        <p className="text-sm text-red-700 font-semibold leading-relaxed">{req.rejectionReason}</p>
                      </div>
                    )}

                    {/* Approver / Review Details */}
                    {req.status !== 'PENDING' && req.reviewedAt && (
                      <div className={`text-[11px] font-black px-3.5 py-2 rounded-xl border inline-flex items-center gap-2 ${config.reviewBg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                        <span>
                          {req.status === 'APPROVED' ? 'Approved' : req.status === 'REJECTED' ? 'Rejected' : 'Reviewed'} by{' '}
                          <span className="font-extrabold underline decoration-rose-500/30">
                            {req.reviewedBy ? `${req.reviewedBy.firstName} ${req.reviewedBy.lastName}` : 'System'}
                          </span>{' '}
                          on {new Date(req.reviewedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Block (Only visible for PENDING) */}
                  {req.status === 'PENDING' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                      <button
                        onClick={() => handleReview(req.id, 'APPROVED')}
                        disabled={actionLoading === req.id}
                        className="flex-1 sm:flex-none h-10 px-5 bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-emerald-600/10 hover:bg-emerald-700 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle size={15} /> Approve
                      </button>
                      <button
                        onClick={() => setRejectId(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex-1 sm:flex-none h-10 px-5 bg-white border border-rose-200 text-rose-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-rose-50 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <XCircle size={15} /> Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline Rejection Submission Form */}
                {rejectId === req.id && (
                  <div className="mt-4 p-4 bg-rose-500/[0.02] rounded-2xl border border-red-500/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      type="text"
                      placeholder="Provide a brief reason for rejection..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="flex-1 px-4 py-2.5 text-sm border border-rose-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 bg-white font-medium"
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { handleReview(req.id, 'REJECTED', rejectReason); setRejectId(null); setRejectReason(''); }}
                        disabled={!rejectReason.trim() || actionLoading === req.id}
                        className="flex-1 sm:flex-none h-10 px-5 bg-red-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer shadow-sm shadow-red-600/10"
                      >
                        Submit
                      </button>
                      <button 
                        onClick={() => setRejectId(null)} 
                        className="h-10 px-4 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100/50 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination Controls */}
          {meta && (
            <DataTablePagination
              currentPage={page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
              totalCount={meta.total}
              pageSize={meta.limit}
              entityName="overtime requests"
              loading={loading}
            />
          )}
        </div>
      )}
    </div>
  );
}
