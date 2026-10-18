import { useStore } from './store'
import type { Data, Day, Exercise, GymSet, Log, Muscle } from './types'

// Lookup tables built once per data snapshot.
export type Index = {
  data: Data
  muscle: Map<string, Muscle>
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

const cache = new WeakMap<Data, Index>()

export function buildIndex(data: Data): Index {
  const hit = cache.get(data)
  if (hit) return hit

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

  const index: Index = {
    data,
    muscle: new Map(data.muscles.map((m) => [m.id, m])),
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
  cache.set(data, index)
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
