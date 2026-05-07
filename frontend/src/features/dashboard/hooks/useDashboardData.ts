'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAttendanceStream, AttendanceStreamPayload } from '@/features/attendance/hooks/useAttendanceStream';
import { useDeviceStream, DeviceStatusPayload, DeviceConnectedPayload } from '@/features/devices/hooks/useDeviceStream';

interface Branch { id: number; name: string; address?: string; }
interface Device { id: number; name: string; ip: string; port: number; location?: string; isActive: boolean; syncEnabled: boolean; }
export interface DeviceWithStatus extends Device { online: boolean | null; }

export interface BranchData {
    name: string;
    percentage: number;
    color: string;
}

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

export interface DashboardState {
    devices: DeviceWithStatus[];
    branchPresence: BranchData[];
    activity: LiveRecord[];
    weeklyData: WeekDay[];
    totalEmployees: number;
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalHoliday: number;
    holidayName: string | null;
    globalSyncEnabled: boolean;
    activityScrollRef: React.RefObject<HTMLDivElement | null>;
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

export function useDashboardData(role: 'admin' | 'hr') {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [devices, setDevices] = useState<DeviceWithStatus[]>([]);
    const activityScrollRef = useRef<HTMLDivElement>(null);

    const [branchPresence, setBranchPresence] = useState<BranchData[]>([]);
    const [activity, setActivity] = useState<LiveRecord[]>([]);
    const [weeklyData, setWeeklyData] = useState<WeekDay[]>([]);
    const [totalEmployees, setTotalEmployees] = useState(0);
    const [totalPresent, setTotalPresent] = useState(0);
    const [totalLate, setTotalLate] = useState(0);
    const [totalAbsent, setTotalAbsent] = useState(0);
    const [totalHoliday, setTotalHoliday] = useState(0);
    const [holidayName, setHolidayName] = useState<string | null>(null);

    const [globalSyncEnabled, setGlobalSyncEnabled] = useState(true);

    const load = useCallback(async () => {
        try {
            const todayStr = phtStr(new Date());
            const weekDates = getWeekDates();
            const weekStart = phtStr(weekDates[0].date);
            const weekEnd = phtStr(weekDates[6].date);

            const [bRes, dRes, eRes, aRes, wRes, sRes, hRes] = await Promise.all([
                fetch('/api/branches', { credentials: 'include' }),
                fetch('/api/devices', { credentials: 'include' }),
                fetch('/api/employees?limit=5000', { credentials: 'include' }),
                fetch(`/api/attendance?startDate=${todayStr}&endDate=${todayStr}&limit=5000`, { credentials: 'include' }),
                fetch(`/api/attendance?startDate=${weekStart}&endDate=${weekEnd}&limit=5000`, { credentials: 'include' }),
                fetch('/api/system/sync-status', { credentials: 'include' }),
                fetch(`/api/holidays?year=${new Date().getFullYear()}`, { credentials: 'include' }),
            ]);
            if (eRes.status === 401) { router.replace('/login'); return; }

            const bd = bRes.ok ? await bRes.json() : { success: false };
            const dd = dRes.ok ? await dRes.json() : { success: false };
            const ed = await eRes.json();
            const ad = await aRes.json();
            const wd = await wRes.json();
            const sd = sRes.ok ? await sRes.json() : { success: false };
            const hd = hRes.ok ? await hRes.json() : { success: false };

            // Build a holiday date set for O(1) lookup
            const holidayList: { date: string; name: string }[] = hd.success ? (hd.holidays || []) : [];
            const holidayDateSet = new Set(holidayList.map(h => new Date(h.date).toISOString().split('T')[0]));
            const todayHoliday = holidayList.find(h => new Date(h.date).toISOString().split('T')[0] === todayStr);
            setHolidayName(todayHoliday?.name ?? null);

            const branchList: Branch[] = bd.success ? (bd.branches || bd.data || []) : [];
            const deviceList: Device[] = dd.success ? (dd.devices || dd.data || []) : [];
            const allEmps: any[] = ed.success ? (ed.employees || ed.data || []) : [];
            const emps = allEmps.filter((e: any) => e.role === 'USER' || !e.role);
            const atts: any[] = (ad.success ? (ad.data || []) : []).filter((a: any) => {
                const emp = a.employee || a.Employee || {};
                return (emp.role === 'USER' || !emp.role) && a.status !== 'pending';
            });
            const weekAtts: any[] = (wd.success ? (wd.data || []) : []).filter((a: any) => {
                const emp = a.employee || a.Employee || {};
                return (emp.role === 'USER' || !emp.role) && a.status !== 'pending';
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
                // On Time = checked in AND not late (mutually exclusive with Late)
                const onTime = dayAtts.filter(a => a.checkInTime && (a.lateMinutes ?? 0) === 0).length;
                const totalCheckedIn = onTime + late;
                const isDateHoliday = holidayDateSet.has(dateStr);
                // Only count employees whose hireDate is on or before this day
                const eligibleCount = activeEmps.filter((e: any) => {
                    if (!e.hireDate) return true; // no hireDate = always eligible
                    return phtStr(new Date(e.hireDate)) <= dateStr;
                }).length;
                const absent = isDateHoliday ? 0 : (dateStr <= todayPHTStr ? Math.max(0, eligibleCount - totalCheckedIn) : 0);
                return { day, present: onTime, late, absent };
            });
            // Always show Mon–Sat; only show Sun if there is attendance data
            const weekly = weeklyAll.filter(d => {
                if (d.day !== 'Sun') return true;
                return d.present > 0 || d.late > 0;
            });
            setWeeklyData(weekly);

            const devicesWithStatus: DeviceWithStatus[] = deviceList.map(dev => ({
                ...dev,
                syncEnabled: (dev as any).syncEnabled ?? true,
                online: dev.isActive
            }));
            setDevices(devicesWithStatus);

            if (sd && sd.success) {
                setGlobalSyncEnabled(sd.status.globalSyncEnabled);
            }

            const bPresence: BranchData[] = branchList.map(b => {
                const branchEmps = emps.filter(e => e.Branch?.name === b.name && e.employmentStatus === 'ACTIVE');
                const branchAtts = atts.filter(a => a.employee?.Branch?.name === b.name && a.checkInTime);
                const total = branchEmps.length;
                const present = branchAtts.length;
                const pct = total === 0 ? 0 : Math.round((present / total) * 100);
                const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                return { name: b.name, percentage: pct, color };
            });
            setBranchPresence(bPresence);

            const todayLate = atts.filter(a => a.checkInTime && a.lateMinutes > 0).length;
            // On Time = checked in AND not late (mutually exclusive with Late)
            const todayOnTime = atts.filter(a => a.checkInTime && !(a.lateMinutes > 0)).length;
            const todayPresent = todayOnTime + todayLate; // total who checked in, used for absent calc
            setTotalPresent(todayOnTime);
            setTotalLate(todayLate);
            // Only count employees whose hireDate is on or before today for absent/holiday calc
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
    }, [router]);

    const handleStreamRecord = useCallback((payload: AttendanceStreamPayload) => {
        const emp = payload.record.employee;
        const empName = emp
            ? `${emp.firstName}${(emp as any).middleName ? ` ${(emp as any).middleName[0]}.` : ''} ${emp.lastName}${(emp as any).suffix ? ` ${(emp as any).suffix}` : ''}`.trim()
            : 'Unknown';
        const isLate = payload.record.lateMinutes > 0;
        const isUndertime = payload.record.undertimeMinutes > 0;

        if (payload.record.status === 'pending') return;

        let eventType: 'check-in' | 'check-out' | 'delete' = 'check-out';
        if (payload.type === 'check-in') eventType = 'check-in';
        if (payload.type === 'delete') eventType = 'delete';

        let timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });
        let eventTs = Date.now();
        if (payload.type !== 'delete') {
            const timeDate = new Date(payload.type === 'check-in' ? payload.record.checkInTime : payload.record.checkOutTime!);
            timeStr = timeDate.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });
            eventTs = timeDate.getTime();
        }

        const newEntry: LiveRecord = {
            id: `stream-${payload.record.id}-${payload.type}-${Date.now()}`,
            employee: empName,
            department: emp?.Department?.name || '—',
            branch: emp?.Branch?.name || '—',
            eventType,
            time: timeStr,
            eventTs,
            status: payload.type === 'delete' ? 'deleted' : payload.type === 'check-in' ? (isLate ? 'late' : 'on-time') : (isUndertime ? 'undertime' : 'on-time'),
            shiftType: 'MORNING',
        };

        setActivity(prev => [newEntry, ...prev].slice(0, 15));

        if (payload.type === 'check-in') {
            // On Time and Late are mutually exclusive
            if (isLate) {
                setTotalLate(prev => prev + 1);
            } else {
                setTotalPresent(prev => prev + 1);
            }
            setTotalAbsent(prev => Math.max(0, prev - 1));
        } else if (payload.type === 'delete') {
            setTotalPresent(prev => Math.max(0, prev - 1));
            if (isLate) setTotalLate(prev => Math.max(0, prev - 1));
            setTotalAbsent(prev => prev + 1);
        }
    }, []);

    useAttendanceStream({
        onRecord: handleStreamRecord,
    });

    const handleDeviceConnected = useCallback((payload: DeviceConnectedPayload) => {
        setDevices(prev => prev.map(d => {
            const fresh = payload.devices.find(sd => sd.id === d.id);
            if (!fresh) return d;
            return { ...d, online: fresh.isActive, isActive: fresh.isActive, syncEnabled: fresh.syncEnabled };
        }));
    }, []);

    const handleDeviceStatusChange = useCallback((payload: DeviceStatusPayload) => {
        setDevices(prev => prev.map(d =>
            d.id === payload.id
                ? { ...d, online: payload.isActive, isActive: payload.isActive }
                : d
        ));
    }, []);

    useDeviceStream({
        onConnected: handleDeviceConnected,
        onStatusChange: handleDeviceStatusChange,
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

    const state: DashboardState = {
        devices,
        branchPresence,
        activity,
        weeklyData,
        totalEmployees,
        totalPresent,
        totalLate,
        totalAbsent,
        totalHoliday,
        holidayName,
        globalSyncEnabled,
        activityScrollRef,
    };

    return { state, loading, refresh: load };
}
