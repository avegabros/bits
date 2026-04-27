'use client';

import { useMemo, useState, useRef } from 'react';
import { ReportRow, AttendanceRecord } from '@/types/reports';
import { getRecordStatusFromBackend } from '@/features/reports/lib/formatters';
import { useTableSort } from '@/hooks/useTableSort';
import type { Holiday } from '@/features/holidays/hooks/useHolidays';

export interface TableRowData {
    loopDate: Date;
    loopDateStr: string;
    record: AttendanceRecord | undefined;
    statusType: string;
    missingStatus: string;
    isFuture: boolean;
    isWorkingDay: boolean;
    checkInVal: Date | null;
    checkOutVal: Date | null;
    workedHrsVal: number;
    lateMinsVal: number;
    otMinsVal: number;
    utMinsVal: number;
}

export interface HRTableRowData {
    date: string;
    shift: string;
    type: string;
    duration: string;
    _rawDate: string;
    colorClass: string;
    checkIn: string;
    checkOut: string;
    workedHrs: number;
    lateMins: number;
    otMins: number;
    utMins: number;
    statusLabel: string;
    isShiftActive: boolean;
    gracePeriodApplied: boolean;
}

function getDatesInRange(start: string, end: string): Date[] {
    const dates = [];
    const currentDate = new Date(start + 'T00:00:00Z');
    const endDateObj = new Date(end + 'T00:00:00Z');
    while (currentDate <= endDateObj) {
        dates.push(new Date(currentDate));
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return dates;
}

function buildTableRows(
    calendarDates: Date[],
    records: AttendanceRecord[],
    employee: ReportRow,
    holidayMap?: Map<string, Holiday>
): TableRowData[] {
    return calendarDates.map(loopDate => {
        const loopDateStr = loopDate.toISOString().split('T')[0];
        const record = records.find(r => {
            const rDateStr = new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
            return rDateStr === loopDateStr;
        });

        let statusType = 'No Record';
        let checkInVal = null;
        let checkOutVal = null;
        let workedHrsVal = 0;
        let lateMinsVal = 0;
        let otMinsVal = 0;
        let utMinsVal = 0;

        let isFuture = false;
        let isWorkingDay = true;
        let missingStatus = '';

        if (!record) {
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
            isFuture = loopDateStr > todayStr;
            const dayName = loopDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
            isWorkingDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(dayName);
            if (employee.shift?.workDays) {
                try {
                    const wDays = typeof employee.shift.workDays === 'string'
                        ? JSON.parse(employee.shift.workDays)
                        : employee.shift.workDays;
                    if (Array.isArray(wDays)) {
                        isWorkingDay = wDays.includes(dayName);
                    }
                } catch (e) {}
            }

            // Check if this date is a holiday
            const holiday = holidayMap?.get(loopDateStr);
            if (holiday) {
                missingStatus = 'Holiday';
            } else {
                missingStatus = isFuture ? 'Upcoming' : (isWorkingDay ? 'Absent' : 'Rest Day');
            }
            statusType = missingStatus;
        } else {
            checkInVal = new Date(record.checkInTime);
            checkOutVal = record.checkOutTime ? new Date(record.checkOutTime) : null;
            workedHrsVal = record.totalHours ?? 0;
            lateMinsVal = record.lateMinutes ?? 0;
            otMinsVal = record.overtimeMinutes ?? 0;
            utMinsVal = record.undertimeMinutes ?? 0;
            statusType = getRecordStatusFromBackend(record);
        }

        return {
            loopDate,
            loopDateStr,
            record,
            statusType,
            missingStatus,
            isFuture,
            isWorkingDay,
            checkInVal,
            checkOutVal,
            workedHrsVal,
            lateMinsVal,
            otMinsVal,
            utMinsVal,
        };
    });
}

function buildHRTableRows(
    tableRows: TableRowData[],
    employee: ReportRow,
    logSearchDate: string
): HRTableRowData[] {
    return tableRows.filter(row => {
        if (!logSearchDate) return true;
        return row.loopDateStr === logSearchDate;
    }).map(row => {
        let typeLabel = '';
        let durationLabel = '-';
        let shiftLabel = employee.shift ? employee.shift.name : '-';

        if (!row.record) {
            typeLabel = row.missingStatus.toUpperCase();
            durationLabel = '-';
        } else {
            typeLabel = row.statusType.replace('-', ' ').toUpperCase();
            durationLabel = row.workedHrsVal > 0 ? `${row.workedHrsVal.toFixed(2)}h` : '-';
        }

        let colorClass = 'text-slate-700';
        if (typeLabel === 'ON TIME') colorClass = 'text-green-600';
        else if (typeLabel === 'LATE') colorClass = 'text-yellow-600';
        else if (typeLabel === 'ABSENT') colorClass = 'text-red-600';
        else if (typeLabel === 'REST DAY') colorClass = 'text-slate-400';
        else if (typeLabel === 'ANOMALY') colorClass = 'text-orange-600';
        else if (typeLabel === 'IN PROGRESS') colorClass = 'text-blue-500';
        else if (typeLabel === 'EARLY OUT') colorClass = 'text-purple-600';
        else if (typeLabel === 'UPCOMING') colorClass = 'text-blue-400';
        else if (typeLabel === 'MISSING CHECKOUT') colorClass = 'text-amber-600';
        else if (typeLabel === 'HOLIDAY') colorClass = 'text-indigo-500';

        const checkInStr = row.checkInVal ? row.checkInVal.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : "-";
        const checkOutStr = row.record?.isShiftActive ? "Active" : (row.checkOutVal ? row.checkOutVal.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : "-");

        return {
            date: row.loopDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            shift: shiftLabel,
            type: typeLabel,
            duration: durationLabel,
            _rawDate: row.loopDateStr,
            colorClass,
            checkIn: checkInStr,
            checkOut: checkOutStr,
            workedHrs: row.workedHrsVal,
            lateMins: row.lateMinsVal,
            otMins: row.otMinsVal,
            utMins: row.utMinsVal,
            statusLabel: row.statusType,
            isShiftActive: row.record?.isShiftActive ?? false,
            gracePeriodApplied: row.record?.gracePeriodApplied ?? false,
        };
    }).sort((a, b) => new Date(b._rawDate).getTime() - new Date(a._rawDate).getTime());
}

export function useEmployeeModalData(
    employee: ReportRow,
    records: AttendanceRecord[],
    startDate: string,
    endDate: string,
    holidays?: Holiday[]
) {
    const [logSearchDate, setLogSearchDate] = useState('');
    const logDateRef = useRef<HTMLInputElement>(null);

    const attendanceRate =
        employee.totalDays > 0
            ? Math.min(Math.round((employee.present / employee.totalDays) * 100), 100)
            : 0;

    const holidayMap = useMemo(() => {
        const map = new Map<string, Holiday>();
        if (holidays) {
            for (const h of holidays) {
                const dateStr = new Date(h.date).toISOString().split('T')[0];
                map.set(dateStr, h);
            }
        }
        return map;
    }, [holidays]);

    const calendarDates = useMemo(() => getDatesInRange(startDate, endDate).reverse(), [startDate, endDate]);
    const tableRows = useMemo(() => buildTableRows(calendarDates, records, employee, holidayMap), [calendarDates, records, employee, holidayMap]);
    const hrTableRows = useMemo(() => buildHRTableRows(tableRows, employee, logSearchDate), [tableRows, employee, logSearchDate]);

    const { sortedData, sortKey, sortOrder, handleSort } = useTableSort<any>({
        initialData: tableRows
    });
    const sortKeyStr = sortKey as string | null;

    return {
        attendanceRate,
        tableRows,
        hrTableRows,
        sortedData,
        sortKeyStr,
        sortOrder,
        handleSort,
        logSearchDate,
        setLogSearchDate,
        logDateRef,
    };
}
