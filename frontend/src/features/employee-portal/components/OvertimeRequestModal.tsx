import React, { useState, useEffect } from 'react';
import { X, Clock, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { OvertimeRequest } from '@/features/overtime/types';

interface OvertimeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: number;
}

export function OvertimeRequestModal({ isOpen, onClose, employeeId }: OvertimeRequestModalProps) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [approvedOtsToday, setApprovedOtsToday] = useState<OvertimeRequest[]>([]);
  const [extendingOtId, setExtendingOtId] = useState<number | null>(null);

  // Fetch approved OTs for today when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchApprovedOts = async () => {
        try {
          const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
          const res = await apiFetch<{ success: boolean; requests: OvertimeRequest[] }>(
            `/api/attendance/overtime?status=APPROVED&date=${todayStr}`
          );
          if (res.success) {
            setApprovedOtsToday(res.requests);
          }
        } catch (err) {
          console.error("Failed to fetch today's approved OTs:", err);
        }
      };
      fetchApprovedOts();
    } else {
      // Reset extension states when closing
      setApprovedOtsToday([]);
      setExtendingOtId(null);
    }
  }, [isOpen]);

  const handleSelectExtension = (ot: OvertimeRequest) => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    setExtendingOtId(ot.id);
    setDate(todayStr);
    setStartTime(ot.endTime);
    setEndTime('');
    setReason('');
    setError(null);
  };

  const handleCancelExtension = () => {
    setExtendingOtId(null);
    setDate('');
    setStartTime('');
    setEndTime('');
    setReason('');
    setError(null);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !endTime || !reason) {
      setError('Please fill out all fields.');
      return;
    }
    // Zero-duration check
    if (startTime === endTime) {
      setError('Start time and end time cannot be the same.');
      return;
    }
    // Past-date check
    const todayPHT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    if (date < todayPHT) {
      setError('Cannot request overtime for a past date.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      
      const payloadReason = extendingOtId 
        ? `[EXTENSION:${extendingOtId}] ${reason}`
        : reason;

      const res = await apiFetch<{ success: boolean; message: string }>('/api/attendance/overtime', {
        method: 'POST',
        body: JSON.stringify({
          employeeId,
          date,
          startTime,
          endTime,
          reason: payloadReason
        })
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setDate('');
          setStartTime('');
          setEndTime('');
          setReason('');
          setExtendingOtId(null);
        }, 2000);
      } else {
        setError(res.message || 'Failed to submit request.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Server error.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Request Overtime
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[80vh]">
          {success ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <Clock className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Request Submitted!</h3>
              <p className="text-sm text-slate-500 mt-1">Your overtime request has been sent to your manager for approval.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {extendingOtId ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-xs flex justify-between items-center mb-2">
                  <div>
                    <span className="font-bold block">Extension Request Mode</span>
                    <span>Extending your overtime ending at {startTime}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleCancelExtension}
                    className="text-xs font-bold text-amber-600 hover:text-amber-800 underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : approvedOtsToday.length > 0 ? (
                <div className="space-y-2 mb-2">
                  <span className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Overtime Today</span>
                  {approvedOtsToday.map(ot => (
                    <div key={ot.id} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-emerald-800 text-xs flex justify-between items-center">
                      <div className="min-w-0 mr-2">
                        <span className="font-bold block">Approved OT: {ot.startTime} - {ot.endTime}</span>
                        <span className="text-[10px] text-emerald-600/80 truncate block">{ot.reason}</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleSelectExtension(ot)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition-all text-[10px] whitespace-nowrap"
                      >
                        Request Extension
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1.5">Date <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  disabled={extendingOtId !== null}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1.5">Start Time <span className="text-red-500">*</span></label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)} 
                    disabled={extendingOtId !== null}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1.5">End Time <span className="text-red-500">*</span></label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 tracking-widest mb-1.5">Reason for Overtime <span className="text-red-500">*</span></label>
                <textarea 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)} 
                  placeholder={extendingOtId ? "Why are you extending your overtime?" : "Why are you requesting overtime?"}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all min-h-[80px] resize-none"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
