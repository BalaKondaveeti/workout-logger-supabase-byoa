import { useStore } from './store'
import type { Data, Day, DayType, Exercise, GymSet, Log, Muscle } from './types'

// Lookup tables built once per data snapshot.
export type Index = {
  data: Data // live data only: deleted days and their logs/sets are left out
  trash: TrashedDay[] // Recently deleted, newest deletion first
  muscle: Map<string, Muscle>
  dayType: Map<string, DayType>
  exercise: Map<string, Exercise>
  secondaryOf: Map<string, string[]> // exercise id -> muscle ids
  day: Map<string, Day>
  dayByDate: Map<string, Day>
  logsOfDay: Map<string, Log[]> // by position
  setsOfLog: Map<string, GymSet[]> // by position
  logsOfExercise: Map<string, Log[]> // newest first
  setsPerDate: Map<string, number>
  dates: string[] // gym visits, newest first
  logDate: (log: Log) => string
}

const byPosition = (a: { position: number; created_at?: string }, b: { position: number; created_at?: string }) =>
  a.position - b.position || (a.created_at ?? '').localeCompare(b.created_at ?? '')

function group<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const k = key(r)
    const list = m.get(k)
    if (list) list.push(r)
    else m.set(k, [r])
  }
  return m
}

export type TrashedDay = { day: Day; logs: Log[]; sets: number; setsOfLog: Map<string, GymSet[]> }

const cache = new WeakMap<Data, Index>()

export function buildIndex(raw: Data): Index {
  const hit = cache.get(raw)
  if (hit) return hit

  // Deleted days stay in the database (and the store) until deleted permanently from
  // Menu → Recently deleted; everything else in the app sees only live days.
  const deletedIds = new Set(raw.days.filter((d) => d.deleted_at).map((d) => d.id))
  const data: Data = deletedIds.size
    ? (() => {
        const logs = raw.logs.filter((l) => !deletedIds.has(l.day_id))
        const logIds = new Set(logs.map((l) => l.id))
        return { ...raw, days: raw.days.filter((d) => !d.deleted_at), logs, sets: raw.sets.filter((s) => logIds.has(s.log_id)) }
      })()
    : raw

  const day = new Map(data.days.map((d) => [d.id, d]))
  const logDate = (l: Log) => day.get(l.day_id)?.date ?? ''
  const logsOfDay = group(data.logs, (l) => l.day_id)
  logsOfDay.forEach((list) => list.sort(byPosition))
  const setsOfLog = group(data.sets, (s) => s.log_id)
  setsOfLog.forEach((list) => list.sort(byPosition))
  const logsOfExercise = group(data.logs, (l) => l.exercise_id)
  logsOfExercise.forEach((list) => list.sort((a, b) => logDate(b).localeCompare(logDate(a)) || b.position - a.position))

  const setsPerDate = new Map<string, number>()
  for (const l of data.logs) {
    const date = logDate(l)
    setsPerDate.set(date, (setsPerDate.get(date) ?? 0) + (setsOfLog.get(l.id)?.length ?? 0))
  }

  const liveDates = new Set(data.days.map((d) => d.date))
  const trash = raw.days
    .filter((d) => d.deleted_at)
    .map((day) => {
      const logs = raw.logs.filter((l) => l.day_id === day.id).sort(byPosition)
      const ids = new Set(logs.map((l) => l.id))
      const sets = raw.sets.filter((s) => ids.has(s.log_id))
      const setsOfLog = group(sets, (s) => s.log_id)
      setsOfLog.forEach((list) => list.sort(byPosition))
      return { day, logs, sets: sets.length, setsOfLog }
    })
    // an emptied day whose exercises were restored into a live day on the same date has nothing left to show
    .filter((t) => t.logs.length > 0 || !liveDates.has(t.day.date))
    .sort((a, b) => (b.day.deleted_at ?? '').localeCompare(a.day.deleted_at ?? ''))

  const index: Index = {
    data,
    trash,
    muscle: new Map(data.muscles.map((m) => [m.id, m])),
    dayType: new Map((data.dayTypes ?? []).map((t) => [t.id, t])),
    exercise: new Map(data.exercises.map((e) => [e.id, e])),
    secondaryOf: new Map([...group(data.secondary, (s) => s.exercise_id)].map(([k, v]) => [k, v.map((s) => s.muscle_id)])),
    day,
    dayByDate: new Map(data.days.map((d) => [d.date, d])),
    logsOfDay,
    setsOfLog,
    logsOfExercise,
    setsPerDate,
    dates: [...new Set(data.days.map((d) => d.date))].sort().reverse(),
    logDate,
  }
  cache.set(raw, index)
  return index
}

// The most recent log of an exercise on a date before `date`.
export function lastTime(ix: Index, exerciseId: string, date: string) {
  return (ix.logsOfExercise.get(exerciseId) ?? []).find((l) => ix.logDate(l) < date) ?? null
}

// Exercises that work a muscle, split by primary / secondary.
export function exercisesForMuscle(ix: Index, muscleId: string) {
  const primary = ix.data.exercises.filter((e) => e.primary_muscle_id === muscleId)
  const secondary = ix.data.exercises.filter(
    (e) => e.primary_muscle_id !== muscleId && (ix.secondaryOf.get(e.id) ?? []).includes(muscleId),
  )
  return { primary, secondary }
}

export const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)

// Components below the loading gate always have data.
export function useIndex() {
  return buildIndex(useStore().data!)
}
