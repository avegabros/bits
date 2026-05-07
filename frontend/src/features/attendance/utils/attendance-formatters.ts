export const formatLate = (mins: number): string => {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const fmtHours = (hours: number): string => {
  if (!hours || hours <= 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const fmtMins = (mins: number): string => {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// Convert "07:45 AM" → "07:45" for time input
export const toTimeInput = (str: string): string => {
  if (!str || str === '—') return '';
  try {
    const d = new Date(`1970-01-01 ${str}`);
    if (isNaN(d.getTime())) return '';
    return d.toTimeString().slice(0, 5);
  } catch { return ''; }
};
