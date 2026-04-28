import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { AttendanceRecord } from '../types';

interface AttendanceEditModalProps {
  editingLog: AttendanceRecord | null;
  setEditingLog: (val: AttendanceRecord | null) => void;
  role: 'admin' | 'hr';
  editCheckIn: string;
  setEditCheckIn: (val: string) => void;
  editCheckOut: string;
  setEditCheckOut: (val: string) => void;
  editReason: string;
  setEditReason: (val: string) => void;
  showCancelModal: boolean;
  setShowCancelModal: (val: boolean) => void;
  handleApplyChanges: () => void;
  actionLoading: boolean;
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
  showCancelModal,
  setShowCancelModal,
  handleApplyChanges,
  actionLoading,
}: AttendanceEditModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!editingLog || !mounted) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
          <div className="p-5 bg-red-600 text-white flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg leading-tight tracking-tight">Manual Time Changes</h3>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-sm font-bold text-slate-800 leading-none">{editingLog.employeeName}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                {editingLog.department} • {editingLog.branchName}
                {editingLog.shiftCode && <span className="ml-2">• {editingLog.shiftCode}</span>}
              </p>
            </div>
            {String(editingLog.id).startsWith('absent-') && (
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-3">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-amber-800">This employee has no existing attendance record for this day. Submitting this form will manually create a new record.</p>
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
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex gap-3">
              <Clock size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-800 leading-relaxed font-medium">
                <strong className="block mb-0.5 tracking-tight uppercase">Auto-Computed Status</strong>
                Status will be automatically determined based on the employee&apos;s assigned shift schedule and the recorded time-in / time-out.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
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

            {role === 'hr' ? (
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
          <div className="p-5 bg-slate-50 flex gap-3 shrink-0">
            <button onClick={() => setShowCancelModal(true)} className="flex-1 px-4 py-3.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
            <button
              onClick={handleApplyChanges}
              disabled={actionLoading || !editReason.trim()}
              className="flex-1 px-4 py-3.5 bg-red-600 text-white rounded-xl text-sm font-black shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading && <Loader2 size={15} className="animate-spin" />}
              {String(editingLog.id).startsWith('absent-') ? 'Create Manual Record' : 'Apply Changes'}
            </button>
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center space-y-4">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Discard changes?</h3>
              <p className="text-sm font-medium text-slate-500">Your unsaved modifications will be lost.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCancelModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={() => { setEditingLog(null); setShowCancelModal(false); }} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95">Yes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
