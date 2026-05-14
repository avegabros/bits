import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { AttendanceRecord, AttendanceConflict } from '../types';
import { toTimeInput } from '../utils/attendance-formatters';

interface AttendanceEditModalProps {
  editingLog: AttendanceRecord | null;
  setEditingLog: (val: AttendanceRecord | null) => void;
  role: 'admin' | 'hr' | 'manager';
  editCheckIn: string;
  setEditCheckIn: (val: string) => void;
  editCheckOut: string;
  setEditCheckOut: (val: string) => void;
  editReason: string;
  setEditReason: (val: string) => void;
  handleApplyChanges: (multiEdits?: any[]) => void;
  actionLoading: boolean;
  conflictErrors?: AttendanceConflict[];
}

export function AttendanceEditModal({
  editingLog,
  setEditingLog,
  role,
  editCheckIn,
  setEditCheckIn,
  editCheckOut,
  setEditCheckOut,
  editReason,
  setEditReason,
  handleApplyChanges,
  actionLoading,
  conflictErrors,
}: AttendanceEditModalProps) {
  const [mounted, setMounted] = useState(false);
  const [multiEdits, setMultiEdits] = useState<any[]>([]);
  const [localShowCancelModal, setLocalShowCancelModal] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (editingLog?.isMerged && editingLog.subRecords) {
      setMultiEdits(editingLog.subRecords.map(sr => ({
        id: sr.id,
        checkIn: toTimeInput(sr.checkIn),
        checkOut: toTimeInput(sr.checkOut),
        reason: '',
        isPending: !!sr.isPending,
        shiftName: sr.shiftName,
        shiftCode: sr.shiftCode,
        isAbsent: String(sr.id).startsWith('absent-'),
        employeeId: sr.employeeId,
        date: sr.date,
        isNightShift: sr.isNightShift
      })));
    } else {
      setMultiEdits([]);
    }
  }, [editingLog]);

  const updateMultiEdit = (index: number, field: string, value: string) => {
    setMultiEdits(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  if (!editingLog || !mounted) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
          <div className="p-4 sm:p-5 bg-red-600 text-white flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg leading-tight tracking-tight">Manual Time Changes</h3>
          </div>
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {editingLog.profilePicture ? (
                    <img 
                      src={editingLog.profilePicture} 
                      alt={editingLog.employeeName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(editingLog.employeeName)}&background=random`
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-black text-xs uppercase tracking-tighter border-2 border-white shadow-sm">
                      {editingLog.employeeName.charAt(0)}
                    </div>
                  )}
                </div>
                <p className="text-base font-black text-slate-800 tracking-tight leading-tight">{editingLog.employeeName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="px-2 py-1 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm">
                  {editingLog.department}
                </span>
                <span className="px-2 py-1 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm">
                  {editingLog.branchName}
                </span>
                {(editingLog.shiftName || editingLog.shiftCode) && (
                  <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm flex items-center gap-1.5">
                    <Clock size={12} className="text-blue-500" />
                    <span>{editingLog.shiftCode ?? editingLog.shiftName}</span>
                    {editingLog.shiftStartTime && editingLog.shiftEndTime && (
                      <span className="text-blue-600/70 font-semibold lowercase tracking-normal border-l border-blue-200 pl-1.5 ml-0.5">
                        {(() => {
                          const formatTime = (t: string) => {
                            const [h, m] = t.split(':');
                            const d = new Date();
                            d.setHours(Number(h), Number(m));
                            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
                          };
                          return `${formatTime(editingLog.shiftStartTime)} - ${formatTime(editingLog.shiftEndTime)}`;
                        })()}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
            {String(editingLog.id).startsWith('absent-') && (
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-amber-800">This employee has no existing attendance record for this day. Submitting this form will manually create a new record.</p>
              </div>
            )}
            {editingLog.isPending && (
              <div className="bg-[#FFF8E1] border border-[#FFE082] p-3 rounded-xl flex gap-3">
                <AlertCircle size={16} className="text-[#F57F17] shrink-0 mt-0.5" />
                <div className="text-[10px] text-[#F57F17]/80 leading-relaxed font-medium">
                  <strong className="block mb-0.5 text-[#F57F17] tracking-tight uppercase">Pending Request Exists</strong>
                  A pending adjustment is awaiting admin review. Cancel it first to submit a new one.
                </div>
              </div>
            )}
            {(editingLog.displayStatus === 'missing_checkout' || editingLog.status === 'incomplete') && !String(editingLog.id).startsWith('absent-') && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex gap-3">
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-amber-800 leading-relaxed font-medium">
                  <strong className="block mb-0.5 tracking-tight uppercase">Missing Checkout</strong>
                  This record has no recorded checkout time. Adding a checkout time will resolve this record and update the status automatically.
                </div>
              </div>
            )}
            {editingLog.notes?.includes('No checkout recorded') && (
              <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1">System Note</p>
                <p className="text-[10px] text-slate-600 font-medium">{editingLog.notes}</p>
              </div>
            )}
            {conflictErrors && conflictErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-2xl space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-600 shrink-0" />
                  <span className="text-[10px] font-black text-red-800 uppercase tracking-wider">
                    Attendance Conflict Detected
                  </span>
                </div>
                {conflictErrors.map((conflict, i) => (
                  <div key={i} className="flex items-start gap-2 pl-6">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <p className="text-[11px] text-red-700 font-medium leading-snug">
                      {conflict.message}
                    </p>
                  </div>
                ))}
                <p className="text-[10px] text-red-500/80 font-medium pl-6">
                  Please adjust the times to resolve conflicts before saving.
                </p>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex gap-3">
              <Clock size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-800 leading-relaxed font-medium">
                <strong className="block mb-0.5 tracking-tight uppercase">Auto-Computed Status</strong>
                Status will be automatically determined based on the employee&apos;s assigned shift schedule and the recorded time-in / time-out.
              </p>
            </div>
            {editingLog.isMerged ? (
              <div className="space-y-6">
                {multiEdits.map((edit, idx) => (
                  <div key={edit.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 relative">
                    <div className="absolute -top-3 left-4 bg-blue-500 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-widest shadow-sm">
                      {edit.shiftCode || edit.shiftName || `Shift ${idx + 1}`}
                    </div>
                    {edit.isPending && (
                      <div className="bg-[#FFF8E1] border border-[#FFE082] p-2 rounded-lg flex gap-2 mb-3 mt-1">
                        <AlertCircle size={14} className="text-[#F57F17] shrink-0 mt-0.5" />
                        <span className="text-[9px] text-[#F57F17]/80 font-medium uppercase tracking-tight">Pending request exists</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><Clock size={10} className="text-emerald-500" /> Clock In</label>
                        <input type="time" value={edit.checkIn} onChange={(e) => updateMultiEdit(idx, 'checkIn', e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><Clock size={10} className="text-red-500" /> Clock Out</label>
                        <input type="time" value={edit.checkOut} onChange={(e) => updateMultiEdit(idx, 'checkOut', e.target.value)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                      </div>
                    </div>
                    <div className="space-y-1 mt-3">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Reason <span className="text-red-500">*</span></label>
                      <textarea value={edit.reason} onChange={(e) => updateMultiEdit(idx, 'reason', e.target.value)}
                        placeholder="Reason for adjustment..."
                        className={`w-full p-3 bg-white border rounded-xl h-12 text-xs outline-none focus:ring-2 focus:ring-red-500/20 resize-none ${!edit.reason.trim() ? 'border-red-300' : 'border-slate-200'}`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><Clock size={10} className="text-emerald-500" /> Clock In</label>
                    <input type="time" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><Clock size={10} className="text-red-500" /> Clock Out</label>
                    <input type="time" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Reason for Adjustment <span className="text-red-500">*</span></label>
                  <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)}
                    placeholder="e.g., Biometric error, Official business..."
                    className={`w-full p-3 bg-slate-50 border rounded-xl h-16 text-xs outline-none focus:ring-2 focus:ring-red-500/20 resize-none ${!editReason.trim() ? 'border-red-300' : 'border-slate-200'}`} />
                  {!editReason.trim() && (
                    <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                      <AlertCircle size={10} />
                      Reason is required. Please provide a reason before submitting.
                    </p>
                  )}
                </div>
              </>
            )}

            {role === 'hr' || role === 'manager' ? (
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3 shadow-sm">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                  <strong className="block mb-0.5 tracking-tight uppercase">Approval Required</strong>
                  Your adjustment will be submitted for admin approval and logged under your account.
                </p>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex gap-3 shadow-sm">
                <AlertCircle size={18} className="text-red-700 shrink-0" />
                <p className="text-[10px] text-red-800 leading-relaxed font-medium">
                  <strong className="block mb-0.5 tracking-tight uppercase">Admin Override</strong>
                  This change will bypass the adjustment queue and update the record permanently.
                </p>
              </div>
            )}

          </div>
          <div className="p-4 sm:p-5 bg-slate-50 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 shrink-0">
            <button onClick={() => {
              let hasChanges = false;
              if (editingLog.isMerged) {
                hasChanges = multiEdits.some(edit => edit.reason.trim() !== '' || edit.checkIn !== toTimeInput(editingLog.subRecords?.find(sr => sr.id === edit.id)?.checkIn || '') || edit.checkOut !== toTimeInput(editingLog.subRecords?.find(sr => sr.id === edit.id)?.checkOut || ''));
              } else {
                const originalCheckIn = toTimeInput(editingLog.checkIn);
                const originalCheckOut = toTimeInput(editingLog.checkOut);
                hasChanges = editCheckIn !== originalCheckIn || editCheckOut !== originalCheckOut || editReason.trim() !== '';
              }
              
              if (hasChanges) {
                setLocalShowCancelModal(true);
              } else {
                setEditingLog(null);
              }
            }} className="flex-1 px-4 py-3 sm:py-3.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
            <button
              onClick={() => handleApplyChanges(editingLog.isMerged ? multiEdits : undefined)}
              disabled={actionLoading || (editingLog.isMerged ? multiEdits.some(e => !e.reason.trim()) : !editReason.trim()) || (editingLog.isMerged ? multiEdits.some(e => e.isPending) : editingLog.isPending)}
              className="flex-1 px-4 py-3 sm:py-3.5 bg-red-600 text-white rounded-xl text-sm font-black shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading && <Loader2 size={15} className="animate-spin" />}
              {String(editingLog.id).startsWith('absent-') ? 'Create Manual Record' : editingLog.isMerged ? 'Apply All Changes' : 'Apply Changes'}
            </button>
          </div>
        </div>
      </div>

      {localShowCancelModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Discard changes?</h3>
              <p className="text-sm font-medium text-slate-500">Your unsaved modifications will be lost.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setLocalShowCancelModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={() => { setEditingLog(null); setLocalShowCancelModal(false); }} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95">Yes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
