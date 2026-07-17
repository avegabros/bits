import * as XLSX from 'xlsx';
import * as XLSXS from 'xlsx-js-style';
import { ReportRow, AttendanceRecord } from '@/types/reports';
import {
  formatDateShort,
  formatShiftTime,
  formatLateHrs,
  formatHrsMins,
  formatTotalLate,
  getRecordStatusFromBackend,
} from './formatters';
import type { Holiday } from '@/features/holidays/hooks/useHolidays';

interface RawEmployee {
  id: number;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  suffix?: string | null;
  employeeNumber?: string | null;
  zkId?: number | null;
  Department?: { name: string } | null;
  Section?: { name: string } | null;
  Branch?: { name: string } | null;
  employmentStatus: string;
  role: string;
  position?: string | null;
  hireDate?: string | null;
  Company?: { name: string } | null;
  Shift?: {
    id: number;
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes?: number;
    breakMinutes?: number;
    workDays?: string;
    halfDays?: string;
  } | null;
}

interface RawBranch {
  id: number;
  name: string;
}

interface RawHoliday {
  id: number;
  name: string;
  date: string;
}

interface RawPunchLog {
  id: number;
  employeeId: number;
  timestamp: string;
  status: number;
  deviceId?: number | null;
  authMethod?: string | null;
}

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
  const parsedStartDate = new Date(startDate + 'T00:00:00Z');
  const parsedEndDate = new Date(endDate + 'T00:00:00Z');

  allRows.push(['Period', `${fmtFullDate(parsedStartDate)} to ${fmtFullDate(parsedEndDate)}`]);
  allRows.push(['Total Employees', filteredData.length]);
  allRows.push([]);

  // Removed Leave and Absents, combined Late
  allRows.push([
    'Employee',
    'Shift',
    'Late (Duration)',
    'Total Late',
    'Overtime',
    'Undertime',
    'Reg Hrs',
  ]);

  let sumLateDays = 0;
  let sumLateMinutes = 0;
  let sumOvertime = 0;
  let sumUndertime = 0;
  let sumRegHrs = 0;

  filteredData.forEach((employee) => {
    const shiftLabel = employee.shift
      ? `${employee.shift.name} (${formatShiftTime(
        employee.shift.startTime
      )}–${formatShiftTime(employee.shift.endTime)})`
      : 'No Shift';
    allRows.push([
      employee.name,
      shiftLabel,
      formatLateHrs(employee.lateMinutes),
      formatTotalLate(employee.lateMinutes),
      employee.overtime > 0 ? formatHrsMins(employee.overtime) : '—',
      employee.undertime > 0 ? formatHrsMins(employee.undertime) : '—',
      Math.max(0, employee.totalHours).toFixed(2),
    ]);
    sumLateDays += employee.late;
    sumLateMinutes += employee.lateMinutes;
    sumOvertime += employee.overtime;
    sumUndertime += employee.undertime;
    sumRegHrs += employee.totalHours;
  });

  // Summary / totals row
  allRows.push([]);
  allRows.push([
    `TOTAL (${filteredData.length} employees)`,
    '',
    `${sumLateDays} late day(s)`,
    formatTotalLate(sumLateMinutes),
    sumOvertime > 0 ? formatHrsMins(sumOvertime) : '—',
    sumUndertime > 0 ? formatHrsMins(sumUndertime) : '—',
    sumRegHrs > 0 ? sumRegHrs.toFixed(2) : '0.00',
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(allRows);
  worksheet['!cols'] = [
    { wch: 25 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];

  // Bold the totals row
  const totalsRowIdx = allRows.length - 1;
  for (let c = 0; c < 7; c++) {
    const addr = XLSX.utils.encode_cell({ r: totalsRowIdx, c });
    if (worksheet[addr]) {
      worksheet[addr].s = { font: { bold: true } };
    }
  }
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
  }).catch(() => { });
};

export const handleExportIndividual = (
  emp: ReportRow,
  startDate: string,
  endDate: string,
  records: AttendanceRecord[],
  exportSource: 'admin-panel' | 'hr-panel' = 'admin-panel',
  holidays?: Holiday[]
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
    'UNDERTIME TOTAL',
    'REG HOURS',
  ]); // Removed ABSENT
  const rate =
    emp.totalDays > 0 ? Math.round((emp.present / emp.totalDays) * 100) : 0;
  allRows.push([
    `${rate}%`,
    emp.present,
    emp.late,
    formatLateHrs(emp.lateMinutes),
    emp.undertime > 0 ? formatHrsMins(emp.undertime) : '—',
    Math.max(0, emp.totalHours).toFixed(2),
  ]);
  allRows.push([]);

  const parsedStartDate = new Date(startDate + 'T00:00:00Z');
  const parsedEndDate = new Date(endDate + 'T00:00:00Z');
  allRows.push(['Period', `${fmtFullDate(parsedStartDate)} — ${fmtFullDate(parsedEndDate)}`]);
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
    'Note',
  ]);
  // Build a lookup map keyed by YYYY-MM-DD (same logic as EmployeeModal)
  const recordsByDate = new Map<string, AttendanceRecord[]>();
  records.forEach((r) => {
    const key = new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    if (!recordsByDate.has(key)) {
      recordsByDate.set(key, []);
    }
    recordsByDate.get(key)!.push(r);
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
    } catch (_e) { }
  }

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  // Build a holiday date map for O(1) lookup (date → name)
  const holidayDateMap = new Map<string, string>();
  for (const h of (holidays ?? [])) {
    const dateStr = new Date(h.date).toISOString().split('T')[0];
    holidayDateMap.set(dateStr, h.name);
  }

  // Walk every calendar day from startDate to endDate inclusive
  let totalCalendarDays = 0;
  const cursor = new Date(parsedStartDate);
  while (cursor <= parsedEndDate) {
    totalCalendarDays++;
    const dayOfWeek = cursor.getUTCDay();
    const dateKey = cursor.toISOString().split('T')[0];
    const dayShort = cursor.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const dayRecords = recordsByDate.get(dateKey) || [];

    if (dayRecords.length > 0) {
      // Sort day records chronologically by check-in time
      const sortedDayRecords = [...dayRecords].sort((a, b) => {
        const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
        return timeA - timeB;
      });

      const firstRecord = sortedDayRecords[0];
      const lastRecord = sortedDayRecords[sortedDayRecords.length - 1];

      // Find earliest valid check-in time
      const checkInRecords = dayRecords.filter(r => r.checkInTime);
      const earliestCheckInTime = checkInRecords.length > 0
        ? checkInRecords.reduce((earliest, current) => 
            new Date(current.checkInTime!).getTime() < new Date(earliest.checkInTime!).getTime() ? current : earliest
          ).checkInTime
        : null;

      // Find latest valid check-out time
      const checkOutRecords = dayRecords.filter(r => r.checkOutTime);
      const latestCheckOutTime = checkOutRecords.length > 0
        ? checkOutRecords.reduce((latest, current) => 
            new Date(current.checkOutTime!).getTime() > new Date(latest.checkOutTime!).getTime() ? current : latest
          ).checkOutTime
        : null;

      const isShiftActive = dayRecords.some(r => r.isShiftActive);

      const workedHrsVal = dayRecords.reduce((sum, r) => sum + (!r.shift && !r.shiftCode ? 0 : (r.totalHours ?? 0)), 0);
      const lateMinsVal = dayRecords.reduce((sum, r) => sum + (!r.shift && !r.shiftCode ? 0 : (r.lateMinutes ?? 0)), 0);
      const otMinsVal = dayRecords.reduce((sum, r) => sum + (r.overtimeMinutes ?? 0), 0);
      const utMinsVal = dayRecords.reduce((sum, r) => sum + (!r.shift && !r.shiftCode ? 0 : (r.undertimeMinutes ?? 0)), 0);

      // Determine aggregated daily status
      let aggregatedStatus = firstRecord.status;
      if (dayRecords.every(r => r.status === 'incomplete' && !r.checkOutTime)) {
        aggregatedStatus = 'incomplete';
      } else {
        const nonIncompleteRecord = sortedDayRecords.find(r => r.status !== 'incomplete');
        if (nonIncompleteRecord) {
          aggregatedStatus = nonIncompleteRecord.status;
        }
      }

      // Construct representative merged record
      const mergedRecord: AttendanceRecord = {
        ...firstRecord,
        isShiftActive,
        checkOutTime: latestCheckOutTime,
        gracePeriodApplied: dayRecords.some(r => r.gracePeriodApplied),
        checkin_updated: dayRecords.some(r => r.checkin_updated) ? 'true' : null,
        checkout_updated: dayRecords.some(r => r.checkout_updated) ? 'true' : null,
        notes: dayRecords.map(r => r.notes).filter(Boolean).join(' | '),
        isEarlyOut: lastRecord.isEarlyOut,
        isAnomaly: dayRecords.some(r => r.isAnomaly),
        lateMinutes: lateMinsVal,
        status: aggregatedStatus,
      };

      const checkIn = earliestCheckInTime ? new Date(earliestCheckInTime) : null;
      const checkOut = latestCheckOutTime ? new Date(latestCheckOutTime) : null;
      const checkInLabel = checkIn ? checkIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
      const hoursWorked = workedHrsVal > 0 ? workedHrsVal.toFixed(2) : '—';
      const statusLabel = getRecordStatusFromBackend(mergedRecord);
      const lateMins = lateMinsVal;
      const otMins = otMinsVal;
      const utMins = utMinsVal;

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
      } else if (statusLabel === 'missing-checkout') {
        displayStatus = 'Missing Out';
      } else if (statusLabel === 'missing-checkin') {
        displayStatus = 'Missing In';
      } else {
        displayStatus = 'On Time';
      }

      // Check Out column — mirrors UI "Active" indicator
      const checkOutLabel = checkOut
        ? checkOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : (isShiftActive ? 'Active' : '—');

      // Hours column — mirrors UI "Live" indicator
      const hoursLabel = isShiftActive ? 'Live' : hoursWorked;

      // Late column — mirrors UI "0m (Grace)" notation
      let lateLabel: string | number;
      if (lateMins > 0) {
        lateLabel = formatLateHrs(lateMins);
      } else if (mergedRecord.gracePeriodApplied) {
        lateLabel = '0m (Grace)';
      } else {
        lateLabel = '—';
      }

      const holidayName = holidayDateMap.get(dateKey) ?? null;
      allRows.push([
        fmtFullDate(cursor),
        DAYS[dayOfWeek],
        checkInLabel,
        checkOutLabel,
        hoursLabel,
        lateLabel,
        otMins > 0 ? formatHrsMins(otMins / 60) : '—',
        utMins > 0 ? formatHrsMins(utMins / 60) : '—',
        displayStatus,
        holidayName ? `Holiday — ${holidayName}` : '—',
      ]);
    } else {
      // No record — determine status exactly like EmployeeModal
      const isFuture = dateKey > todayStr;
      const isWorkingDay = workDayNames.includes(dayShort);
      const holidayName = holidayDateMap.get(dateKey) ?? null;
      const isHoliday = !!holidayName;
      const missingStatus = isFuture ? 'Upcoming' : isHoliday ? 'Holiday' : isWorkingDay ? 'Absent' : 'Rest Day';

      allRows.push([
        fmtFullDate(cursor),
        DAYS[dayOfWeek],
        '—',
        '—',
        '—',
        '—',
        '—',
        '—',
        missingStatus === 'Holiday' ? '—' : missingStatus,
        holidayName ? `Holiday — ${holidayName}` : '—',
      ]);
    }

    // Advance cursor by one day
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  allRows.push([]);
  allRows.push([
    `${records.length} record${records.length !== 1 ? 's' : ''} · ${totalCalendarDays} calendar days · ${emp.totalDays
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
    { wch: 28 },
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
  }).catch(() => { });
};

// ═══════════════════════════════════════════════════════════════════════
// handleExportAllCompanies — Multi-company per-sheet export
// ═══════════════════════════════════════════════════════════════════════

/** Helper: set a styled cell on a worksheet (xlsx-js-style) */
function setStyledCell(
  ws: any,
  row: number,
  col: number,
  value: string | number,
  style: Record<string, unknown>
) {
  const addr = XLSXS.utils.encode_cell({ r: row, c: col });
  ws[addr] = { v: value, t: typeof value === 'number' ? 'n' : 's', s: style };
}

/** Sanitize a string for use as an Excel sheet name (max 31 chars, no special chars) */
function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:\[\]]/g, '_').substring(0, 31);
}

const COLS_PER_EMP = 7;
const SEPARATOR_COLS = 1;
const HEADER_ROWS = 4;

/** Merge two style objects (fill + alignment, etc.) */
function mergeStyle(...styles: Record<string, unknown>[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const s of styles) {
    for (const [k, v] of Object.entries(s)) {
      result[k] = v;
    }
  }
  return result;
}

const ALIGN_CENTER: Record<string, unknown> = { alignment: { horizontal: 'center' as const, vertical: 'center' as const } };
const ALIGN_RIGHT: Record<string, unknown> = { alignment: { horizontal: 'right' as const, vertical: 'center' as const } };

const STYLE_BOLD: Record<string, unknown> = { font: { bold: true } };

// Thin border for all data cells
const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'FF000000' } },
  bottom: { style: 'thin', color: { rgb: 'FF000000' } },
  left: { style: 'thin', color: { rgb: 'FF000000' } },
  right: { style: 'thin', color: { rgb: 'FF000000' } },
};

// Header row 0-1: light blue-gray background, bold, centered, bordered
const STYLE_INFO_HEADER: Record<string, unknown> = {
  font: { bold: true },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFBDD7EE' } },
  border: THIN_BORDER,
};
const STYLE_INFO_VALUE: Record<string, unknown> = {
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFBDD7EE' } },
  border: THIN_BORDER,
};
// Header row 2 (DATE, DAY, IN, OUT, REMARKS): gray, bold, centered, bordered
const STYLE_COL_HEADER: Record<string, unknown> = {
  font: { bold: true },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFD9D9D9' } },
  border: THIN_BORDER,
};

// Data row fills — use full 8-char ARGB hex for xlsx-js-style compatibility
const FILL_REST_DAY: Record<string, unknown> = {
  fill: { patternType: 'solid', fgColor: { rgb: 'FFFFD700' } },
  border: THIN_BORDER,
};
const FILL_HOLIDAY: Record<string, unknown> = {
  fill: { patternType: 'solid', fgColor: { rgb: 'FF92D050' } },
  border: THIN_BORDER,
};
const FILL_ABSENT: Record<string, unknown> = {
  fill: { patternType: 'solid', fgColor: { rgb: 'FFFF9999' } },
  border: THIN_BORDER,
};
const FILL_LATE: Record<string, unknown> = {
  fill: { patternType: 'solid', fgColor: { rgb: 'FFFFD966' } },
  border: THIN_BORDER,
};
const FILL_ON_TIME: Record<string, unknown> = {
  fill: { patternType: 'solid', fgColor: { rgb: 'FFC6EFCE' } },
  border: THIN_BORDER,
};
const FILL_NONE: Record<string, unknown> = {};

// Locale-independent day name lookup (index matches Date.getUTCDay())
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const isLogDeleted = (
  log: RawPunchLog,
  originalDayRecords: AttendanceRecord[]
): boolean => {
  const logTimeMs = new Date(log.timestamp).getTime();

  // If the log matches checkInTime or checkOutTime of any daily record, it is credited.
  const isCredited = originalDayRecords.some(r => {
    const checkInMs = r.checkInTime ? new Date(r.checkInTime).getTime() : 0;
    const checkOutMs = r.checkOutTime ? new Date(r.checkOutTime).getTime() : 0;
    return logTimeMs === checkInMs || logTimeMs === checkOutMs;
  });

  if (isCredited) {
    return false;
  }

  // Overtime punches: check if there's credited overtime on this day.
  if (log.status === 4 || log.status === 5) {
    const hasCreditedOt = originalDayRecords.some(r => (r.overtimeMinutes ?? 0) > 0);
    return !hasCreditedOt;
  }

  // Duplicate Check-in punch check
  if (log.status === 0) {
    const hasCreditedCheckIn = originalDayRecords.some(r => r.checkInTime);
    if (hasCreditedCheckIn) {
      return false;
    }
  }

  // Duplicate Check-out punch check
  if (log.status === 1) {
    const hasCreditedCheckOut = originalDayRecords.some(r => r.checkOutTime);
    if (hasCreditedCheckOut) {
      return false;
    }
  }

  return true;
};

export const handleExportAllCompanies = async (
  startDate: string,
  endDate: string,
  exportSource: 'admin-panel' | 'hr-panel' = 'admin-panel'
): Promise<{ excludedCount: number; truncationWarning: boolean }> => {
  // ── 1. Fetch all required data ─────────────────────────────────────
  const startYear = new Date(startDate + 'T00:00:00Z').getFullYear();
  const [empRes, attRes, branchRes, holRes, rawLogsRes, devicesRes] = await Promise.all([
    fetch('/api/employees?limit=5000', { credentials: 'include' }),
    fetch(
      `/api/attendance?startDate=${startDate}&endDate=${endDate}&limit=10000`,
      { credentials: 'include' }
    ),
    fetch('/api/branches', { credentials: 'include' }),
    fetch(`/api/holidays?year=${startYear}`, { credentials: 'include' }),
    fetch(
      `/api/attendance/raw-logs?startDate=${startDate}&endDate=${endDate}`,
      { credentials: 'include' }
    ),
    fetch('/api/devices', { credentials: 'include' }),
  ]);

  // Validate response status code
  if (
    empRes.status === 401 ||
    attRes.status === 401 ||
    branchRes.status === 401 ||
    holRes.status === 401 ||
    rawLogsRes.status === 401 ||
    devicesRes.status === 401
  ) {
    window.location.href = '/login';
    throw new Error('Unauthorized session. Redirecting to login...');
  }

  if (!empRes.ok) throw new Error(`Failed to fetch employees: ${empRes.statusText}`);
  if (!attRes.ok) throw new Error(`Failed to fetch attendance data: ${attRes.statusText}`);
  if (!branchRes.ok) throw new Error(`Failed to fetch branches list: ${branchRes.statusText}`);
  if (!holRes.ok) throw new Error(`Failed to fetch holidays list: ${holRes.statusText}`);
  if (!rawLogsRes.ok) throw new Error(`Failed to fetch raw punches logs: ${rawLogsRes.statusText}`);
  if (!devicesRes.ok) throw new Error(`Failed to fetch devices list: ${devicesRes.statusText}`);

  const empData = await empRes.json();
  const attData = await attRes.json();
  const branchData = await branchRes.json();
  const holData = await holRes.json();
  const rawLogsData = await rawLogsRes.json();
  const devicesData = await devicesRes.json();

  // ── 2. Parse & filter ──────────────────────────────────────────────
  const allEmps: RawEmployee[] = (
    empData.employees ||
    empData.data ||
    []
  ).filter(
    (e: RawEmployee) => e.employmentStatus === 'ACTIVE' && (e.role === 'USER' || !e.role)
  );
  const records: AttendanceRecord[] = attData.success ? attData.data || [] : [];
  const branches: RawBranch[] = branchData.success
    ? branchData.branches || branchData.data || []
    : [];
  const holidays: RawHoliday[] = holData.success ? holData.holidays || [] : [];
  const rawLogs: RawPunchLog[] = rawLogsData.success ? rawLogsData.data || [] : [];
  const devicesList: { id: number; name: string }[] = devicesData.success
    ? devicesData.devices || devicesData.data || []
    : [];

  const deviceMap = new Map<number, string>();
  for (const d of devicesList) {
    deviceMap.set(d.id, d.name);
  }

  // ── 3. Truncation check ────────────────────────────────────────────
  const truncationWarning = allEmps.length >= 5000 || records.length >= 10000;

  // ── 4. Build lookup maps ───────────────────────────────────────────
  // Holiday date set & name map
  const holidayDateSet = new Set<string>();
  const holidayNameMap = new Map<string, string>();
  for (const h of holidays) {
    const d = new Date(h.date).toISOString().split('T')[0];
    holidayDateSet.add(d);
    holidayNameMap.set(d, h.name);
  }

  // Attendance: employeeId → dateStr → record
  const attByEmployeeTemp = new Map<number, Map<string, AttendanceRecord[]>>();
  for (const r of records) {
    const empId = r.employeeId;
    if (!attByEmployeeTemp.has(empId)) attByEmployeeTemp.set(empId, new Map());
    const dateStr = new Date(r.date).toLocaleDateString('en-CA', {
      timeZone: 'Asia/Manila',
    });
    if (!attByEmployeeTemp.get(empId)!.has(dateStr)) {
      attByEmployeeTemp.get(empId)!.set(dateStr, []);
    }
    attByEmployeeTemp.get(empId)!.get(dateStr)!.push(r);
  }

  const attByEmployee = new Map<number, Map<string, AttendanceRecord[]>>();
  for (const [empId, dateMap] of attByEmployeeTemp.entries()) {
    const processedDateMap = new Map<string, AttendanceRecord[]>();
    for (const [dateStr, dayRecords] of dateMap.entries()) {
      const scheduledShifts = dayRecords.filter(r => r.shift || r.shiftCode);
      const noShiftRecords = dayRecords.filter(r => !r.shift && !r.shiftCode);
      
      const recordsToRender: AttendanceRecord[] = [];
      
      if (scheduledShifts.length > 0) {
        const sortedScheduled = [...scheduledShifts].sort((a, b) => {
          const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
          const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
          return timeA - timeB;
        });

        if (noShiftRecords.length > 0) {
          const checkOutRecords = noShiftRecords.filter(r => r.checkOutTime);
          const latestNoShiftCheckOutTime = checkOutRecords.length > 0
            ? checkOutRecords.reduce((latest, current) => 
                new Date(current.checkOutTime!).getTime() > new Date(latest.checkOutTime!).getTime() ? current : latest
              ).checkOutTime
            : null;
          const noShiftTotalHours = noShiftRecords.reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
          const noShiftOvertime = noShiftRecords.reduce((sum, r) => sum + (r.overtimeMinutes ?? 0), 0);
          const noShiftAnomaly = noShiftRecords.some(r => r.isAnomaly);
          const noShiftNotes = noShiftRecords.map(r => r.notes).filter(Boolean).join(' | ');

          const lastScheduled = sortedScheduled[sortedScheduled.length - 1];
          const updatedLastScheduled: AttendanceRecord = {
            ...lastScheduled,
            checkOutTime: latestNoShiftCheckOutTime && (!lastScheduled.checkOutTime || new Date(latestNoShiftCheckOutTime).getTime() > new Date(lastScheduled.checkOutTime).getTime())
              ? latestNoShiftCheckOutTime
              : lastScheduled.checkOutTime,
            totalHours: (lastScheduled.totalHours ?? 0) + noShiftTotalHours,
            overtimeMinutes: (lastScheduled.overtimeMinutes ?? 0) + noShiftOvertime,
            isAnomaly: lastScheduled.isAnomaly || noShiftAnomaly,
            notes: [lastScheduled.notes, noShiftNotes].filter(Boolean).join(' | ') || null,
          };
          sortedScheduled[sortedScheduled.length - 1] = updatedLastScheduled;
        }

        recordsToRender.push(...sortedScheduled);
      } else if (noShiftRecords.length > 0) {
        const sortedNoShift = [...noShiftRecords].sort((a, b) => {
          const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
          const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
          return timeA - timeB;
        });
        
        const firstRecord = sortedNoShift[0];
        const lastRecord = sortedNoShift[sortedNoShift.length - 1];
        
        const checkInRecords = sortedNoShift.filter(r => r.checkInTime);
        const earliestCheckInTime = checkInRecords.length > 0
          ? checkInRecords.reduce((earliest, current) => 
              new Date(current.checkInTime).getTime() < new Date(earliest.checkInTime).getTime() ? current : earliest
            ).checkInTime
          : null;

        const checkOutRecords = sortedNoShift.filter(r => r.checkOutTime);
        const latestCheckOutTime = checkOutRecords.length > 0
          ? checkOutRecords.reduce((latest, current) => 
              new Date(current.checkOutTime!).getTime() > new Date(latest.checkOutTime!).getTime() ? current : latest
            ).checkOutTime
          : null;

        const isShiftActive = sortedNoShift.some(r => r.isShiftActive);
        const workedHrsVal = sortedNoShift.reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
        const otMinsVal = sortedNoShift.reduce((sum, r) => sum + (r.overtimeMinutes ?? 0), 0);

        let aggregatedStatus = firstRecord.status;
        if (sortedNoShift.every(r => r.status === 'incomplete' && !r.checkOutTime)) {
          aggregatedStatus = 'incomplete';
        } else {
          const nonIncompleteRecord = sortedNoShift.find(r => r.status !== 'incomplete');
          if (nonIncompleteRecord) {
            aggregatedStatus = nonIncompleteRecord.status;
          }
        }

        const mergedNoShift: AttendanceRecord = {
          ...firstRecord,
          isShiftActive,
          checkInTime: earliestCheckInTime || firstRecord.checkInTime,
          checkOutTime: latestCheckOutTime,
          gracePeriodApplied: sortedNoShift.some(r => r.gracePeriodApplied),
          checkin_updated: sortedNoShift.some(r => r.checkin_updated) ? 'true' : null,
          checkout_updated: sortedNoShift.some(r => r.checkout_updated) ? 'true' : null,
          notes: sortedNoShift.map(r => r.notes).filter(Boolean).join(' | ') || null,
          isEarlyOut: lastRecord.isEarlyOut,
          isAnomaly: sortedNoShift.some(r => r.isAnomaly),
          lateMinutes: 0,
          undertimeMinutes: 0,
          overtimeMinutes: otMinsVal,
          totalHours: workedHrsVal,
          status: aggregatedStatus,
        };
        
        recordsToRender.push(mergedNoShift);
      }
      
      processedDateMap.set(dateStr, recordsToRender);
    }
    attByEmployee.set(empId, processedDateMap);
  }

  // Raw Logs: employeeId → dateStr → logs
  const rawLogsByEmployee = new Map<number, Map<string, RawPunchLog[]>>();
  for (const log of rawLogs) {
    const empId = log.employeeId;
    if (!rawLogsByEmployee.has(empId)) {
      rawLogsByEmployee.set(empId, new Map());
    }
    const phtDate = new Date(new Date(log.timestamp).getTime() + 8 * 60 * 60 * 1000);
    const dateStr = phtDate.toISOString().slice(0, 10);

    const dateMap = rawLogsByEmployee.get(empId)!;
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, []);
    }
    dateMap.get(dateStr)!.push(log);
  }

  // ── 5. Group employees by company (direct companyId) ────────────────
  const companyEmployees = new Map<string, RawEmployee[]>();
  let excludedCount = 0;

  for (const emp of allEmps) {
    const companyName = emp.Company?.name;
    if (!companyName) {
      // Employee has no companyId assigned — exclude from per-company sheets
      excludedCount++;
      continue;
    }
    if (!companyEmployees.has(companyName))
      companyEmployees.set(companyName, []);
    companyEmployees.get(companyName)!.push(emp);
  }

  // ── 6. Build calendar dates array ──────────────────────────────────
  const calDates: Date[] = [];
  const cursorDate = new Date(startDate + 'T00:00:00Z');
  const endD = new Date(endDate + 'T00:00:00Z');
  while (cursorDate <= endD) {
    calDates.push(new Date(cursorDate));
    cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);
  }
  const todayStr = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Manila',
  });

  // ── 7. Create workbook ─────────────────────────────────────────────
  const wb = XLSXS.utils.book_new();
  const sortedCompanies = Array.from(companyEmployees.keys()).sort();

  if (sortedCompanies.length === 0) {
    const ws: any = {};
    setStyledCell(ws, 0, 0, 'No company data found for this period.', STYLE_BOLD);
    ws['!ref'] = 'A1:D1';
    XLSXS.utils.book_append_sheet(wb, ws, 'No Data');
  }

  for (const companyName of sortedCompanies) {
    const emps = companyEmployees.get(companyName)!;
    emps.sort((a: RawEmployee, b: RawEmployee) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`
      )
    );

    const ws: any = {};

    if (emps.length === 0) {
      setStyledCell(ws, 0, 0, 'No employees found.', STYLE_BOLD);
      ws['!ref'] = 'A1:D1';
      XLSXS.utils.book_append_sheet(wb, ws, sanitizeSheetName(companyName));
      continue;
    }

    // ── Calculate dynamic dateRowOffsets globally for this company ──
    const dateRowOffsets = new Map<string, { startRowIdx: number; numRows: number }>();
    let currentWriteRowIdx = HEADER_ROWS;
    
    for (const date of calDates) {
      const dateStr = date.toISOString().split('T')[0];
      let maxRowsForDate = 1;
      for (const emp of emps) {
        const empRecordsMap = attByEmployee.get(emp.id);
        const dayRecordsList = empRecordsMap ? empRecordsMap.get(dateStr) || [] : [];
        const numRows = Math.max(1, dayRecordsList.length);
        if (numRows > maxRowsForDate) {
          maxRowsForDate = numRows;
        }
      }
      dateRowOffsets.set(dateStr, {
        startRowIdx: currentWriteRowIdx,
        numRows: maxRowsForDate
      });
      currentWriteRowIdx += maxRowsForDate;
    }
    const attendanceTableEndRowIdx = currentWriteRowIdx;
    let maxRowIdx = attendanceTableEndRowIdx;

    // ── Write each employee block horizontally ─────────────────────
    for (let empIdx = 0; empIdx < emps.length; empIdx++) {
      const emp = emps[empIdx];
      const c0 = empIdx * (COLS_PER_EMP + SEPARATOR_COLS);

      // Build display values
      const fullName = `${emp.firstName}${emp.middleName ? ` ${emp.middleName[0]}.` : ''} ${emp.lastName}${emp.suffix ? ` ${emp.suffix}` : ''}`.trim();
      const empNumber = emp.employeeNumber || '—';
      const deptName = emp.Department?.name || '—';
      const branchName = emp.Branch?.name || '—';
      const position = emp.position || '—';

      // Compute total late and undertime minutes for this employee across the entire period
      const empRecordsMap = attByEmployee.get(emp.id) || new Map();
      let empTotalLateMinutes = 0;
      let empTotalUndertimeMinutes = 0;
      for (const recs of empRecordsMap.values()) {
        for (const rec of recs) {
          empTotalLateMinutes += rec.lateMinutes ?? 0;
          empTotalUndertimeMinutes += rec.undertimeMinutes ?? 0;
        }
      }
      const empTotalCombinedMinutes = empTotalLateMinutes + empTotalUndertimeMinutes;

      // Row 0: [EmpNumber] | [FullName (merged B+C)] | DEPARTMENT | [DeptName (merged E+F)] | [TotalLate (G)]
      setStyledCell(ws, 0, c0, empNumber, STYLE_INFO_HEADER);
      setStyledCell(ws, 0, c0 + 1, fullName.toUpperCase(), STYLE_INFO_HEADER);
      setStyledCell(ws, 0, c0 + 2, '', STYLE_INFO_VALUE);
      setStyledCell(ws, 0, c0 + 3, 'DEPARTMENT', STYLE_INFO_HEADER);
      setStyledCell(ws, 0, c0 + 4, deptName, STYLE_INFO_VALUE);
      setStyledCell(ws, 0, c0 + 5, '', STYLE_INFO_VALUE);
      setStyledCell(ws, 0, c0 + 6, "LATE: " + formatTotalLate(empTotalLateMinutes), mergeStyle(STYLE_BOLD, ALIGN_CENTER));

      // Row 1: POSITION | [Position (merged B+C)] | SITE | [Branch (merged E+F)] | [TotalUT (G)]
      setStyledCell(ws, 1, c0, 'POSITION', STYLE_INFO_HEADER);
      setStyledCell(ws, 1, c0 + 1, position.toUpperCase(), STYLE_INFO_VALUE);
      setStyledCell(ws, 1, c0 + 2, '', STYLE_INFO_VALUE);
      setStyledCell(ws, 1, c0 + 3, 'SITE', STYLE_INFO_HEADER);
      setStyledCell(ws, 1, c0 + 4, branchName, STYLE_INFO_VALUE);
      setStyledCell(ws, 1, c0 + 5, '', STYLE_INFO_VALUE);
      setStyledCell(ws, 1, c0 + 6, "UT: " + formatTotalLate(empTotalUndertimeMinutes), mergeStyle(STYLE_BOLD, ALIGN_CENTER));

      // Merge header cells B+C and E+F
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r: 0, c: c0 + 1 }, e: { r: 0, c: c0 + 2 } }); // Name B1+C1
      ws['!merges'].push({ s: { r: 0, c: c0 + 4 }, e: { r: 0, c: c0 + 5 } }); // Dept E1+F1
      ws['!merges'].push({ s: { r: 1, c: c0 + 1 }, e: { r: 1, c: c0 + 2 } }); // Pos B2+C2
      ws['!merges'].push({ s: { r: 1, c: c0 + 4 }, e: { r: 1, c: c0 + 5 } }); // Branch E2+F2

      // Row 2 & 3: Table Headers
      // DATE, DAY, IN, OUT are merged vertically from row index 2 to 3
      setStyledCell(ws, 2, c0, 'DATE', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 1, 'DAY', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 2, 'IN', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 3, 'OUT', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 4, 'REMARKS', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 5, '', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 6, "TOTAL: " + formatTotalLate(empTotalCombinedMinutes), mergeStyle(STYLE_BOLD, ALIGN_CENTER));

      setStyledCell(ws, 3, c0, '', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 3, c0 + 1, '', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 3, c0 + 2, '', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 3, c0 + 3, '', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 3, c0 + 4, 'LATE', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 3, c0 + 5, 'UT', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 3, c0 + 6, '', FILL_NONE);

      ws['!merges'].push({ s: { r: 2, c: c0 }, e: { r: 3, c: c0 } });         // Date A3+A4
      ws['!merges'].push({ s: { r: 2, c: c0 + 1 }, e: { r: 3, c: c0 + 1 } }); // Day B3+B4
      ws['!merges'].push({ s: { r: 2, c: c0 + 2 }, e: { r: 3, c: c0 + 2 } }); // In C3+C4
      ws['!merges'].push({ s: { r: 2, c: c0 + 3 }, e: { r: 3, c: c0 + 3 } }); // Out D3+D4
      ws['!merges'].push({ s: { r: 2, c: c0 + 4 }, e: { r: 2, c: c0 + 5 } }); // Remarks E3+F3

      // Parse employee work days from shift
      let workDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      if (emp.Shift?.workDays) {
        try {
          const parsed =
            typeof emp.Shift.workDays === 'string'
              ? JSON.parse(emp.Shift.workDays)
              : emp.Shift.workDays;
          if (Array.isArray(parsed)) workDayNames = parsed;
        } catch {
          /* keep default */
        }
      }

      const empRecords = attByEmployee.get(emp.id) || new Map();
      const empOriginalRecords = attByEmployeeTemp.get(emp.id) || new Map();
      const empHireDate = emp.hireDate
        ? new Date(emp.hireDate).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Manila',
        })
        : null;

      // ── Walk every calendar date ───────────────────────────────
      for (let dayIdx = 0; dayIdx < calDates.length; dayIdx++) {
        const date = calDates[dayIdx];
        const dateStr = date.toISOString().split('T')[0];
        const layout = dateRowOffsets.get(dateStr)!;

        // Use locale-independent day name lookup
        const dayShort = SHORT_DAY_NAMES[date.getUTCDay()];
        const dayFull = date.toLocaleDateString('en-US', {
          weekday: 'long',
          timeZone: 'UTC',
        });

        const isRestDay = !workDayNames.includes(dayShort);
        const isFuture = dateStr > todayStr;
        const isHoliday = holidayDateSet.has(dateStr);
        const isBeforeHire = empHireDate ? dateStr < empHireDate : false;

        const empRecordsMap = attByEmployee.get(emp.id) || new Map();
        const dayRecordsList = empRecordsMap.get(dateStr) || [];
        const formattedDate = fmtFullDate(date);

        for (let offset = 0; offset < layout.numRows; offset++) {
          const rowIdx = layout.startRowIdx + offset;
          const record = dayRecordsList[offset];

          const dateVal = offset === 0 ? formattedDate : '';
          const dayVal = offset === 0 ? dayFull : '';

          if (isBeforeHire || isFuture) {
            // Blank row — before hire or future — no fill
            setStyledCell(ws, rowIdx, c0, dateVal, mergeStyle(FILL_NONE, ALIGN_CENTER));
            setStyledCell(ws, rowIdx, c0 + 1, dayVal, mergeStyle(FILL_NONE, ALIGN_CENTER));
            setStyledCell(ws, rowIdx, c0 + 2, '', mergeStyle(FILL_NONE, ALIGN_RIGHT));
            setStyledCell(ws, rowIdx, c0 + 3, '', mergeStyle(FILL_NONE, ALIGN_RIGHT));
            setStyledCell(ws, rowIdx, c0 + 4, '', FILL_NONE);
            setStyledCell(ws, rowIdx, c0 + 5, '', FILL_NONE);
            setStyledCell(ws, rowIdx, c0 + 6, '', FILL_NONE);
            ws['!merges'].push({ s: { r: rowIdx, c: c0 + 4 }, e: { r: rowIdx, c: c0 + 5 } });
          } else if (record) {
            // Has attendance record
            const checkIn = record.checkInTime ? new Date(record.checkInTime) : null;
            const checkOut = record.checkOutTime
              ? new Date(record.checkOutTime)
              : null;
            const checkInStr = checkIn
              ? checkIn.toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '';
            const checkOutStr = checkOut
              ? checkOut.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
              : '';

            const lateMins = record.lateMinutes ?? 0;
            const utMins = record.undertimeMinutes ?? 0;

            // Priority: Holiday > Rest Day > Late > On Time
            let rowFill: Record<string, unknown>;
            if (isHoliday) rowFill = FILL_HOLIDAY;
            else if (isRestDay) rowFill = FILL_REST_DAY;
            else if (lateMins > 0) rowFill = FILL_LATE;
            else rowFill = FILL_ON_TIME;

            setStyledCell(ws, rowIdx, c0, dateVal, mergeStyle(rowFill, ALIGN_CENTER));
            setStyledCell(ws, rowIdx, c0 + 1, dayVal, mergeStyle(rowFill, ALIGN_CENTER));
            setStyledCell(ws, rowIdx, c0 + 2, checkInStr, mergeStyle(rowFill, ALIGN_RIGHT));
            setStyledCell(ws, rowIdx, c0 + 3, checkOutStr, mergeStyle(rowFill, ALIGN_RIGHT));

            if (isHoliday || isRestDay) {
              const hName = holidayNameMap.get(dateStr);
              const remarks = isHoliday ? (hName || 'Holiday') : 'Rest Day';
              setStyledCell(ws, rowIdx, c0 + 4, remarks, mergeStyle(rowFill, ALIGN_CENTER));
              setStyledCell(ws, rowIdx, c0 + 5, '', rowFill);
              setStyledCell(ws, rowIdx, c0 + 6, '', FILL_NONE);
              ws['!merges'].push({ s: { r: rowIdx, c: c0 + 4 }, e: { r: rowIdx, c: c0 + 5 } });
            } else {
              const lateVal = lateMins > 0 ? formatTotalLate(lateMins) : '';
              const utVal = utMins > 0 ? formatTotalLate(utMins) : '';
              setStyledCell(ws, rowIdx, c0 + 4, lateVal, mergeStyle(rowFill, ALIGN_CENTER));
              setStyledCell(ws, rowIdx, c0 + 5, utVal, mergeStyle(rowFill, ALIGN_CENTER));
              setStyledCell(ws, rowIdx, c0 + 6, '', FILL_NONE);
            }
          } else {
            // No record — determine status & fill
            // Priority: Holiday > Rest Day > Absent
            let remarks = '';
            let rowFill: Record<string, unknown>;
            if (isHoliday) {
              const hName = holidayNameMap.get(dateStr);
              remarks = hName || 'Holiday';
              rowFill = FILL_HOLIDAY;
            } else if (isRestDay) {
              remarks = 'Rest Day';
              rowFill = FILL_REST_DAY;
            } else {
              remarks = 'Absent';
              rowFill = FILL_ABSENT;
            }

            if (dayRecordsList.length > 0) {
              const firstRecord = dayRecordsList[0];
              const lateMins = firstRecord.lateMinutes ?? 0;
              if (isHoliday) rowFill = FILL_HOLIDAY;
              else if (isRestDay) rowFill = FILL_REST_DAY;
              else if (lateMins > 0) rowFill = FILL_LATE;
              else rowFill = FILL_ON_TIME;
              remarks = ''; // No remarks on extra filled slots
            }

            setStyledCell(ws, rowIdx, c0, dateVal, mergeStyle(rowFill, ALIGN_CENTER));
            setStyledCell(ws, rowIdx, c0 + 1, dayVal, mergeStyle(rowFill, ALIGN_CENTER));
            setStyledCell(ws, rowIdx, c0 + 2, '', mergeStyle(rowFill, ALIGN_RIGHT));
            setStyledCell(ws, rowIdx, c0 + 3, '', mergeStyle(rowFill, ALIGN_RIGHT));
            
            if (offset === 0) {
              setStyledCell(ws, rowIdx, c0 + 4, remarks, mergeStyle(rowFill, ALIGN_CENTER));
              setStyledCell(ws, rowIdx, c0 + 5, '', rowFill);
              ws['!merges'].push({ s: { r: rowIdx, c: c0 + 4 }, e: { r: rowIdx, c: c0 + 5 } });
            } else {
              setStyledCell(ws, rowIdx, c0 + 4, '', rowFill);
              setStyledCell(ws, rowIdx, c0 + 5, '', rowFill);
              ws['!merges'].push({ s: { r: rowIdx, c: c0 + 4 }, e: { r: rowIdx, c: c0 + 5 } });
            }
            setStyledCell(ws, rowIdx, c0 + 6, '', FILL_NONE);
          }
        }
      }

      // ── Spacer Rows ───────────────────────────────
      // (Rows are left blank as in reference.xlsx)

      // ── Punches Header ──────────────────────────────────
      const punchesHeaderRowIdx = attendanceTableEndRowIdx + 2;
      setStyledCell(ws, punchesHeaderRowIdx, c0, 'Punches', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, punchesHeaderRowIdx, c0 + 1, 'Check-in', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, punchesHeaderRowIdx, c0 + 2, 'Check-out', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, punchesHeaderRowIdx, c0 + 3, 'Overtime-In', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, punchesHeaderRowIdx, c0 + 4, 'Overtime-out', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, punchesHeaderRowIdx, c0 + 5, 'Devices', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, punchesHeaderRowIdx, c0 + 6, 'Remarks', mergeStyle({ font: { bold: true, size: 11 } }, ALIGN_CENTER));

      // ── Detail Rows: Every raw punch ────────────
      let punchRowIdx = attendanceTableEndRowIdx + 3;
      let alternateColorFlag = false;

      for (let dayIdx = 0; dayIdx < calDates.length; dayIdx++) {
        const date = calDates[dayIdx];
        const dateStr = date.toISOString().split('T')[0];
        const dateLogsMap = rawLogsByEmployee.get(emp.id);
        const dayLogs = dateLogsMap ? dateLogsMap.get(dateStr) || [] : [];
        const dayOriginalRecords = empOriginalRecords.get(dateStr) || [];

        if (dayLogs.length > 0) {
          const alternateColor = alternateColorFlag ? 'FFEDEDED' : 'FFFFFFFF';
          alternateColorFlag = !alternateColorFlag;

          const formattedDate = fmtFullDate(date);

          for (const log of dayLogs) {
            const deleted = isLogDeleted(log, dayOriginalRecords);
            const textColor = deleted ? 'FFC00000' : 'FF000000';

            const baseStyle = {
              fill: { patternType: 'solid', fgColor: { rgb: alternateColor } },
              border: THIN_BORDER,
              font: { name: 'Calibri', size: 11, color: { rgb: textColor } }
            };

            // Column A: Date
            setStyledCell(ws, punchRowIdx, c0, formattedDate, mergeStyle(baseStyle, ALIGN_CENTER));

            // Populate columns B–F with baseStyle (bordered)
            for (let c = 1; c <= 5; c++) {
              setStyledCell(ws, punchRowIdx, c0 + c, '', baseStyle);
            }
            // Column G (Remarks) has NO border and NO background fill by default
            setStyledCell(ws, punchRowIdx, c0 + 6, '', FILL_NONE);

            const status = log.status;
            const phtTime = new Date(new Date(log.timestamp).getTime() + 8 * 60 * 60 * 1000);
            const timeStr = phtTime.toISOString().slice(11, 19);

            if (status === 0) {
              setStyledCell(ws, punchRowIdx, c0 + 1, timeStr, mergeStyle(baseStyle, ALIGN_CENTER));
            } else if (status === 1) {
              setStyledCell(ws, punchRowIdx, c0 + 2, timeStr, mergeStyle(baseStyle, ALIGN_CENTER));
            } else if (status === 4) {
              setStyledCell(ws, punchRowIdx, c0 + 3, timeStr, mergeStyle(baseStyle, ALIGN_CENTER));
            } else if (status === 5) {
              setStyledCell(ws, punchRowIdx, c0 + 4, timeStr, mergeStyle(baseStyle, ALIGN_CENTER));
            }

            // Column F: Device Name
            let deviceName = '—';
            if (log.deviceId) {
              deviceName = deviceMap.get(log.deviceId) || `Device ${log.deviceId}`;
            } else if (log.authMethod === 'MANUAL') {
              deviceName = 'Manual';
            } else {
              deviceName = 'Device 1';
            }
            setStyledCell(ws, punchRowIdx, c0 + 5, deviceName, mergeStyle(baseStyle, ALIGN_CENTER));

            // Column G: Status/Action
            if (deleted) {
              const remarksStyle = {
                font: { name: 'Calibri', size: 11, bold: true, italic: true, color: { rgb: textColor } }
              };
              setStyledCell(ws, punchRowIdx, c0 + 6, 'DELETED', mergeStyle(remarksStyle, ALIGN_CENTER));
            }

            punchRowIdx++;
          }
        }
      }

      if (punchRowIdx > maxRowIdx) {
        maxRowIdx = punchRowIdx;
      }
    }

    // ── Set worksheet range & column widths ─────────────────────────
    const totalCols =
      emps.length * (COLS_PER_EMP + SEPARATOR_COLS) - SEPARATOR_COLS;
    ws['!ref'] = XLSXS.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: maxRowIdx - 1, c: totalCols - 1 },
    });

    const cols: any[] = [];
    for (let i = 0; i < emps.length; i++) {
      const base = i * (COLS_PER_EMP + SEPARATOR_COLS);
      cols[base] = { wch: 18 }; // DATE / EmpNum
      cols[base + 1] = { wch: 16 }; // DAY / Name
      cols[base + 2] = { wch: 14 }; // IN
      cols[base + 3] = { wch: 14 }; // OUT
      cols[base + 4] = { wch: 14 }; // LATE (E) / Overtime-out / Overtime-out
      cols[base + 5] = { wch: 14 }; // UT (F) / Devices / Devices
      cols[base + 6] = { wch: 15 }; // Summary (G) / Remarks / Remarks
      if (i < emps.length - 1) {
        cols[base + 7] = { wch: 18 }; // Separator (wide gap)
      }
    }
    ws['!cols'] = cols;

    XLSXS.utils.book_append_sheet(wb, ws, sanitizeSheetName(companyName));
  }

  // ── 8. Write file ──────────────────────────────────────────────────
  const fileName = `Attendance_Report_All_Companies_${formatDateShort(startDate)}_to_${formatDateShort(endDate)}.xlsx`;
  XLSXS.writeFile(wb, fileName);

  // ── 9. Audit log ───────────────────────────────────────────────────
  fetch('/api/logs/export-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      exportType: 'report',
      entityType: 'Attendance',
      source: exportSource,
      details: `Exported all-companies report (${sortedCompanies.length} companies, ${allEmps.length - excludedCount} employees) for ${startDate} to ${endDate}`,
      filters: { dateFrom: startDate, dateTo: endDate, type: 'all-companies' },
      recordCount: records.length,
      fileFormat: 'xlsx',
      fileName,
    }),
  }).catch(() => { });

  return { excludedCount, truncationWarning };
};
