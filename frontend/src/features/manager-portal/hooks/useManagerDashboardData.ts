'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAttendanceStream, AttendanceStreamPayload } from '@/features/attendance/hooks/useAttendanceStream';

export interface LiveRecord {
    id: string;
    employee: string;
    department: string;
    branch: string;
    eventType: 'check-in' | 'check-out' | 'delete';
    time: string;
    eventTs: number;
    status: 'on-time' | 'late' | 'absent' | 'undertime' | 'deleted';
    shiftType: string;
}

export interface WeekDay {
    day: string;
    present: number;
    late: number;
    absent: number;
}

export interface ManagerDashboardState {
    activity: LiveRecord[];
    weeklyData: WeekDay[];
    totalEmployees: number;
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalHoliday: number;
    holidayName: string | null;
    activityScrollRef: React.RefObject<HTMLDivElement | null>;
    myDepartments: { id: number; name: string }[];
    departmentFilter: number | null | 'company';
    setDepartmentFilter: (id: number | null | 'company') => void;
}

const phtStr = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekDates(): { day: string; date: Date }[] {
    const now = new Date();
    const todayIndex = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((todayIndex === 0 ? 7 : todayIndex) - 1));
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return { day: dayNames[d.getDay()], date: d };
    });
}

export function useManagerDashboardData() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const activityScrollRef = useRef<HTMLDivElement>(null);

    const [activity, setActivity] = useState<LiveRecord[]>([]);
    const [weeklyData, setWeeklyData] = useState<WeekDay[]>([]);
    const [totalEmployees, setTotalEmployees] = useState(0);
    const [totalPresent, setTotalPresent] = useState(0);
    const [totalLate, setTotalLate] = useState(0);
    const [totalAbsent, setTotalAbsent] = useState(0);
    const [totalHoliday, setTotalHoliday] = useState(0);
    const [holidayName, setHolidayName] = useState<string | null>(null);
    const [myDepartments, setMyDepartments] = useState<{ id: number; name: string }[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState<number | null | 'company'>(null);

    const load = useCallback(async () => {
        try {
            const todayStr = phtStr(new Date());
            const weekDates = getWeekDates();
            const weekStart = phtStr(weekDates[0].date);
            const weekEnd = phtStr(weekDates[6].date);

            const scopeQuery = departmentFilter === 'company' ? '&scope=company' : '';

            const [eRes, aRes, wRes, hRes, dRes] = await Promise.all([
                fetch(`/api/employees?limit=5000${scopeQuery}`, { credentials: 'include' }),
                fetch(`/api/attendance?startDate=${todayStr}&endDate=${todayStr}&limit=5000${scopeQuery}`, { credentials: 'include' }),
                fetch(`/api/attendance?startDate=${weekStart}&endDate=${weekEnd}&limit=5000${scopeQuery}`, { credentials: 'include' }),
                fetch(`/api/holidays?year=${new Date().getFullYear()}`, { credentials: 'include' }),
                fetch(`/api/me/departments`, { credentials: 'include' }),
            ]);
            if (eRes.status === 401) { router.replace('/login'); return; }

            const ed = await eRes.json();
            const ad = await aRes.json();
            const wd = await wRes.json();
            const hd = hRes.ok ? await hRes.json() : { success: false };
            const dd = dRes.ok ? await dRes.json() : { success: false, departments: [] };

            if (dd.success) {
                setMyDepartments(dd.departments || []);
            }

            const holidayList: { date: string; name: string }[] = hd.success ? (hd.holidays || []) : [];
            const holidayDateSet = new Set(holidayList.map(h => new Date(h.date).toISOString().split('T')[0]));
            const todayHoliday = holidayList.find(h => new Date(h.date).toISOString().split('T')[0] === todayStr);
            setHolidayName(todayHoliday?.name ?? null);

            const allEmps: any[] = ed.success ? (ed.employees || ed.data || []) : [];
            const emps = allEmps.filter((e: any) => {
                if (e.role !== 'USER' && e.role) return false;
                if (departmentFilter && departmentFilter !== 'company' && e.departmentId !== departmentFilter) return false;
                return true;
            });
            const atts: any[] = (ad.success ? (ad.data || []) : []).filter((a: any) => {
                const emp = a.employee || a.Employee || {};
                if (emp.role !== 'USER' && emp.role) return false;
                if (a.status === 'pending') return false;
                if (departmentFilter && departmentFilter !== 'company' && emp.departmentId !== departmentFilter && emp.Department?.id !== departmentFilter) return false;
                return true;
            });
            const weekAtts: any[] = (wd.success ? (wd.data || []) : []).filter((a: any) => {
                const emp = a.employee || a.Employee || {};
                if (emp.role !== 'USER' && emp.role) return false;
                if (a.status === 'pending') return false;
                if (departmentFilter && departmentFilter !== 'company' && emp.departmentId !== departmentFilter && emp.Department?.id !== departmentFilter) return false;
                return true;
            });

            const activeEmps = emps.filter((e: any) => e.employmentStatus === 'ACTIVE');
            const activeCount = activeEmps.length;
            setTotalEmployees(activeCount);

            const todayPHTStr = phtStr(new Date());
            const weeklyAll: WeekDay[] = weekDates.map(({ day, date }) => {
                const dateStr = phtStr(date);
                const dayAtts = weekAtts.filter(a => {
                    const recDate = a.date ? phtStr(new Date(a.date)) : '';
                    return recDate === dateStr;
                });

                const late = dayAtts.filter(a => a.checkInTime && a.lateMinutes > 0).length;
                const onTime = dayAtts.filter(a => a.checkInTime && (a.lateMinutes ?? 0) === 0).length;
                const totalCheckedIn = onTime + late;
                const isDateHoliday = holidayDateSet.has(dateStr);
                const eligibleCount = activeEmps.filter((e: any) => {
                    if (!e.hireDate) return true;
                    return phtStr(new Date(e.hireDate)) <= dateStr;
                }).length;
                const absent = isDateHoliday ? 0 : (dateStr <= todayPHTStr ? Math.max(0, eligibleCount - totalCheckedIn) : 0);
                return { day, present: onTime, late, absent };
            });
            const weekly = weeklyAll.filter(d => {
                if (d.day !== 'Sun') return true;
                return d.present > 0 || d.late > 0;
            });
            setWeeklyData(weekly);

            const todayLate = atts.filter(a => a.checkInTime && a.lateMinutes > 0).length;
            const todayOnTime = atts.filter(a => a.checkInTime && !(a.lateMinutes > 0)).length;
            const todayPresent = todayOnTime + todayLate;
            setTotalPresent(todayOnTime);
            setTotalLate(todayLate);
            const todayEligible = activeEmps.filter((e: any) => {
                if (!e.hireDate) return true;
                return phtStr(new Date(e.hireDate)) <= todayPHTStr;
            }).length;
            const missingCount = Math.max(0, todayEligible - todayPresent);
            if (todayHoliday) {
                setTotalAbsent(0);
                setTotalHoliday(missingCount);
            } else {
                setTotalAbsent(missingCount);
                setTotalHoliday(0);
            }

            const events: LiveRecord[] = [];
            for (const r of atts) {
                const empName = `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim();
                const dept = r.employee?.Department?.name || '—';
                const branch = r.employee?.Branch?.name || '—';
                const ciStatus: LiveRecord['status'] = r.status === 'absent' ? 'absent' : (r.lateMinutes > 0 ? 'late' : 'on-time');

                if (r.checkInTime) {
                    events.push({
                        id: `${r.id}-in`,
                        employee: empName,
                        department: dept,
                        branch,
                        eventType: 'check-in',
                        time: new Date(r.checkInTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
                        eventTs: new Date(r.checkInTime).getTime(),
                        status: ciStatus,
                        shiftType: r.shiftType || 'MORNING',
                    });
                }

                if (r.checkOutTime) {
                    events.push({
                        id: `${r.id}-out`,
                        employee: empName,
                        department: dept,
                        branch,
                        eventType: 'check-out',
                        time: new Date(r.checkOutTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }),
                        eventTs: new Date(r.checkOutTime).getTime(),
                        status: r.undertimeMinutes > 0 ? 'undertime' : 'on-time',
                        shiftType: r.shiftType || 'MORNING',
                    });
                }
            }

            events.sort((a, b) => b.eventTs - a.eventTs);
            setActivity(events.slice(0, 15));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [router, departmentFilter]);

    const handleStreamRecord = useCallback((payload: AttendanceStreamPayload) => {
        // Since we don't know if the incoming stream record belongs to the manager's department
        // directly from the payload without extra logic, we'll just trigger a refresh
        // instead of appending it optimistically to avoid showing out-of-scope employees.
        load();
    }, [load]);

    useAttendanceStream({
        onRecord: handleStreamRecord,
    });

    useEffect(() => {
        if (activityScrollRef.current) {
            activityScrollRef.current.scrollTop = 0;
        }
    }, [activity]);

    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then(r => { if (!r.ok) router.replace('/login'); })
            .catch(() => router.replace('/login'));
        load();
        const t = setInterval(load, 30_000);
        return () => clearInterval(t);
    }, [load]);

    const state: ManagerDashboardState = {
        activity,
        weeklyData,
        totalEmployees,
        totalPresent,
        totalLate,
        totalAbsent,
        totalHoliday,
        holidayName,
        activityScrollRef,
        myDepartments,
        departmentFilter,
        setDepartmentFilter,
    };

    return { state, loading, refresh: load };
}
