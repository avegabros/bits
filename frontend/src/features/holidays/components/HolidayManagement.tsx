'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, X, CalendarDays, Star, Flag } from 'lucide-react';
import { useHolidays, Holiday } from '../hooks/useHolidays';

interface HolidayFormData {
    name: string;
    date: string;
    description: string;
    type: 'REGULAR' | 'SPECIAL';
}

const emptyForm: HolidayFormData = { name: '', date: '', description: '', type: 'REGULAR' };

export function HolidayManagement({ role }: { role: 'admin' | 'hr' | 'user' }) {
    const isAdmin = role === 'admin';
    const [viewYear, setViewYear] = useState(new Date().getFullYear());
    const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);

    const { holidays, loading, createHoliday, updateHoliday, deleteHoliday } = useHolidays({ year: viewYear });

    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<HolidayFormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<Holiday | null>(null);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const holidayMap = useMemo(() => {
        const map = new Map<string, Holiday>();
        holidays.forEach(h => {
            const d = new Date(h.date).toISOString().split('T')[0];
            map.set(d, h);
        });
        return map;
    }, [holidays]);

    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth - 1, 1);
        const lastDay = new Date(viewYear, viewMonth, 0);
        const startPad = firstDay.getDay();
        const days: { date: Date; inMonth: boolean }[] = [];

        for (let i = startPad - 1; i >= 0; i--) {
            const d = new Date(viewYear, viewMonth - 1, -i);
            days.push({ date: d, inMonth: false });
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push({ date: new Date(viewYear, viewMonth - 1, i), inMonth: true });
        }
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ date: new Date(viewYear, viewMonth, i), inMonth: false });
        }
        return days;
    }, [viewYear, viewMonth]);

    const prevMonth = () => {
        if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const openCreate = (dateStr?: string) => {
        setEditingId(null);
        setForm({ ...emptyForm, date: dateStr || '' });
        setFormError('');
        setModalOpen(true);
    };
    const openEdit = (h: Holiday) => {
        setEditingId(h.id);
        setForm({ name: h.name, date: new Date(h.date).toISOString().split('T')[0], description: h.description || '', type: h.type });
        setFormError('');
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { setFormError('Name is required'); return; }
        if (!form.date) { setFormError('Date is required'); return; }
        setSaving(true);
        setFormError('');
        try {
            if (editingId) {
                await updateHoliday(editingId, form);
            } else {
                await createHoliday(form);
            }
            setModalOpen(false);
            setSelectedHoliday(null);
        } catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (h: Holiday) => {
        try {
            await deleteHoliday(h.id);
            setDeleteConfirm(null);
            setSelectedHoliday(null);
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const todayStr = new Date().toLocaleDateString('en-CA');

    // Upcoming holidays list (next 5)
    const upcoming = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return holidays
            .filter(h => new Date(h.date) >= now)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 5);
    }, [holidays]);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <CalendarDays className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-foreground tracking-tight">Holidays</h1>
                        <p className="text-xs text-muted-foreground font-medium">
                            {holidays.length} holiday{holidays.length !== 1 ? 's' : ''} in {viewYear}
                        </p>
                    </div>
                </div>
                {isAdmin && (
                    <button onClick={() => openCreate()} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                        <Plus className="w-4 h-4" /> Add Holiday
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    {/* Calendar Nav */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
                        <button onClick={prevMonth} className="p-2 hover:bg-secondary rounded-lg transition-colors"><ChevronLeft className="w-4 h-4 text-muted-foreground" /></button>
                        <h2 className="text-sm font-black text-foreground uppercase tracking-widest">{monthNames[viewMonth - 1]} {viewYear}</h2>
                        <button onClick={nextMonth} className="p-2 hover:bg-secondary rounded-lg transition-colors"><ChevronRight className="w-4 h-4 text-muted-foreground" /></button>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 border-b border-border">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="px-2 py-2.5 text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">{d}</div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-32">
                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-7">
                            {calendarDays.map((day, i) => {
                                const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
                                const holiday = holidayMap.get(dateStr);
                                const isToday = dateStr === todayStr;
                                const isSunday = day.date.getDay() === 0;

                                return (
                                    <div
                                        key={i}
                                        onClick={() => {
                                            if (holiday) setSelectedHoliday(holiday);
                                            else if (isAdmin && day.inMonth) openCreate(dateStr);
                                        }}
                                        className={`relative min-h-[80px] p-2 border-b border-r border-border/50 transition-all cursor-pointer group ${
                                            !day.inMonth ? 'bg-secondary/20 opacity-40' : 'hover:bg-secondary/30'
                                        } ${isToday ? 'ring-1 ring-inset ring-indigo-500/30 bg-indigo-500/5' : ''}`}
                                    >
                                        <span className={`text-xs font-bold ${isToday ? 'text-indigo-500' : isSunday ? 'text-red-400' : 'text-muted-foreground'}`}>
                                            {day.date.getDate()}
                                        </span>
                                        {holiday && (
                                            <div className={`mt-1 px-1.5 py-1 rounded-md text-[9px] font-bold leading-tight truncate ${
                                                holiday.type === 'REGULAR'
                                                    ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                            }`}>
                                                {holiday.name}
                                            </div>
                                        )}
                                        {isAdmin && !holiday && day.inMonth && (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Plus className="w-4 h-4 text-muted-foreground/40" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex items-center gap-6 px-6 py-3 border-t border-border bg-secondary/20">
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm bg-red-500/20 border border-red-500/30" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Regular Holiday</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/20 border border-amber-500/30" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Special Holiday</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Upcoming + Selected */}
                <div className="space-y-4">
                    {/* Selected Holiday Detail */}
                    {selectedHoliday && (
                        <div className="bg-card border border-border rounded-2xl shadow-sm p-5 space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                        selectedHoliday.type === 'REGULAR' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                                    }`}>
                                        {selectedHoliday.type === 'REGULAR' ? <Flag className="w-2.5 h-2.5" /> : <Star className="w-2.5 h-2.5" />}
                                        {selectedHoliday.type}
                                    </span>
                                    <h3 className="text-sm font-black text-foreground mt-2">{selectedHoliday.name}</h3>
                                    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                                        {new Date(selectedHoliday.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedHoliday(null)} className="p-1 hover:bg-secondary rounded-lg"><X className="w-4 h-4 text-muted-foreground" /></button>
                            </div>
                            {selectedHoliday.description && (
                                <p className="text-xs text-muted-foreground leading-relaxed">{selectedHoliday.description}</p>
                            )}
                            {isAdmin && (
                                <div className="flex gap-2 pt-2 border-t border-border">
                                    <button onClick={() => openEdit(selectedHoliday)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-[10px] font-bold text-foreground transition-colors">
                                        <Edit2 className="w-3 h-3" /> Edit
                                    </button>
                                    <button onClick={() => setDeleteConfirm(selectedHoliday)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-[10px] font-bold text-red-500 transition-colors">
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upcoming */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-border bg-secondary/30">
                            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Upcoming Holidays</h3>
                        </div>
                        <div className="divide-y divide-border">
                            {upcoming.length === 0 ? (
                                <div className="px-5 py-8 text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest">No upcoming holidays</div>
                            ) : (
                                upcoming.map(h => (
                                    <button key={h.id} onClick={() => setSelectedHoliday(h)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors text-left">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${h.type === 'REGULAR' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                                            {h.type === 'REGULAR' ? <Flag className="w-3.5 h-3.5 text-red-500" /> : <Star className="w-3.5 h-3.5 text-amber-500" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-foreground truncate">{h.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium">
                                                {new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                            <h3 className="text-sm font-black text-foreground">{editingId ? 'Edit Holiday' : 'Add Holiday'}</h3>
                            <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-secondary rounded-lg"><X className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {formError && <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500 font-bold">{formError}</div>}
                            <div>
                                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Holiday Name</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. New Year's Day" className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Date</label>
                                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Type</label>
                                <div className="flex gap-2">
                                    {(['REGULAR', 'SPECIAL'] as const).map(t => (
                                        <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${form.type === t ? (t === 'REGULAR' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30') : 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80'}`}>
                                            {t === 'REGULAR' ? '🔴 Regular' : '⭐ Special'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Description (optional)</label>
                                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional details..." className="w-full px-3 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 resize-none" />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
                            <button onClick={() => setModalOpen(false)} className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-xl text-xs font-bold text-muted-foreground transition-colors">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all active:scale-95">{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-sm font-black text-foreground">Delete Holiday?</h3>
                        <p className="text-xs text-muted-foreground">Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-xl text-xs font-bold text-muted-foreground transition-colors">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
