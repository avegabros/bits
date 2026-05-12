import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Clock, Plus, Trash2, Moon, X as XIcon, AlertTriangle, Coffee
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
  return (
    <Dialog open={isFormOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="bg-white/90 backdrop-blur-2xl border border-white/40 max-w-lg p-0 rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-black/5">
        <div className="relative px-8 pt-8 pb-6 flex items-start justify-between shrink-0">
          <div className="space-y-1">
            <DialogTitle className="text-slate-900 font-poppins font-bold text-2xl tracking-tight">
              {editingShift ? 'Edit Shift' : 'New Shift'}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs font-medium tracking-wide">
              {editingShift ? 'Customize the timing and details of this shift schedule.' : 'Define a new shift schedule for your team.'}
            </DialogDescription>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full bg-slate-100/80 text-slate-400 hover:text-slate-600 hover:bg-slate-200/80 transition-all active:scale-90 shadow-sm ring-1 ring-black/5"
          >
            <XIcon className="w-5 h-5" />
          </button>
          
          {/* Subtle Accent Line */}
          <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>

        <div className="px-8 py-6 space-y-6 max-h-[65vh] overflow-y-auto scrollbar-light">
          {formError && (
            <div className="bg-red-50/80 backdrop-blur-sm border border-red-100 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="w-1.5 h-8 bg-red-500 rounded-full shrink-0" />
              <p className="text-xs font-semibold text-red-700">{formError}</p>
            </div>
          )}

          {/* Shift Identification */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Shift Code</label>
              <div className="relative group">
                <input
                  type="text" placeholder="e.g. MS-01"
                  value={form.shiftCode}
                  onChange={e => setForm(f => ({ ...f, shiftCode: e.target.value.toUpperCase() }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none group-hover:border-slate-300"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Shift Name</label>
              <div className="relative group">
                <input
                  type="text" placeholder="e.g. Morning Shift"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none group-hover:border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Description (Optional)</label>
            <textarea
              placeholder="Briefly describe the purpose of this shift..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 transition-all focus:bg-white focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none resize-none hover:border-slate-300"
            />
          </div>

          {/* Timing & Duration */}
          <div className="bg-slate-50/40 rounded-[1.5rem] p-5 border border-slate-100 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Start Time</label>
                <div className="relative">
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                  />
                  <Clock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">End Time</label>
                <div className="relative">
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                  />
                  <Clock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Grace Period (mins)</label>
                <input
                  type="number" min={0} max={60} placeholder="0"
                  value={form.graceMinutes}
                  onChange={e => setForm(f => ({ ...f, graceMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Total Breaks</label>
                <div className="w-full px-4 py-3 bg-white/50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Auto-calculated</span>
                  <div className="flex items-center gap-1.5 bg-brand/5 px-2.5 py-1 rounded-lg">
                    <Coffee size={12} className="text-brand" />
                    <span className="text-brand font-bold text-sm">
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
            </div>
          </div>

          {/* Scheduled Breaks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Coffee size={14} className="text-slate-400" />
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scheduled Breaks</label>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, breaks: [...f.breaks, { start: '', end: '', name: 'Break' }] }))}
                className="group flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-brand hover:text-white rounded-full text-[10px] font-bold text-slate-600 transition-all active:scale-95 shadow-sm"
              >
                <Plus size={12} className="group-hover:rotate-90 transition-transform" /> Add Break
              </button>
            </div>

            {form.breaks.length === 0 ? (
              <div className="w-full py-8 bg-slate-50/50 rounded-[1.5rem] border border-dashed border-slate-200 text-center space-y-2">
                <div className="mx-auto w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <Coffee size={20} className="text-slate-300" />
                </div>
                <p className="text-xs font-medium text-slate-400">No breaks scheduled for this shift</p>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-500">
                {form.breaks.map((b, i) => (
                  <div key={i} className="group relative flex flex-col gap-2 p-4 bg-white border border-slate-200 rounded-[1.25rem] shadow-sm hover:shadow-md hover:border-brand/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 space-y-1">
                        <input
                          type="text" placeholder="Break Name" value={b.name}
                          onChange={e => setForm(f => {
                            const newBreaks = [...f.breaks];
                            newBreaks[i].name = e.target.value;
                            return { ...f, breaks: newBreaks };
                          })}
                          className="w-full bg-transparent border-none p-0 text-xs font-bold text-slate-700 placeholder:text-slate-300 focus:ring-0 outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="time" value={b.start}
                            onChange={e => setForm(f => {
                              const newBreaks = [...f.breaks];
                              newBreaks[i].start = e.target.value;
                              return { ...f, breaks: newBreaks };
                            })}
                            className={`flex-1 p-2 bg-slate-50 border rounded-xl text-[11px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand/20 ${getBreakError(b, form.startTime, form.endTime) ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}
                          />
                          <span className="text-slate-300 font-bold">→</span>
                          <input
                            type="time" value={b.end}
                            onChange={e => setForm(f => {
                              const newBreaks = [...f.breaks];
                              newBreaks[i].end = e.target.value;
                              return { ...f, breaks: newBreaks };
                            })}
                            className={`flex-1 p-2 bg-slate-50 border rounded-xl text-[11px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand/20 ${getBreakError(b, form.startTime, form.endTime) ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, breaks: f.breaks.filter((_, index) => index !== i) }))}
                        className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {getBreakError(b, form.startTime, form.endTime) && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-lg">
                        <AlertTriangle size={10} className="text-red-500" />
                        <p className="text-[10px] text-red-600 font-bold">{getBreakError(b, form.startTime, form.endTime)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Night Shift toggle */}
          <div className="flex items-center justify-between bg-indigo-50/40 border border-indigo-100 rounded-[1.5rem] p-5 transition-all hover:bg-indigo-50/60">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                <Moon size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Overnight Shift</p>
                <p className="text-[11px] text-slate-500 font-medium">Enable if the schedule crosses midnight</p>
              </div>
            </div>
            <button 
              onClick={() => setForm(f => ({ ...f, isNightShift: !f.isNightShift }))}
              className={`relative w-12 h-7 rounded-full transition-all duration-300 ${form.isNightShift ? 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${form.isNightShift ? 'translate-x-5' : 'translate-x-0'}`}>
                {form.isNightShift && <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />}
              </div>
            </button>
          </div>

          {/* Work Days */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Work Days</label>
              <p className="text-[10px] text-slate-400 font-bold">
                {form.workDays.length} Selected
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2.5">
              {DAYS.map(day => {
                const isWeekend = day === 'Sat' || day === 'Sun'
                const active = form.workDays.includes(day)
                const isHalf = form.halfDays.includes(day)
                return (
                  <div key={day} className="flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        workDays: active
                          ? f.workDays.filter(d => d !== day)
                          : [...f.workDays, day],
                        halfDays: active ? f.halfDays.filter(d => d !== day) : f.halfDays,
                      }))}
                      className={`w-11 h-11 rounded-2xl text-[11px] font-black transition-all border flex items-center justify-center relative overflow-hidden ${active
                        ? isWeekend
                          ? 'bg-red-50 border-red-200 text-red-600 shadow-sm'
                          : 'bg-brand border-brand text-white shadow-lg shadow-brand/20 scale-105 z-10'
                        : 'bg-slate-50/50 border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-white'
                        }`}
                    >
                      {day}
                      {active && !isWeekend && <div className="absolute top-0 right-0 w-2 h-2 bg-white/20 rounded-bl-lg" />}
                    </button>
                    {active && (
                      <button
                        type="button"
                        title={isHalf ? 'Full day' : 'Mark as half day'}
                        onClick={() => setForm(f => ({
                          ...f,
                          halfDays: isHalf
                            ? f.halfDays.filter(d => d !== day)
                            : [...f.halfDays, day]
                        }))}
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full transition-all border ${isHalf
                          ? 'bg-orange-500 border-orange-600 text-white shadow-sm'
                          : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200'
                          }`}
                      >
                        {isHalf ? '½ Day' : 'Full'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {form.halfDays.length > 0 && (
              <div className="pt-4 px-4 pb-4 bg-orange-50/40 border border-orange-100 rounded-2xl space-y-3 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-orange-800">Half-Day Hours</p>
                    <p className="text-[10px] text-orange-600/70 font-medium italic">Defaults to midpoint if left empty</p>
                  </div>
                  <div className="relative">
                    <input
                      type="number" min={0} step={0.5} max={24} placeholder="8.0"
                      value={form.halfDayHours ?? ''}
                      onChange={e => setForm(f => ({ ...f, halfDayHours: e.target.value ? parseFloat(e.target.value) : null }))}
                      className="w-20 p-2.5 bg-white border border-orange-200 rounded-xl text-xs font-bold text-orange-700 outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all text-center"
                    />
                    <span className="absolute -right-5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-400">hrs</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {(form.startTime && form.endTime) && (
            <div className="bg-slate-900 rounded-[1.75rem] p-6 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand/20 transition-colors" />
              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-brand rounded-full shadow-[0_0_8px_#E60000]" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Shift Preview</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-poppins font-bold tracking-tight">{formatTime(form.startTime)}</span>
                    <span className="text-slate-600 font-bold">→</span>
                    <span className="text-xl font-poppins font-bold tracking-tight">{formatTime(form.endTime)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-poppins font-black text-white leading-none">
                    {calcDuration(form.startTime, form.endTime, form.isNightShift)}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Total Duration</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Coffee size={12} className="text-slate-500" />
                    <span className="text-[11px] font-bold text-slate-400">{calcFormBreaks(form.breaks, form.breakMinutes)}m Break</span>
                  </div>
                  <div className="w-1 h-1 bg-slate-700 rounded-full" />
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-slate-500" />
                    <span className="text-[11px] font-bold text-slate-400">{form.graceMinutes}m Grace</span>
                  </div>
                </div>
                <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400">
                    {DAYS.filter(d => !form.workDays.includes(d)).length} Rest Days
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-4 px-8 py-6 bg-slate-50/50 backdrop-blur-md border-t border-slate-100 shrink-0">
          <button 
            onClick={onClose} 
            className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors active:scale-95"
          >
            Discard
          </button>
          <button 
            onClick={onSubmit} 
            disabled={formLoading || hasInvalidBreaks} 
            className="flex-1 max-w-[200px] px-6 py-3.5 bg-brand text-white rounded-2xl text-sm font-bold shadow-xl shadow-brand/20 hover:bg-brand-dark disabled:opacity-50 disabled:grayscale transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
          >
            {formLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{editingShift ? 'Save Changes' : 'Create Shift'}</span>
                <Plus size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
