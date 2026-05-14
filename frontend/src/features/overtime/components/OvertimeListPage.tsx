import React, { useState } from 'react';
import { useOvertimeList } from '../hooks/useOvertimeList';
import { CheckCircle, XCircle, Search, Clock, Calendar } from 'lucide-react';

interface OvertimeListPageProps {
  role: 'admin' | 'manager' | 'hr';
  statusFilter?: string;
}

export function OvertimeListPage({ role, statusFilter }: OvertimeListPageProps) {
  const { requests, loading, actionLoading, handleReview } = useOvertimeList(role, statusFilter);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (loading) {
    return <div className="py-12 text-center text-slate-500 font-medium">Loading requests...</div>;
  }

  if (requests.length === 0) {
    return <div className="py-12 text-center text-slate-500 font-medium">No {statusFilter ? statusFilter.toLowerCase() : ''} requests found.</div>;
  }

  return (
    <div className="space-y-4">
      {requests.map(req => (
        <div key={req.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${
                  req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                  req.status === 'REJECTED' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                  'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                }`}>
                  {req.status}
                </span>
                <span className="text-sm font-bold text-slate-800">{req.employee.firstName} {req.employee.lastName}</span>
                <span className="text-xs text-slate-500 font-medium">{req.employee.Department?.name || 'No Dept'}</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 font-medium">
                <div className="flex items-center gap-1.5"><Calendar size={16} className="text-slate-400" /> {new Date(req.date).toLocaleDateString()}</div>
                <div className="flex items-center gap-1.5"><Clock size={16} className="text-slate-400" /> {req.startTime} to {req.endTime}</div>
              </div>

              <div className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="font-bold block mb-1">Reason:</span>
                {req.reason}
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
      ))}
    </div>
  );
}
