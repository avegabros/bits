import { useState, useEffect } from 'react';
import { AttendanceRecord, ReportRow } from '@/types/reports';

/**
 * Counts the number of scheduled working days within a date range
 * based on the shift's workDays JSON configuration.
 * Caps at today's date — future dates are not counted.
 */
function countWorkingDays(
  rangeStart: string,
  rangeEnd: string,
  workDaysJson: string
): number {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let scheduledDays: string[];
  try {
    scheduledDays = typeof workDaysJson === 'string' 
      ? JSON.parse(workDaysJson) 
      : workDaysJson;
    
    if (!Array.isArray(scheduledDays)) {
      scheduledDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    }
  } catch {
    scheduledDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  }

  // Use strict UTC to prevent local-timezone off-by-one errors
  const start = new Date(rangeStart + 'T00:00:00Z');
  // Cap end date at today (PHT) so future dates are never counted
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const cappedEnd = rangeEnd > todayStr ? todayStr : rangeEnd;
  const end = new Date(cappedEnd + 'T00:00:00Z');

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dayName = DAY_NAMES[cursor.getUTCDay()];
    if (scheduledDays.includes(dayName)) {
      count++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export const useReportData = (startDate: string, endDate: string) => {
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [empRes, attRes] = await Promise.all([
          fetch('/api/employees', { credentials: 'include' }),
          fetch(
            `/api/attendance?startDate=${startDate}&endDate=${endDate}&limit=10000`,
            { credentials: 'include' }
          ),
        ]);

        if (empRes.status === 401 || attRes.status === 401) {
          window.location.href = '/login';
          return;
        }

        const empData = await empRes.json();
        const attData = attRes.ok ? await attRes.json() : { success: false };

        if (!empData.success) {
          setError('Failed to fetch employee data. Please try again.');
          setLoading(false);
          return;
        }
        if (!attData.success) {
           setError('Failed to fetch attendance data. Please try again.');
           setLoading(false);
           return;
        }

        interface RawEmployee {
          id: number;
          firstName: string;
          lastName: string;
          middleName?: string;
          suffix?: string;
          employeeNumber?: string | null;
          zkId?: number | null;
          Department?: { name: string };
          Section?: { name: string };
          Branch?: { name: string };
          employmentStatus: string;
          role: string;
          Shift?: {
            id: number;
            name: string;
            startTime: string;
            endTime: string;
            graceMinutes?: number;
            breakMinutes?: number;
            workDays?: string;
            halfDays?: string;
          };
        }

        const emps: RawEmployee[] = empData.employees || empData.data || [];
        const records: AttendanceRecord[] = attData.success
          ? attData.data || []
          : [];

        setAllRecords(records);

        const activeEmps = emps.filter(
          (e) => e.employmentStatus === 'ACTIVE' && e.role === 'USER'
        );
        const rowMap = new Map<number, ReportRow>();

        // Pre-initialize rows and compute totalDays from shift schedule
        activeEmps.forEach((e) => {
          const workDaysJson =
            e.Shift?.workDays ?? '["Mon","Tue","Wed","Thu","Fri"]';

          // Derive totalDays from the shift's workDays configuration
          const totalDays = countWorkingDays(startDate, endDate, workDaysJson);

          rowMap.set(e.id, {
            id: e.id,
            name: `${e.firstName}${e.middleName ? ` ${e.middleName[0]}.` : ''} ${e.lastName}${e.suffix ? ` ${e.suffix}` : ''}`.trim(),
            employeeNumber: e.employeeNumber ?? null,
            zkId: e.zkId ?? null,
            department: e.Department?.name || '—',
            section: e.Section?.name || '—',
            branch: e.Branch?.name || '—',
            totalDays,
            present: 0,
            late: 0,
            lateMinutes: 0,
            overtime: 0,
            undertime: 0,
            totalHours: 0,
            hasAnomaly: false,
            hasMissingCheckout: false,
            missingCheckoutsCount: 0,
            shift: e.Shift
              ? {
                  id: e.Shift.id,
                  name: e.Shift.name,
                  startTime: e.Shift.startTime,
                  endTime: e.Shift.endTime,
                  graceMinutes: e.Shift.graceMinutes ?? 0,
                  breakMinutes: e.Shift.breakMinutes ?? 60,
                  workDays: e.Shift.workDays ?? '["Mon","Tue","Wed","Thu","Fri"]',
                  halfDays: e.Shift.halfDays ?? '[]',
                }
              : null,
          });
        });

        records.forEach((r) => {
          const row = rowMap.get(r.employeeId);
          if (!row) return;

          // OT-only records (punch-in during approved overtime with no regular shift assigned)
          // should NOT contribute regular hours, late minutes, or undertime to report summaries.
          const isOtOnly = !r.shift && !r.shiftCode;

          if (!isOtOnly) {
            const lateMins = r.lateMinutes ?? 0;
            if (lateMins > 0) {
              row.late++;
              row.lateMinutes += lateMins;
            }
          }
          // Increment present for any valid check-in (OT punch-ins count as present)
          row.present++;

          if (r.isAnomaly) {
            row.hasAnomaly = true;
          }

          if (r.checkOutTime === null && r.status === 'incomplete') {
            row.hasMissingCheckout = true;
            row.missingCheckoutsCount++;
          }

          row.totalHours += isOtOnly ? 0 : (r.totalHours ?? 0);
          row.overtime += (r.overtimeMinutes ?? 0) / 60;
          row.undertime += isOtOnly ? 0 : ((r.undertimeMinutes ?? 0) / 60);
        });

        setReportData(Array.from(rowMap.values()));
      } catch (err) {
        console.error('Error fetching report data:', err);
        setError('An unexpected error occurred while loading the report.');
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [startDate, endDate]);

  return { reportData, allRecords, loading, error };
};
