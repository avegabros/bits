import * as XLSX from 'xlsx';
import { ReportRow, AttendanceRecord } from '@/types/reports';
import {
  formatDateShort,
  formatShiftTime,
  formatLateHrs,
  formatHrsMins,
  getRecordStatusFromBackend,
} from './formatters';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const fmtFullDate = (d: Date) =>
  `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

export const handleExport = (
  filteredData: ReportRow[],
  startDate: string,
  endDate: string,
  exportSource: 'admin-panel' | 'hr-panel' = 'admin-panel'
) => {
  const allRows: (string | number)[][] = [];
  const s = new Date(startDate + 'T00:00:00Z');
  const e = new Date(endDate + 'T00:00:00Z');

  allRows.push(['Period', `${fmtFullDate(s)} to ${fmtFullDate(e)}`]);
  allRows.push(['Total Employees', filteredData.length]);
  allRows.push([]);

  // Removed Leave and Absents, combined Late
  allRows.push([
    'Employee',
    'Shift',
    'Late (Duration)',
    'Overtime',
    'Undertime',
    'Reg Hrs',
  ]);

  filteredData.forEach((e) => {
    const shiftLabel = e.shift
      ? `${e.shift.name} (${formatShiftTime(
          e.shift.startTime
        )}–${formatShiftTime(e.shift.endTime)})`
      : 'No Shift';
    allRows.push([
      e.name,
      shiftLabel,
      formatLateHrs(e.lateMinutes),
      e.overtime > 0 ? formatHrsMins(e.overtime) : '—', // Removed + sign
      e.undertime > 0 ? formatHrsMins(e.undertime) : '—', // Removed - sign
      Math.max(0, e.totalHours - e.overtime).toFixed(2),
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(allRows);
  worksheet['!cols'] = [
    { wch: 25 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  const fileName = `Attendance_Report_${formatDateShort(startDate)}_${formatDateShort(
    endDate
  )}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  // Log the export event
  fetch('/api/logs/export-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      exportType: 'report',
      entityType: 'Attendance',
      source: exportSource,
      details: `Exported attendance report (${filteredData.length} employees) for ${startDate} to ${endDate}`,
      filters: { dateFrom: startDate, dateTo: endDate },
      recordCount: filteredData.length,
      fileFormat: 'xlsx',
      fileName,
    }),
  }).catch(() => {});
};

export const handleExportIndividual = (
  emp: ReportRow,
  startDate: string,
  endDate: string,
  records: AttendanceRecord[],
  exportSource: 'admin-panel' | 'hr-panel' = 'admin-panel'
) => {
  const allRows: (string | number)[][] = [];
  allRows.push(['Employee', emp.name, '', 'Branch', emp.branch]);
  allRows.push(['Department', emp.department]);
  allRows.push([
    'Shift',
    emp.shift
      ? `${emp.shift.name} · ${formatShiftTime(
          emp.shift.startTime
        )}–${formatShiftTime(emp.shift.endTime)}`
      : 'No shift assigned',
  ]);
  allRows.push([]);

  allRows.push([
    'RATE',
    'PRESENT',
    'LATE DAYS',
    'LATE TOTAL',
    'REG HOURS',
  ]); // Removed ABSENT
  const rate =
    emp.totalDays > 0 ? Math.round((emp.present / emp.totalDays) * 100) : 0;
  allRows.push([
    `${rate}%`,
    emp.present,
    emp.late,
    formatLateHrs(emp.lateMinutes),
    Math.max(0, emp.totalHours - emp.overtime).toFixed(2),
  ]);
  allRows.push([]);

  const s = new Date(startDate + 'T00:00:00Z');
  const e = new Date(endDate + 'T00:00:00Z');
  allRows.push(['Period', `${fmtFullDate(s)} — ${fmtFullDate(e)}`]);
  allRows.push([]);

  allRows.push([
    'Date',
    'Day',
    'Check In',
    'Check Out',
    'Reg Hrs',
    'Late',
    'OT',
    'UT',
    'Status',
  ]);
  // Build a lookup map keyed by YYYY-MM-DD (same logic as EmployeeModal)
  const recordsByDate = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    const key = new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    if (!recordsByDate.has(key)) {
      recordsByDate.set(key, r);
    }
  });

  // Determine which short-day names are working days (mirrors EmployeeModal)
  const defaultWorkDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  let workDayNames: string[] = defaultWorkDays;
  if (emp.shift?.workDays) {
    try {
      const parsed =
        typeof emp.shift.workDays === 'string'
          ? JSON.parse(emp.shift.workDays)
          : emp.shift.workDays;
      if (Array.isArray(parsed)) workDayNames = parsed;
    } catch (_e) {}
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  // Walk every calendar day from startDate to endDate inclusive
  let totalCalendarDays = 0;
  const cursor = new Date(s);
  while (cursor <= e) {
    totalCalendarDays++;
    const dayOfWeek = cursor.getUTCDay();
    const dateKey = cursor.toISOString().split('T')[0];
    const dayShort = cursor.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const r = recordsByDate.get(dateKey);

    if (r) {
      // Record exists — mirrors EmployeeModal record branch
      const checkIn = new Date(r.checkInTime);
      const checkOut = r.checkOutTime ? new Date(r.checkOutTime) : null;
      const hoursWorked = r.totalHours ? Math.max(0, r.totalHours - ((r.overtimeMinutes ?? 0) / 60)).toFixed(2) : '—';
      const statusLabel = getRecordStatusFromBackend(r);
      const lateMins = r.lateMinutes ?? 0;
      const otMins = r.overtimeMinutes ?? 0;
      const utMins = r.undertimeMinutes ?? 0;

      // Status mapping — exact match with UI
      let displayStatus: string;
      if (statusLabel === 'in-progress') {
        displayStatus = 'In Progress';
      } else if (statusLabel === 'early-out') {
        displayStatus = 'Early Out';
      } else if (statusLabel === 'anomaly') {
        displayStatus = 'ANOMALY – Out of Shift';
      } else if (statusLabel === 'late') {
        displayStatus = 'Late';
      } else {
        displayStatus = 'On Time';
      }

      // Check Out column — mirrors UI "Active" indicator
      const checkOutLabel = r.isShiftActive
        ? 'Active'
        : checkOut
        ? checkOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '—';

      // Hours column — mirrors UI "Live" indicator
      const hoursLabel = r.isShiftActive ? 'Live' : hoursWorked;

      // Late column — mirrors UI "0m (Grace)" notation
      let lateLabel: string | number;
      if (lateMins > 0) {
        lateLabel = formatLateHrs(lateMins);
      } else if (r.gracePeriodApplied) {
        lateLabel = '0m (Grace)';
      } else {
        lateLabel = '—';
      }

      allRows.push([
        fmtFullDate(cursor),
        DAYS[dayOfWeek],
        checkIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        checkOutLabel,
        hoursLabel,
        lateLabel,
        otMins > 0 ? formatHrsMins(otMins / 60) : '—',
        utMins > 0 ? formatHrsMins(utMins / 60) : '—',
        displayStatus,
      ]);
    } else {
      // No record — determine status exactly like EmployeeModal
      const isFuture = dateKey > todayStr;
      const isWorkingDay = workDayNames.includes(dayShort);
      const missingStatus = isFuture ? 'Upcoming' : isWorkingDay ? 'Absent' : 'Rest Day';

      allRows.push([
        fmtFullDate(cursor),
        DAYS[dayOfWeek],
        '—',
        '—',
        '—',
        '—',
        '—',
        '—',
        missingStatus,
      ]);
    }

    // Advance cursor by one day
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  allRows.push([]);
  allRows.push([
    `${records.length} record${records.length !== 1 ? 's' : ''} · ${totalCalendarDays} calendar days · ${
      emp.totalDays
    } working days`,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(allRows);
  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 22 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  const fileName = `Report_${emp.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  // Log the export event
  fetch('/api/logs/export-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      exportType: 'report',
      entityType: 'Attendance',
      source: exportSource,
      details: `Exported individual report for ${emp.name} (${records.length} records) for ${startDate} to ${endDate}`,
      filters: { dateFrom: startDate, dateTo: endDate, employeeName: emp.name, department: emp.department, branch: emp.branch },
      recordCount: records.length,
      fileFormat: 'xlsx',
      fileName,
    }),
  }).catch(() => {});
};
