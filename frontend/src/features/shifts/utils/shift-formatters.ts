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
  const sh = toMinutes(start)
  const eh = toMinutes(end)

  if (sh === eh) return 'Invalid (0h)'
  
  let mins = eh - sh
  if (mins < 0) {
    if (isNight) {
      mins += 24 * 60
    } else {
      return 'Negative Duration'
    }
  } else if (isNight && mins > 0) {
     // If it's marked as night but doesn't cross midnight, 
     // it's still a positive duration. 
  }
  
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m > 0 ? ` ${m}m` : ''}`
}

export function validateShiftConfig(start: string, end: string, isNight: boolean): string | null {
  if (!start || !end) return null
  const sh = toMinutes(start)
  const eh = toMinutes(end)

  if (sh === eh) return 'Shift start and end times cannot be the same.'
  
  if (eh < sh && !isNight) {
    return 'End time is earlier than start time. Did you mean to enable "Overnight Shift"?'
  }

  return null
}

export function calcBreaksDuration(breaksJson: string, breakMinutes: number) {
  try {
    const arr = JSON.parse(breaksJson || '[]')
    if (arr.length === 0) return 0 // Do not fallback to legacy breakMinutes, treat empty as 0
    return arr.reduce((acc: number, b: any) => {
      if (!b.start || !b.end) return acc
      const sh = toMinutes(b.start)
      const eh = toMinutes(b.end)
      let diff = eh - sh
      if (diff < 0) diff += 24 * 60
      return acc + diff
    }, 0)
  } catch {
    return 0
  }
}

export function calcFormBreaks(breaksArr: any[], fallback: number) {
  if (!breaksArr || breaksArr.length === 0) return 0 // Do not fallback to legacy breakMinutes
  return breaksArr.reduce((acc: number, b: any) => {
    if (!b.start || !b.end) return acc
    const sh = toMinutes(b.start)
    const eh = toMinutes(b.end)
    let diff = eh - sh
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
  shiftEnd?: string,
  isNight?: boolean
): string | null {
  if (!b.start || !b.end) return null
  if (toMinutes(b.end) <= toMinutes(b.start)) return '"To" time must be later than "From" time.'
  
  if (shiftStart && shiftEnd) {
    const shiftStartMins = toMinutes(shiftStart)
    const shiftEndMins = toMinutes(shiftEnd)
    const breakStartMins = toMinutes(b.start)
    const breakEndMins = toMinutes(b.end)
    
    // Use isNight flag if provided, otherwise fallback to inference
    const isOvernight = isNight ?? (shiftEndMins <= shiftStartMins)
    
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
