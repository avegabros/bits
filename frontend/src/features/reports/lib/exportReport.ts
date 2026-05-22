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
    'Total Late',
    'Overtime',
    'Undertime',
    'Reg Hrs',
  ]);

  let sumLateDays = 0;
  let sumLateMinutes = 0;

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
      formatTotalLate(e.lateMinutes),
      e.overtime > 0 ? formatHrsMins(e.overtime) : '—',
      e.undertime > 0 ? formatHrsMins(e.undertime) : '—',
      Math.max(0, e.totalHours).toFixed(2),
    ]);
    sumLateDays += e.late;
    sumLateMinutes += e.lateMinutes;
  });

  // Summary / totals row
  allRows.push([]);
  allRows.push([
    `TOTAL (${filteredData.length} employees)`,
    '',
    `${sumLateDays} late day(s)`,
    formatTotalLate(sumLateMinutes),
    '',
    '',
    '',
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
    'REG HOURS',
  ]); // Removed ABSENT
  const rate =
    emp.totalDays > 0 ? Math.round((emp.present / emp.totalDays) * 100) : 0;
  allRows.push([
    `${rate}%`,
    emp.present,
    emp.late,
    formatLateHrs(emp.lateMinutes),
    Math.max(0, emp.totalHours).toFixed(2),
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
  const cursor = new Date(s);
  while (cursor <= e) {
    totalCalendarDays++;
    const dayOfWeek = cursor.getUTCDay();
    const dateKey = cursor.toISOString().split('T')[0];
    const dayShort = cursor.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const dayRecords = recordsByDate.get(dateKey) || [];

    if (dayRecords.length > 0) {
      // Sort day records chronologically by check-in time
      const sortedDayRecords = [...dayRecords].sort((a, b) => 
        new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
      );

      const firstRecord = sortedDayRecords[0];
      const lastRecord = sortedDayRecords[sortedDayRecords.length - 1];
      const isShiftActive = dayRecords.some(r => r.isShiftActive);

      const workedHrsVal = dayRecords.reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
      const lateMinsVal = dayRecords.reduce((sum, r) => sum + (r.lateMinutes ?? 0), 0);
      const otMinsVal = dayRecords.reduce((sum, r) => sum + (r.overtimeMinutes ?? 0), 0);
      const utMinsVal = dayRecords.reduce((sum, r) => sum + (r.undertimeMinutes ?? 0), 0);

      // Construct representative merged record
      const mergedRecord: AttendanceRecord = {
        ...firstRecord,
        isShiftActive,
        checkOutTime: lastRecord.checkOutTime,
        gracePeriodApplied: dayRecords.some(r => r.gracePeriodApplied),
        checkin_updated: dayRecords.some(r => r.checkin_updated) ? 'true' : null,
        checkout_updated: dayRecords.some(r => r.checkout_updated) ? 'true' : null,
        notes: dayRecords.map(r => r.notes).filter(Boolean).join(' | '),
        isEarlyOut: lastRecord.isEarlyOut,
        isAnomaly: dayRecords.some(r => r.isAnomaly),
        lateMinutes: lateMinsVal,
        status: lastRecord.status === 'incomplete' ? 'incomplete' : firstRecord.status,
      };

      const checkIn = new Date(firstRecord.checkInTime);
      const checkOut = lastRecord.checkOutTime ? new Date(lastRecord.checkOutTime) : null;
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
      } else {
        displayStatus = 'On Time';
      }

      // Check Out column — mirrors UI "Active" indicator
      const checkOutLabel = isShiftActive
        ? 'Active'
        : checkOut
          ? checkOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : '—';

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
        checkIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
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

const COLS_PER_EMP = 6;
const SEPARATOR_COLS = 1;
const HEADER_ROWS = 3;

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

const ALIGN_CENTER: Record<string, unknown> = { alignment: { horizontal: 'center' as const } };
const ALIGN_RIGHT: Record<string, unknown> = { alignment: { horizontal: 'right' as const } };

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
  alignment: { horizontal: 'center' as const },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFBDD7EE' } },
  border: THIN_BORDER,
};
const STYLE_INFO_VALUE: Record<string, unknown> = {
  alignment: { horizontal: 'center' as const },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFBDD7EE' } },
  border: THIN_BORDER,
};
// Header row 2 (DATE, DAY, IN, OUT, REMARKS): gray, bold, centered, bordered
const STYLE_COL_HEADER: Record<string, unknown> = {
  font: { bold: true },
  alignment: { horizontal: 'center' as const },
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

export const handleExportAllCompanies = async (
  startDate: string,
  endDate: string,
  exportSource: 'admin-panel' | 'hr-panel' = 'admin-panel'
): Promise<{ excludedCount: number; truncationWarning: boolean }> => {
  // ── 1. Fetch all required data ─────────────────────────────────────
  const startYear = new Date(startDate + 'T00:00:00Z').getFullYear();
  const [empRes, attRes, branchRes, holRes] = await Promise.all([
    fetch('/api/employees?limit=5000', { credentials: 'include' }),
    fetch(
      `/api/attendance?startDate=${startDate}&endDate=${endDate}&limit=10000`,
      { credentials: 'include' }
    ),
    fetch('/api/branches', { credentials: 'include' }),
    fetch(`/api/holidays?year=${startYear}`, { credentials: 'include' }),
  ]);

  const empData = await empRes.json();
  const attData = attRes.ok ? await attRes.json() : { success: false };
  const branchData = branchRes.ok
    ? await branchRes.json()
    : { success: false };
  const holData = holRes.ok ? await holRes.json() : { success: false };

  // ── 2. Parse & filter ──────────────────────────────────────────────
  const allEmps: any[] = (
    empData.employees ||
    empData.data ||
    []
  ).filter(
    (e: any) => e.employmentStatus === 'ACTIVE' && (e.role === 'USER' || !e.role)
  );
  const records: any[] = attData.success ? attData.data || [] : [];
  const branches: any[] = branchData.success
    ? branchData.branches || branchData.data || []
    : [];
  const holidays: any[] = holData.success ? holData.holidays || [] : [];

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
  const attByEmployeeTemp = new Map<number, Map<string, any[]>>();
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

  const attByEmployee = new Map<number, Map<string, any>>();
  for (const [empId, dateMap] of attByEmployeeTemp.entries()) {
    const mergedDateMap = new Map<string, any>();
    for (const [dateStr, dayRecords] of dateMap.entries()) {
      const sortedDayRecords = [...dayRecords].sort((a, b) => 
        new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
      );
      const firstRecord = sortedDayRecords[0];
      const lastRecord = sortedDayRecords[sortedDayRecords.length - 1];
      const isShiftActive = dayRecords.some(r => r.isShiftActive);
      const workedHrsVal = dayRecords.reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
      const lateMinsVal = dayRecords.reduce((sum, r) => sum + (r.lateMinutes ?? 0), 0);
      const otMinsVal = dayRecords.reduce((sum, r) => sum + (r.overtimeMinutes ?? 0), 0);
      const utMinsVal = dayRecords.reduce((sum, r) => sum + (r.undertimeMinutes ?? 0), 0);

      const mergedRecord = {
        ...firstRecord,
        isShiftActive,
        checkInTime: firstRecord.checkInTime,
        checkOutTime: lastRecord.checkOutTime,
        gracePeriodApplied: dayRecords.some(r => r.gracePeriodApplied),
        checkin_updated: dayRecords.some(r => r.checkin_updated) ? 'true' : null,
        checkout_updated: dayRecords.some(r => r.checkout_updated) ? 'true' : null,
        notes: dayRecords.map(r => r.notes).filter(Boolean).join(' | '),
        isEarlyOut: lastRecord.isEarlyOut,
        isAnomaly: dayRecords.some(r => r.isAnomaly),
        lateMinutes: lateMinsVal,
        undertimeMinutes: utMinsVal,
        overtimeMinutes: otMinsVal,
        totalHours: workedHrsVal,
        status: lastRecord.status === 'incomplete' ? 'incomplete' : firstRecord.status,
      };
      mergedDateMap.set(dateStr, mergedRecord);
    }
    attByEmployee.set(empId, mergedDateMap);
  }

  // ── 5. Group employees by company (direct companyId) ────────────────
  const companyEmployees = new Map<string, any[]>();
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
    emps.sort((a: any, b: any) =>
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

      // Compute total late minutes for this employee across the entire period
      const empRecordsMap = attByEmployee.get(emp.id) || new Map();
      let empTotalLateMinutes = 0;
      for (const rec of empRecordsMap.values()) {
        empTotalLateMinutes += rec.lateMinutes ?? 0;
      }

      // Row 0: [EmpNumber] | [FullName (merged B+C)] | DEPARTMENT | [DeptName] | [TotalLate]
      setStyledCell(ws, 0, c0, empNumber, STYLE_INFO_HEADER);
      setStyledCell(ws, 0, c0 + 1, fullName.toUpperCase(), STYLE_INFO_HEADER);
      setStyledCell(ws, 0, c0 + 2, '', STYLE_INFO_VALUE);
      setStyledCell(ws, 0, c0 + 3, 'DEPARTMENT', STYLE_INFO_HEADER);
      setStyledCell(ws, 0, c0 + 4, deptName, STYLE_INFO_VALUE);
      setStyledCell(ws, 0, c0 + 5, formatTotalLate(empTotalLateMinutes), mergeStyle(STYLE_BOLD, ALIGN_CENTER));

      // Row 1: POSITION | [Position (merged B+C)] | SITE | [Branch] | (empty)
      setStyledCell(ws, 1, c0, 'POSITION', STYLE_INFO_HEADER);
      setStyledCell(ws, 1, c0 + 1, position.toUpperCase(), STYLE_INFO_VALUE);
      setStyledCell(ws, 1, c0 + 2, '', STYLE_INFO_VALUE);
      setStyledCell(ws, 1, c0 + 3, 'SITE', STYLE_INFO_HEADER);
      setStyledCell(ws, 1, c0 + 4, branchName, STYLE_INFO_VALUE);
      setStyledCell(ws, 1, c0 + 5, '', FILL_NONE);

      // Merge cells B+C for name (row 0) and position (row 1)
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r: 0, c: c0 + 1 }, e: { r: 0, c: c0 + 2 } });
      ws['!merges'].push({ s: { r: 1, c: c0 + 1 }, e: { r: 1, c: c0 + 2 } });

      // Row 2: DATE | DAY | IN | OUT | REMARKS | (empty)
      setStyledCell(ws, 2, c0, 'DATE', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 1, 'DAY', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 2, 'IN', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 3, 'OUT', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 4, 'REMARKS', mergeStyle(STYLE_COL_HEADER, ALIGN_CENTER));
      setStyledCell(ws, 2, c0 + 5, '', FILL_NONE);

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
      const empHireDate = emp.hireDate
        ? new Date(emp.hireDate).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Manila',
        })
        : null;

      // ── Walk every calendar date ───────────────────────────────
      for (let dayIdx = 0; dayIdx < calDates.length; dayIdx++) {
        const date = calDates[dayIdx];
        const rowIdx = HEADER_ROWS + dayIdx;
        const dateStr = date.toISOString().split('T')[0];
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
        const record = empRecords.get(dateStr);

        const formattedDate = fmtFullDate(date);

        if (isBeforeHire || isFuture) {
          // Blank row — before hire or future — no fill
          setStyledCell(ws, rowIdx, c0, formattedDate, mergeStyle(FILL_NONE, ALIGN_CENTER));
          setStyledCell(ws, rowIdx, c0 + 1, dayFull, mergeStyle(FILL_NONE, ALIGN_CENTER));
          setStyledCell(ws, rowIdx, c0 + 2, '', mergeStyle(FILL_NONE, ALIGN_RIGHT));
          setStyledCell(ws, rowIdx, c0 + 3, '', mergeStyle(FILL_NONE, ALIGN_RIGHT));
          setStyledCell(ws, rowIdx, c0 + 4, '', FILL_NONE);
          setStyledCell(ws, rowIdx, c0 + 5, '', ALIGN_CENTER);
        } else if (record) {
          // Has attendance record
          const checkIn = new Date(record.checkInTime);
          const checkOut = record.checkOutTime
            ? new Date(record.checkOutTime)
            : null;
          const checkInStr = checkIn.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
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

          // Remarks: show late H:MM, or keep other labels
          let remarks = '';
          if (isHoliday) {
            const hName = holidayNameMap.get(dateStr);
            remarks = hName || 'Holiday';
          } else if (isRestDay) {
            remarks = 'Rest Day';
          } else if (lateMins > 0) {
            remarks = formatTotalLate(lateMins);
          } else if (utMins > 0) {
            remarks = `UT ${formatLateHrs(utMins)}`;
          }

          // Priority: Holiday > Rest Day > Late > On Time
          let rowFill: Record<string, unknown>;
          if (isHoliday) rowFill = FILL_HOLIDAY;
          else if (isRestDay) rowFill = FILL_REST_DAY;
          else if (lateMins > 0) rowFill = FILL_LATE;
          else rowFill = FILL_ON_TIME;

          setStyledCell(ws, rowIdx, c0, formattedDate, mergeStyle(rowFill, ALIGN_CENTER));
          setStyledCell(ws, rowIdx, c0 + 1, dayFull, mergeStyle(rowFill, ALIGN_CENTER));
          setStyledCell(ws, rowIdx, c0 + 2, checkInStr, mergeStyle(rowFill, ALIGN_RIGHT));
          setStyledCell(ws, rowIdx, c0 + 3, checkOutStr, mergeStyle(rowFill, ALIGN_RIGHT));
          setStyledCell(ws, rowIdx, c0 + 4, remarks, mergeStyle(rowFill, ALIGN_RIGHT));
          setStyledCell(ws, rowIdx, c0 + 5, '', FILL_NONE);
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

          setStyledCell(ws, rowIdx, c0, formattedDate, mergeStyle(rowFill, ALIGN_CENTER));
          setStyledCell(ws, rowIdx, c0 + 1, dayFull, mergeStyle(rowFill, ALIGN_CENTER));
          setStyledCell(ws, rowIdx, c0 + 2, '', mergeStyle(rowFill, ALIGN_RIGHT));
          setStyledCell(ws, rowIdx, c0 + 3, '', mergeStyle(rowFill, ALIGN_RIGHT));
          setStyledCell(ws, rowIdx, c0 + 4, remarks, mergeStyle(rowFill, ALIGN_RIGHT));
          setStyledCell(ws, rowIdx, c0 + 5, '', FILL_NONE);
        }
      }
    }

    // ── Set worksheet range & column widths ─────────────────────────
    const totalCols =
      emps.length * (COLS_PER_EMP + SEPARATOR_COLS) - SEPARATOR_COLS;
    const totalRows = HEADER_ROWS + calDates.length;
    ws['!ref'] = XLSXS.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: totalRows - 1, c: totalCols - 1 },
    });

    const cols: any[] = [];
    for (let i = 0; i < emps.length; i++) {
      const base = i * (COLS_PER_EMP + SEPARATOR_COLS);
      cols[base] = { wch: 18 }; // DATE / EmpNum
      cols[base + 1] = { wch: 16 }; // DAY / Name
      cols[base + 2] = { wch: 14 }; // IN
      cols[base + 3] = { wch: 14 }; // OUT
      cols[base + 4] = { wch: 16 }; // REMARKS
      cols[base + 5] = { wch: 10 }; // Late H:MM
      if (i < emps.length - 1) {
        cols[base + 6] = { wch: 18 }; // Separator (wide gap)
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
