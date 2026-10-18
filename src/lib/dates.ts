// Dates are local calendar days as 'yyyy-mm-dd' strings; times are 'hh:mm' (24h).

const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = () => toISODate(new Date())

export function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number) {
  const d = parseDate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function daysBetween(a: string, b: string) {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000)
}

export const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

// "Oct 12", or "Oct 12, 2025" when not this year
export function shortDate(iso: string) {
  const d = parseDate(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

// "Sat, Oct 12"
export function longDate(iso: string) {
  const d = parseDate(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function relativeDay(iso: string) {
  const n = daysBetween(iso, today())
  if (n === 0) return 'Today'
  if (n === 1) return 'Yesterday'
  return `${n} days ago`
}

export const nowTime = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')

// '17:40' -> '5:40 PM' (locale aware)
export function prettyTime(t: string | null) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Minutes from check-in to check-out; a check-out earlier than check-in is past midnight.
export function durationMinutes(inT: string | null, outT: string | null) {
  if (!inT || !outT) return null
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  let diff = toMin(outT) - toMin(inT)
  if (diff < 0) diff += 24 * 60
  return diff
}

export function prettyDuration(min: number | null) {
  if (min === null) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${pad(m)}m` : `${m}m`
}

// Monday of the week containing iso
export function weekStart(iso: string) {
  const d = parseDate(iso)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return toISODate(d)
}
