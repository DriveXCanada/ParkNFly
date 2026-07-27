/**
 * Formatting helpers — dates, times, durations.
 * All times are stored as ISO 8601 strings (simulating the backend datetime fields).
 */

const pad = (n) => String(n).padStart(2, '0')

/** "2026-06-18" → Date (local, midday to avoid TZ edge cases) */
export const parseDate = (value) => {
  if (value instanceof Date) return value
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`)
  }
  return new Date(value)
}

/** ISO string or Date → "2:45 PM" */
export const formatTime = (value) => {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d)) return '—'
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${pad(m)} ${ampm}`
}

/** ISO string or Date → "Jun 18, 2026" */
export const formatDate = (value) => {
  if (!value) return '—'
  const d = parseDate(value)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** ISO string or Date → "Thu, Jun 18" */
export const formatDateShort = (value) => {
  if (!value) return '—'
  const d = parseDate(value)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** ISO string or Date → "Jun 18, 2026 · 2:45 PM" */
export const formatDateTime = (value) => {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d)) return '—'
  return `${formatDate(d)} · ${formatTime(d)}`
}

/** "2026-06-18" → "YYYY-MM-DD" key (for grouping / matching) */
export const dateKey = (value) => {
  const d = value instanceof Date ? value : parseDate(value)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const todayKey = () => dateKey(new Date())

/** Minutes between two ISO times → "24 min" or "1h 05m" */
export const formatDuration = (startIso, endIso) => {
  if (!startIso || !endIso) return '—'
  const ms = new Date(endIso) - new Date(startIso)
  if (isNaN(ms) || ms < 0) return '—'
  return formatMinutes(Math.round(ms / 60000))
}

/** number of minutes → "24 min" or "1h 05m" */
export const formatMinutes = (mins) => {
  if (mins == null || isNaN(mins)) return '—'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${pad(m)}m`
}

/** minutes between two ISO times as a number (null if invalid) */
export const minutesBetween = (startIso, endIso) => {
  if (!startIso || !endIso) return null
  const ms = new Date(endIso) - new Date(startIso)
  if (isNaN(ms) || ms < 0) return null
  return Math.round(ms / 60000)
}

/** "live" elapsed string from an ISO start to now */
export const elapsedSince = (startIso, nowMs = Date.now()) => {
  if (!startIso) return '—'
  const mins = Math.max(0, Math.round((nowMs - new Date(startIso)) / 60000))
  return formatMinutes(mins)
}

/** 1234 → "1,234" */
export const formatNumber = (n) =>
  typeof n === 'number' ? n.toLocaleString('en-US') : '—'

/** Relative time: "4 min ago", "2 h ago" */
export const timeAgo = (value, nowMs = Date.now()) => {
  if (!value) return '—'
  const diff = Math.round((nowMs - new Date(value)) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff} min ago`
  const hrs = Math.floor(diff / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.floor(hrs / 24)
  return `${days} d ago`
}

/** ISO → "HH:MM" for a <input type="time"> value */
export const toTimeInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "HH:MM" + "YYYY-MM-DD" → ISO local string (keeps the shift's date) */
export const fromTimeInput = (value, dateStr) => {
  if (!value || !dateStr) return null
  return `${dateStr}T${value}:00`
}

/** Hours (whole number) since an ISO timestamp */
export const hoursSince = (value, nowMs = Date.now()) => {
  if (!value) return Infinity
  return (nowMs - new Date(value)) / 3600000
}
