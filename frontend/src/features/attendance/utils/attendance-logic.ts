import { AttendanceRecord } from '../types';

export function formatEmployeeName(emp?: { firstName: string; middleName?: string; lastName: string; suffix?: string }) {
  if (!emp) return 'Unknown';
  const firstName = emp.firstName || '';
  const lastName = emp.lastName || '';
  const mid = emp.middleName ? ` ${emp.middleName.trim()[0]}.` : '';
  const suf = emp.suffix ? ` ${emp.suffix.trim()}` : '';
  return `${firstName.trim()}${mid} ${lastName.trim()}${suf}`.trim();
}

export function processAttendanceData(
  rawLogs: any[],
  employees: any[],
  selectedDate: string,
  holidays: any[]
): {
  records: AttendanceRecord[];
  stats: {
    onTime: number;
    late: number;
    absent: number;
    restDay: number;
    incomplete: number;
    total: number;
    avgHours: string;
    totalOT: string;
    totalUT: string;
  };
} {
  // 1. Identify holiday that applies to this date
  const matchedHoliday = holidays.find(
    (h) => new Date(h.date).toISOString().split('T')[0] === selectedDate
  );

  const holidayAppliesTo = (holiday: any, branchId?: number | null) => {
    if (!holiday?.branches || holiday.branches.length === 0) return true; // National
    if (!branchId) return true; // No branch = treat as affected
    return holiday.branches.some((b: any) => b.branchId === branchId);
  };

  const isPendingManualCreation = (r: any) =>
    r.isPending === true && (r.notes ?? '').includes('[Pending] Manual creation');

  // 2. Map existing logs
  const mapped: AttendanceRecord[] = rawLogs.map((log: any) => {
    const emp = log.employee || log.Employee;
    const isPending = log.isPending === true;
    const pendingManual = isPending && log.notes?.includes('[Pending] Manual creation');

    const checkIn = log.checkInTime ? new Date(log.checkInTime) : new Date();
    const checkOut = log.checkOutTime ? new Date(log.checkOutTime) : null;
    const isOtOnlyRecord = !log.shift && !log.shiftId && !log.shiftCode && (log.approvedOts && log.approvedOts.length > 0);

    const totalHours: number = (pendingManual || isOtOnlyRecord) ? 0 : (log.totalHours ?? (checkOut ? (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) : 0));
    const lateMinutes: number = pendingManual ? 0 : (log.lateMinutes ?? 0);
    const overtimeMinutes: number = pendingManual ? 0 : (log.overtimeMinutes ?? 0);
    const undertimeMinutes: number = pendingManual ? 0 : (log.undertimeMinutes ?? 0);

    const shiftCode: string | null = log.shift?.shiftCode ?? log.shiftCode ?? emp?.Shift?.shiftCode ?? null;
    const shiftId: number | null = log.shift?.id ?? log.shiftId ?? null;
    const shiftName: string | null = log.shift?.name ?? null;

    const isAnomaly: boolean = pendingManual ? false : (log.isAnomaly ?? false);
    const isEarlyOut: boolean = pendingManual ? false : (log.isEarlyOut ?? false);
    const isShiftActive: boolean = pendingManual ? false : (log.isShiftActive ?? false);
    const gracePeriodApplied: boolean = log.gracePeriodApplied ?? false;

    let computedStatus = isEarlyOut ? 'early-out' : isAnomaly ? 'anomaly' : lateMinutes > 0 ? 'late' : undertimeMinutes > 0 ? 'undertime' : (log.status || 'present');
    const hasMissingCheckout = log.checkOutTime === null && log.status === 'incomplete';

    let displayStatus = isShiftActive ? 'IN_PROGRESS' : hasMissingCheckout ? 'missing_checkout' : computedStatus;

    if (pendingManual) {
      computedStatus = 'absent';
      displayStatus = 'absent';
    }

    return {
      id: log.id,
      employeeId: log.employeeId,
      employeeName: formatEmployeeName(emp),
      profilePicture: emp?.profilePicture || null,
      department: emp?.Department?.name || 'General',
      sectionName: emp?.Section?.name || '—',
      branchName: emp?.Branch?.name || '—',
      companyName: emp?.Company?.name || null,
      date: new Date(log.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
      checkIn: pendingManual ? '—' : (log.checkInTime ? checkIn.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'),
      checkOut: pendingManual ? '—' : (checkOut ? checkOut.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'),
      status: computedStatus,
      displayStatus,
      lateMinutes,
      totalHours,
      overtimeMinutes,
      undertimeMinutes,
      shiftId,
      shiftCode,
      shiftName,
      shiftStartTime: log.shift?.startTime ?? emp?.Shift?.startTime,
      shiftEndTime: log.shift?.endTime ?? emp?.Shift?.endTime,
      isNightShift: log.shift?.isNightShift ?? emp?.Shift?.isNightShift ?? false,
      isAnomaly,
      isEarlyOut,
      isShiftActive,
      gracePeriodApplied,
      notes: log.notes || null,
      isEarlyPunch: log.isEarlyPunch ?? false,
      isMissingCheckout: log.isMissingCheckout ?? false,
      checkInDevice: log.checkInDeviceName ?? log.checkInDevice?.name ?? null,
      checkOutDevice: log.checkOutDeviceName ?? log.checkOutDevice?.name ?? null,
      checkInAuthMethod: log.checkInAuthMethod || null,
      checkOutAuthMethod: log.checkOutAuthMethod || null,
      checkoutSource: log.checkoutSource ?? null,
      isEdited: log.isEdited ?? !!(log.checkin_updated || log.checkout_updated),
      isPending,
      approvedOts: log.approvedOts || [],
    };
  });

  // 3. Track present shifts by employee to inject absent rows
  const presentShiftsByEmployee = new Map<number, Set<number | null>>();
  for (const r of mapped) {
    if (isPendingManualCreation(r)) continue;
    if (!presentShiftsByEmployee.has(r.employeeId)) {
      presentShiftsByEmployee.set(r.employeeId, new Set());
    }
    presentShiftsByEmployee.get(r.employeeId)!.add(r.shiftId);
  }
  const presentIds = new Set(mapped.filter(r => !isPendingManualCreation(r)).map(r => r.employeeId));
  const hasAnyRecordIds = new Set(mapped.map(r => r.employeeId));

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const isFutureDate = selectedDate > todayStr;

  const selectedDayName = new Date(selectedDate + 'T00:00:00Z')
    .toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

  const isWorkDayForShift = (workDays?: string): boolean => {
    if (workDays) {
      try {
        const wDays = typeof workDays === 'string' ? JSON.parse(workDays) : workDays;
        if (Array.isArray(wDays)) return wDays.includes(selectedDayName);
      } catch { }
    }
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(selectedDayName);
  };

  // 4. Inject absent/rest-day rows
  const absentRows: AttendanceRecord[] = [];
  if (!isFutureDate) {
    for (const e of employees) {
      // If employee already has any check-in record for the day, they are present! Skip absent injection completely.
      if (presentIds.has(e.id)) continue;
      // If they already have any record (e.g. pending manual creation), skip injecting new absent row
      if (hasAnyRecordIds.has(e.id)) continue;

      // Hire date check: skip if hired after selectedDate
      if (e.hireDate) {
        const hireDateStr = new Date(e.hireDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
        if (selectedDate < hireDateStr) continue;
      }

      // Holiday check: skip if affected by holiday
      if (matchedHoliday && holidayAppliesTo(matchedHoliday, e.branchId)) continue;

      const employeePresentShifts = presentShiftsByEmployee.get(e.id);
      const shifts = (e.EmployeeShift && e.EmployeeShift.length > 0)
        ? e.EmployeeShift.map((es: any) => es.shift)
        : (e.Shift ? [e.Shift] : [{ id: null, name: null, shiftCode: null, isNightShift: false, startTime: undefined, endTime: undefined, workDays: undefined }]);

      shifts.forEach((shift: any, idx: number) => {
        const shiftId = shift.id ?? null;
        if (employeePresentShifts?.has(shiftId)) return;

        const isWorking = isWorkDayForShift(shift.workDays);
        const rowStatus = isWorking ? 'absent' : 'rest_day';

        absentRows.push({
          id: `absent-${e.id}${idx > 0 ? `-s${idx}` : ''}`,
          employeeId: e.id,
          employeeName: formatEmployeeName(e),
          profilePicture: e.profilePicture || null,
          department: e.Department?.name || 'General',
          sectionName: e.Section?.name || '—',
          branchName: e.Branch?.name || '—',
          companyName: e.Company?.name || null,
          date: selectedDate,
          checkIn: '—',
          checkOut: '—',
          status: rowStatus,
          displayStatus: rowStatus,
          lateMinutes: 0,
          totalHours: 0,
          overtimeMinutes: 0,
          undertimeMinutes: 0,
          shiftId,
          shiftCode: shift.shiftCode ?? null,
          shiftName: shift.name ?? null,
          shiftStartTime: shift.startTime,
          shiftEndTime: shift.endTime,
          isNightShift: shift.isNightShift ?? false,
          isAnomaly: false,
          isEarlyOut: false,
          isShiftActive: false,
          gracePeriodApplied: false,
          approvedOts: [],
        });
      });
    }
  }

  const allRecords = [...mapped, ...absentRows];

  // 5. Calculate statistics from statsRecords (excluding pending manual creations)
  const statsRecords = allRecords.filter(r => !isPendingManualCreation(r));

  // Stats computation at employee level to keep it robust and consistent with totals
  let onTime = 0;
  let late = 0;
  let absent = 0;
  let restDay = 0;
  let incomplete = 0;

  for (const e of employees) {
    // Hire date check
    if (e.hireDate) {
      const hireDateStr = new Date(e.hireDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      if (selectedDate < hireDateStr) continue;
    }

    // Holiday check
    if (matchedHoliday && holidayAppliesTo(matchedHoliday, e.branchId)) continue;

    const empRecords = statsRecords.filter((r) => r.employeeId === e.id);

    if (empRecords.length > 0) {
      // Checked in!
      const hasLate = empRecords.some((r) => r.lateMinutes > 0);
      if (hasLate) {
        late++;
      } else {
        onTime++;
      }

      const hasIncomplete = empRecords.some(
        (r) => r.status === 'incomplete' || r.displayStatus === 'missing_checkout'
      );
      if (hasIncomplete) {
        incomplete++;
      }
    } else {
      // Not checked in
      const shifts = (e.EmployeeShift && e.EmployeeShift.length > 0)
        ? e.EmployeeShift.map((es: any) => es.shift)
        : (e.Shift ? [e.Shift] : [{ workDays: undefined }]);

      const isWorking = shifts.some((s: any) => isWorkDayForShift(s.workDays));
      if (isWorking) {
        absent++;
      } else {
        restDay++;
      }
    }
  }

  const total = onTime + late + absent + restDay;

  const avgHours = statsRecords.length > 0
    ? (statsRecords.filter(r => r.totalHours > 0).reduce((s, r) => s + r.totalHours, 0) /
      (statsRecords.filter(r => r.totalHours > 0).length || 1)).toFixed(1) : '0';

  const totalOT = (statsRecords.reduce((s, r) => s + (r.overtimeMinutes ?? 0), 0) / 60).toFixed(1);
  const totalUT = (statsRecords.reduce((s, r) => s + (r.undertimeMinutes ?? 0), 0) / 60).toFixed(1);

  return {
    records: allRecords,
    stats: {
      onTime,
      late,
      absent,
      restDay,
      incomplete,
      total,
      avgHours,
      totalOT,
      totalUT,
    },
  };
}

export interface StatusBadge {
  text: string;
  className: string;
}

export function getStatusBadges(row: AttendanceRecord): StatusBadge[] {
  const badges: StatusBadge[] = [];

  if (row.isMerged) {
    badges.push({ text: 'Multiple Shifts', className: 'text-slate-500 bg-slate-500/10 border-slate-500/20' });
    return badges;
  }

  if (row.isShiftActive) {
    badges.push({ text: 'In Progress', className: 'text-blue-500 bg-blue-500/10 border-blue-500/20' });
    return badges;
  }

  const status = row.status;
  if (status === 'absent') {
    badges.push({ text: 'Absent', className: 'text-red-500 bg-red-500/10 border-red-500/20' });
    return badges;
  }
  if (status === 'rest_day') {
    badges.push({ text: 'Rest Day', className: 'text-slate-400 bg-slate-400/10 border-slate-400/20' });
    return badges;
  }
  if (status === 'holiday') {
    badges.push({ text: 'Holiday', className: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' });
    return badges;
  }
  if (status === 'incomplete' || row.displayStatus === 'missing_checkout') {
    badges.push({ text: 'Missing Checkout', className: 'text-amber-600 bg-amber-500/10 border-amber-500/20' });
    return badges;
  }

  // Checked in record
  if (row.lateMinutes > 0) {
    badges.push({ text: 'Late', className: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' });
  } else {
    badges.push({ text: 'On Time', className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' });
  }

  if (row.undertimeMinutes > 0) {
    badges.push({ text: 'Undertime', className: 'text-red-500 bg-red-500/10 border-red-500/20' });
  }
  if (row.overtimeMinutes > 0) {
    badges.push({ text: 'Overtime', className: 'text-emerald-600 bg-emerald-600/10 border-emerald-600/20' });
  }

  return badges;
}

