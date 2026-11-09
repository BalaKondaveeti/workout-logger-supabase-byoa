import { addDays, daysBetween, today, weekStart } from './dates'
import type { Index } from './derive'
import type { GymSet, Log } from './types'
import { e1rmKg, toKg, volumeKg } from './units'

export type Session = { date: string; sets: GymSet[]; maxKg: number; volumeKg: number; e1rmKg: number }

// The rep count an exercise is usually done for: the median reps of all its sets (10 if none).
export function usualReps(sets: GymSet[]) {
  const reps = sets.map((s) => s.reps).filter((r): r is number => !!r && r > 0).sort((a, b) => a - b)
  return reps.length ? reps[Math.floor(reps.length / 2)] : 10
}

// Sets under this share of the session's best (rep-adjusted) set count as warm-ups and are left out.
export const WARMUP_SHARE = 0.7

// Average weight for a session, adjusted for reps: each set becomes the weight it equals at
// `reps` reps (Epley: w × (1 + r/30) ÷ (1 + reps/30)), warm-ups are dropped, the rest averaged.
// A set done at the usual reps counts as its own weight; a heavy double counts as less.
export function adjustedAvgKg(sets: GymSet[], reps: number) {
  const eq = sets
    .filter((s) => s.weight !== null && s.reps)
    .map((s) => (toKg(s.weight!, s.unit) * (1 + s.reps! / 30)) / (1 + reps / 30))
  if (!eq.length) return 0
  const best = Math.max(...eq)
  const working = eq.filter((w) => w >= best * WARMUP_SHARE)
  return working.reduce((a, b) => a + b, 0) / working.length
}

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

// Timing of one exercise entry from its sets' times: duration is first → last set,
// rest is the average time between consecutive sets. Needs at least two timed sets.
export function setTiming(sets: GymSet[]) {
  const times = sets
    .map((s) => (s.done_at ? new Date(s.done_at).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)
  if (times.length < 2) return null
  const durationSec = (times[times.length - 1] - times[0]) / 1000
  return { durationSec, avgRestSec: durationSec / (times.length - 1), timed: times.length }
}
