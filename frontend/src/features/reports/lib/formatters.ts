import { AttendanceRecord } from '@/types/reports';

/** Derive a display status from backend-enriched record fields */
export const getRecordStatusFromBackend = (
  r: AttendanceRecord
): 'early-out' | 'anomaly' | 'late' | 'on-time' | 'in-progress' | 'missing-checkout' => {
  if (r.isShiftActive) return 'in-progress';
  if (r.checkOutTime === null && r.status === 'incomplete') return 'missing-checkout';
  if (r.isEarlyOut) return 'early-out';
  if (r.isAnomaly) return 'anomaly';
  if ((r.lateMinutes ?? 0) > 0 || r.status === 'late') return 'late';
  return 'on-time';
};

export const formatLateHrs = (mins: number) => {
  if (mins === 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const formatHrsMins = (hrs: number) => {
  if (hrs === 0) return '—';
  const totalMins = Math.round(hrs * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
};

export const formatDateShort = (d: string) => {
  const date = new Date(d + 'T00:00:00Z');
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(
    date.getUTCMonth() + 1
  ).padStart(2, '0')}/${date.getUTCFullYear()}`;
};

/** Convert total minutes to H:MM format — e.g. 179 → "2:59", 0 → "0:00" */
export const formatTotalLate = (mins: number): string => {
  const totalMins = Math.round(Math.abs(mins));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

export const formatShiftTime = (t: string) => {
  // "08:00" → "8:00 AM", "22:00" → "10:00 PM"
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};
