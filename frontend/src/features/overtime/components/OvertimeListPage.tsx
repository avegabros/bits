import React, { useState, useEffect } from 'react';
import { useOvertimeList } from '../hooks/useOvertimeList';
import { CheckCircle, XCircle, Search, Clock, Calendar, RotateCcw, Trash2, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react';

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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, setFilters]);

  const displayedRequests = hidePending ? requests.filter(r => r.status !== 'PENDING') : requests;

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
          <div className="text-slate-500 font-medium animate-pulse">Loading requests...</div>
        </div>
      ) : displayedRequests.length === 0 ? (
        <div className="py-12 text-center text-slate-500 font-medium bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
          No {statusFilter ? statusFilter.toLowerCase() : ''} requests found.
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRequests.map(req => {
            const extensionMatch = req.reason?.match(/^\[EXTENSION:(\d+)\]\s*(.*)$/);
            const displayReason = extensionMatch ? extensionMatch[2] : req.reason;

            return (
            <div key={req.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${
                        req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                        req.status === 'REJECTED' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                        req.status === 'DELETED' ? 'bg-slate-500/10 text-slate-600 border-slate-500/20' :
                        'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                      }`}>
                        {req.status}
                      </span>
                      {req.source === 'ASSIGNED' && (
                        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border bg-blue-500/10 text-blue-600 border-blue-500/20 flex items-center gap-1">
                          <UserPlus size={12} /> Assigned
                        </span>
                      )}
                      {extensionMatch && (
                        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border bg-purple-500/10 text-purple-600 border-purple-500/20">
                          Extension
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{req.employee.firstName} {req.employee.lastName}</span>
                      <span className="text-xs text-slate-500 font-medium">{req.employee.Department?.name || 'No Dept'}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 font-medium">
                    <div className="flex items-center gap-1.5"><Calendar size={16} className="text-slate-400" /> {new Date(req.date).toLocaleDateString()}</div>
                    <div className="flex items-center gap-1.5"><Clock size={16} className="text-slate-400" /> {req.startTime} to {req.endTime}</div>
                  </div>

                  <div className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-bold block mb-1">Reason:</span>
                    {displayReason}
                  </div>

                  {req.status === 'REJECTED' && req.rejectionReason && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                      <span className="font-bold block mb-1">Rejection Reason:</span>
                      {req.rejectionReason}
                    </div>
                  )}
                </div>

                {req.status === 'PENDING' && (
                  <div className="flex items-center gap-2 md:self-start">
                    <button
                      onClick={() => handleReview(req.id, 'APPROVED')}
                      disabled={actionLoading === req.id}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center gap-2"
                    >
                      <CheckCircle size={16} /> Approve
                    </button>
                    <button
                      onClick={() => setRejectId(req.id)}
                      disabled={actionLoading === req.id}
                      className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-all flex items-center gap-2"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                )}

                {req.status !== 'PENDING' && (
                  <div className="flex items-center gap-2 md:self-start mt-4 md:mt-0">
                    <button
                      onClick={() => handleReview(req.id, 'PENDING')}
                      disabled={actionLoading === req.id}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-sm"
                      title={req.status === 'DELETED' ? "Restore to Pending status" : "Revert back to Pending status"}
                    >
                      <RotateCcw size={14} /> {req.status === 'DELETED' ? 'Restore' : 'Revert'}
                    </button>
                    {req.status !== 'DELETED' && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to completely delete this overtime request?')) {
                            handleDelete(req.id);
                          }
                        }}
                        disabled={actionLoading === req.id}
                        className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-all flex items-center gap-1.5 shadow-sm"
                        title="Move to Deleted History"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {rejectId === req.id && (
                <div className="mt-4 p-4 bg-red-50/50 rounded-xl border border-red-100 flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Reason for rejection..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="flex-1 px-4 py-2 text-sm border border-red-200 rounded-lg outline-none focus:ring-2 ring-red-500/20"
                  />
                  <button 
                    onClick={() => { handleReview(req.id, 'REJECTED', rejectReason); setRejectId(null); setRejectReason(''); }}
                    disabled={!rejectReason.trim() || actionLoading === req.id}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Submit Rejection
                  </button>
                  <button onClick={() => setRejectId(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800">
                    Cancel
                  </button>
                </div>
              )}
            </div>
            );
          })}

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
        </div>
      )}
    </div>
  );
}
