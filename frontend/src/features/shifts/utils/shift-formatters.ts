// ── Shift Formatting Utilities ──────────────────────────────────

export function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${display}:${m} ${suffix}`
}

export function calcDuration(start: string, end: string, isNight: boolean) {
  if (!start || !end) return '--'
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (isNight && mins <= 0) mins += 24 * 60
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m > 0 ? ` ${m}m` : ''}`
}

export function calcBreaksDuration(breaksJson: string, breakMinutes: number) {
  try {
    const arr = JSON.parse(breaksJson || '[]')
    if (arr.length === 0) return breakMinutes
    return arr.reduce((acc: number, b: any) => {
      if (!b.start || !b.end) return acc
      const [sh, sm] = b.start.split(':').map(Number)
      const [eh, em] = b.end.split(':').map(Number)
      let diff = (eh * 60 + em) - (sh * 60 + sm)
      if (diff < 0) diff += 24 * 60
      return acc + diff
    }, 0)
  } catch {
    return breakMinutes
  }
}

export function calcFormBreaks(breaksArr: any[], fallback: number) {
  if (!breaksArr || breaksArr.length === 0) return fallback
  return breaksArr.reduce((acc: number, b: any) => {
    if (!b.start || !b.end) return acc
    const [sh, sm] = b.start.split(':').map(Number)
    const [eh, em] = b.end.split(':').map(Number)
    let diff = (eh * 60 + em) - (sh * 60 + sm)
    if (diff < 0) diff += 24 * 60
    return acc + diff
  }, 0)
}

export function toMinutes(t: string) {
  if (!t) return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function getBreakError(
  b: { start: string; end: string },
  shiftStart?: string,
  shiftEnd?: string
): string | null {
  if (!b.start || !b.end) return null
  if (toMinutes(b.end) <= toMinutes(b.start)) return '"To" time must be later than "From" time.'
  if (shiftStart && shiftEnd) {
    const shiftStartMins = toMinutes(shiftStart)
    const shiftEndMins = toMinutes(shiftEnd)
    const breakStartMins = toMinutes(b.start)
    const breakEndMins = toMinutes(b.end)
    // Handle overnight shifts where endTime < startTime
    const isOvernight = shiftEndMins <= shiftStartMins
    if (isOvernight) {
      // Break must start after shift start OR end before shift end (wraps midnight)
      const validStart = breakStartMins >= shiftStartMins || breakStartMins < shiftEndMins
      const validEnd = breakEndMins > shiftStartMins || breakEndMins <= shiftEndMins
      if (!validStart || !validEnd) return 'Break must be within the shift hours.'
    } else {
      if (breakStartMins < shiftStartMins || breakEndMins > shiftEndMins) {
        return 'Break must be within the shift hours.'
      }
    }
  }
  return null
}
