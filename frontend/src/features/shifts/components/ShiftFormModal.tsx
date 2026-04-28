import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Clock, Plus, Trash2, Moon, X as XIcon, AlertTriangle, Coffee
} from 'lucide-react'
import { DAYS } from '../types'
import type { ShiftFormData, Shift } from '../types'
import { formatTime, calcDuration, calcFormBreaks, getBreakError } from '../utils/shift-formatters'

interface ShiftFormModalProps {
  isFormOpen: boolean
  editingShift: Shift | null
  form: ShiftFormData
  setForm: React.Dispatch<React.SetStateAction<ShiftFormData>>
  formLoading: boolean
  formError: string
  hasInvalidBreaks: boolean
  onClose: () => void
  onSubmit: () => void
}

export function ShiftFormModal({
  isFormOpen, editingShift, form, setForm,
  formLoading, formError, hasInvalidBreaks,
  onClose, onSubmit,
}: ShiftFormModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!isFormOpen || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[150] flex items-center justify-center sm:p-4">
      <div className="bg-white sm:rounded-3xl shadow-2xl w-full h-full sm:h-auto max-w-lg overflow-hidden flex flex-col sm:max-h-[90vh]">
        <div className="p-5 bg-red-600 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-lg leading-tight tracking-tight">
              {editingShift ? 'Edit Shift' : 'New Shift'}
            </h3>
            <p className="text-[10px] text-red-100 opacity-90 uppercase font-black tracking-widest mt-0.5">
              {editingShift ? 'Modify shift schedule' : 'Create a shift schedule'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs font-bold text-red-700">{formError}</div>
          )}
          {/* Shift Code + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Shift Code</label>
              <input
                type="text" placeholder="e.g. MS-01"
                value={form.shiftCode}
                onChange={e => setForm(f => ({ ...f, shiftCode: e.target.value.toUpperCase() }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none tracking-wider"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Shift Name</label>
              <input
                type="text" placeholder="e.g. Morning Shift"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none"
              />
            </div>
          </div>

          {/* Start + End Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Start Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">End Time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none"
              />
            </div>
          </div>

          {/* Grace Period + Break Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Grace Period (mins)</label>
              <input
                type="number" min={0} max={60} placeholder="0"
                value={form.graceMinutes}
                onChange={e => setForm(f => ({ ...f, graceMinutes: parseInt(e.target.value) || 0 }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">Total Breaks (mins)</label>
              <div className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 flex items-center justify-between">
                <span>Auto-calculated</span>
                <span className="text-red-600 font-black">
                  {form.breaks.reduce((acc, b) => {
                    if (!b.start || !b.end) return acc;
                    const [startH, startM] = b.start.split(':').map(Number);
                    const [endH, endM] = b.end.split(':').map(Number);
                    let diff = (endH * 60 + endM) - (startH * 60 + startM);
                    if (diff < 0) diff += 24 * 60;
                    return acc + diff;
                  }, 0)}m
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Breaks Sections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black uppercase text-slate-400">Scheduled Breaks</label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, breaks: [...f.breaks, { start: '', end: '', name: 'Break' }] }))}
                className="text-[10px] font-bold text-red-600 flex items-center gap-1 hover:text-red-700 active:scale-95 transition-all"
              >
                <Plus size={12} /> Add Break
              </button>
            </div>
            {form.breaks.length === 0 ? (
              <div className="w-full p-3 bg-amber-50 rounded-xl border border-amber-200 text-center text-xs font-bold text-amber-600 flex items-center justify-center gap-2">
                <AlertTriangle size={14} /> No breaks defined
              </div>
            ) : (
              <div className="space-y-2">
                {form.breaks.map((b, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                      <input
                        type="text" placeholder="Break Name" value={b.name}
                        onChange={e => setForm(f => {
                          const newBreaks = [...f.breaks];
                          newBreaks[i].name = e.target.value;
                          return { ...f, breaks: newBreaks };
                        })}
                        className="w-1/3 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
                      />
                      <input
                        type="time" value={b.start}
                        onChange={e => setForm(f => {
                          const newBreaks = [...f.breaks];
                          newBreaks[i].start = e.target.value;
                          return { ...f, breaks: newBreaks };
                        })}
                        className={`w-1/3 p-2 bg-white border rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20 ${getBreakError(b, form.startTime, form.endTime) ? 'border-red-400' : 'border-slate-200'}`}
                      />
                      <span className="text-slate-400 font-bold">-</span>
                      <input
                        type="time" value={b.end}
                        onChange={e => setForm(f => {
                          const newBreaks = [...f.breaks];
                          newBreaks[i].end = e.target.value;
                          return { ...f, breaks: newBreaks };
                        })}
                        className={`w-1/3 p-2 bg-white border rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20 ${getBreakError(b, form.startTime, form.endTime) ? 'border-red-400' : 'border-slate-200'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, breaks: f.breaks.filter((_, index) => index !== i) }))}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {getBreakError(b, form.startTime, form.endTime) && (
                      <p className="text-[11px] text-red-500 font-semibold ml-1">{getBreakError(b, form.startTime, form.endTime)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Night Shift toggle */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Moon size={15} className="text-indigo-500" />
              <div>
                <p className="text-xs font-bold text-slate-700">Overnight / Night Shift</p>
                <p className="text-[10px] text-slate-400">Enable if shift crosses midnight</p>
              </div>
            </div>
            <button onClick={() => setForm(f => ({ ...f, isNightShift: !f.isNightShift }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.isNightShift ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isNightShift ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400">Description (optional)</label>
            <textarea
              placeholder="Brief description of this shift..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-red-500/20 outline-none resize-none"
            />
          </div>

          {/* Work Days */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase text-slate-400">Work Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => {
                const isWeekend = day === 'Sat' || day === 'Sun'
                const active = form.workDays.includes(day)
                const isHalf = form.halfDays.includes(day)
                return (
                  <div key={day} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        workDays: active
                          ? f.workDays.filter(d => d !== day)
                          : [...f.workDays, day],
                        halfDays: active ? f.halfDays.filter(d => d !== day) : f.halfDays,
                      }))}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border ${active
                        ? isWeekend
                          ? 'bg-red-100 border-red-300 text-red-700'
                          : 'bg-red-600 border-red-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                    >
                      {day}
                    </button>
                    {active && (
                      <button
                        type="button"
                        title={isHalf ? 'Full day — click to remove' : 'Mark as half day'}
                        onClick={() => setForm(f => ({
                          ...f,
                          halfDays: isHalf
                            ? f.halfDays.filter(d => d !== day)
                            : [...f.halfDays, day]
                        }))}
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-md transition-all ${isHalf
                          ? 'bg-orange-400 text-white'
                          : 'bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-500'
                          }`}
                      >
                        ½
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {form.workDays.length} day(s) selected
              {form.halfDays.length > 0 && <span className="text-orange-500 font-bold"> · Half days: {form.halfDays.join(', ')}</span>}
              {' '}· Rest days: {DAYS.filter(d => !form.workDays.includes(d)).join(', ') || 'None'}
            </p>
            {form.halfDays.length > 0 && (
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-700">Half-Day Expected Hours</p>
                  <p className="text-[9px] text-slate-400">If blank, defaults to shift midpoint</p>
                </div>
                <input
                  type="number" min={0} step={0.5} max={24} placeholder="e.g. 4.5"
                  value={form.halfDayHours ?? ''}
                  onChange={e => setForm(f => ({ ...f, halfDayHours: e.target.value ? parseFloat(e.target.value) : null }))}
                  className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            )}
          </div>

          {/* Preview */}
          {(form.startTime && form.endTime) && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3">
              <Clock size={16} className="text-red-500 shrink-0" />
              <div className="text-xs text-red-700 font-bold">
                {formatTime(form.startTime)} → {formatTime(form.endTime)}
                <span className="text-red-400 font-medium ml-2">({calcDuration(form.startTime, form.endTime, form.isNightShift)} total · {calcFormBreaks(form.breaks, form.breakMinutes)}m break)</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-slate-50 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-3.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Discard</button>
          <button onClick={onSubmit} disabled={formLoading || hasInvalidBreaks} className="flex-1 px-4 py-3.5 bg-red-600 text-white rounded-xl text-sm font-black shadow-lg shadow-red-600/30 hover:bg-red-700 disabled:opacity-70 transition-all active:scale-95">
            {formLoading ? 'Saving…' : editingShift ? 'Save Changes' : 'Create Shift'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
