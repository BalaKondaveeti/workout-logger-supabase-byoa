import { addDays, daysBetween, today, weekStart } from './dates'
import type { Index } from './derive'
import type { GymSet, Log } from './types'
import { e1rmKg, toKg, volumeKg } from './units'

export type Session = { date: string; sets: GymSet[]; maxKg: number; volumeKg: number; e1rmKg: number }

// One entry per date the logs were done, oldest first.
export function sessions(ix: Index, logs: Log[]): Session[] {
  const byDate = new Map<string, GymSet[]>()
  for (const l of logs) {
    const date = ix.logDate(l)
    byDate.set(date, [...(byDate.get(date) ?? []), ...(ix.setsOfLog.get(l.id) ?? [])])
  }
  return [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sets]) => {
      const counted = sets.filter((s) => s.weight !== null)
      return {
        date,
        sets,
        maxKg: Math.max(0, ...counted.map((s) => toKg(s.weight!, s.unit))),
        volumeKg: sets.reduce((sum, s) => sum + volumeKg(s), 0),
        e1rmKg: Math.max(0, ...sets.map(e1rmKg)),
      }
    })
}

export function exerciseStats(ix: Index, exerciseId: string) {
  const logs = ix.logsOfExercise.get(exerciseId) ?? []
  const list = sessions(ix, logs)
  let pr: { kg: number; date: string } | null = null
  let best1rm: { kg: number; date: string } | null = null
  for (const s of list) {
    if (s.maxKg > 0 && (!pr || s.maxKg > pr.kg)) pr = { kg: s.maxKg, date: s.date }
    if (s.e1rmKg > 0 && (!best1rm || s.e1rmKg > best1rm.kg)) best1rm = { kg: s.e1rmKg, date: s.date }
  }
  const rated = logs.filter((l) => l.rating)
  const latest = list[list.length - 1]
  return {
    sessions: list,
    last: latest?.date ?? null,
    pr,
    best1rm,
    latest1rm: latest && latest.e1rmKg > 0 ? { kg: latest.e1rmKg, date: latest.date } : null,
    avgRating: rated.length ? rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length : null,
  }
}

// Distinct training dates per week (Mon–Sun) for the last `weeks` weeks, oldest first.
export function perWeek(dates: string[], weeks: number) {
  const thisWeek = weekStart(today())
  const counts = new Map<string, number>()
  for (const d of new Set(dates)) {
    const w = weekStart(d)
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  return Array.from({ length: weeks }, (_, i) => {
    const w = addDays(thisWeek, -7 * (weeks - 1 - i))
    return { date: w, value: counts.get(w) ?? 0 }
  })
}

export function setsPerDate(ix: Index, logs: Log[]) {
  const m = new Map<string, number>()
  for (const l of logs) {
    const d = ix.logDate(l)
    m.set(d, (m.get(d) ?? 0) + (ix.setsOfLog.get(l.id)?.length ?? 0))
  }
  return m
}

// Days since the most recent gym visit on or before today (null if none yet).
export function daysSinceLastVisit(dates: string[], now = today()): number | null {
  let last: string | undefined
  for (const d of dates) if (d <= now && (!last || d > last)) last = d
  return last ? daysBetween(last, now) : null
}

// How overdue the next visit is: >1 day yellow, >3 red, >5 the whole app turns red.
export type RestLevel = 'ok' | 'warn' | 'alert' | 'overdue'
export function restLevel(since: number | null): RestLevel {
  if (since === null || since <= 1) return 'ok'
  if (since <= 3) return 'warn'
  if (since <= 5) return 'alert'
  return 'overdue'
}
