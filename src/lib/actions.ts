import { buildIndex, lastTime } from './derive'
import { deleteRow, getData, insertRow, updateRow, uuid } from './store'
import type { Day, Exercise, GymSet, Log, Muscle, Unit } from './types'

// Higher-level writes used by the screens. All go through the store's queue.

const ix = () => buildIndex(getData()!)

// The day row for a date, created on first use.
export function ensureDay(date: string): string {
  const existing = ix().dayByDate.get(date)
  if (existing) return existing.id
  const day: Day = {
    id: uuid(),
    date,
    check_in: null,
    check_out: null,
    pre_workout: false,
    pre_workout_note: null,
    rating: null,
    notes: null,
  }
  insertRow('days', day)
  return day.id
}

export function updateDay(date: string, patch: Partial<Day>) {
  updateRow('days', ensureDay(date), patch)
}

export function addLog(date: string, exerciseId: string): string {
  const dayId = ensureDay(date)
  const logs = ix().logsOfDay.get(dayId) ?? []
  const log: Log = {
    id: uuid(),
    day_id: dayId,
    exercise_id: exerciseId,
    position: logs.length ? Math.max(...logs.map((l) => l.position)) + 1 : 0,
    rating: null,
    notes: null,
  }
  insertRow('logs', log)
  return log.id
}

// Set 1 copies set 1 of last time; later sets copy the set above (weight, unit, reps, each-arm, side).
export function addSet(logId: string): string {
  const index = ix()
  const log = index.data.logs.find((l) => l.id === logId)!
  const sets = index.setsOfLog.get(logId) ?? []
  const above = sets[sets.length - 1]
  let template: Pick<GymSet, 'weight' | 'unit' | 'reps' | 'per_arm' | 'side'> | undefined = above
  if (!template) {
    const prev = lastTime(index, log.exercise_id, index.logDate(log))
    template = prev ? index.setsOfLog.get(prev.id)?.[0] : undefined
  }
  const set: GymSet = {
    id: uuid(),
    log_id: logId,
    position: above ? above.position + 1 : 0,
    weight: template?.weight ?? null,
    unit: template?.unit ?? index.exercise.get(log.exercise_id)?.default_unit ?? 'kg',
    reps: template?.reps ?? null,
    per_arm: template?.per_arm ?? false,
    side: template?.side ?? null,
    note: null,
  }
  insertRow('sets', set)
  return set.id
}

export const deleteLog = (id: string) => deleteRow('logs', id)
// Deleting a day moves it to Menu → Recently deleted; only "Delete permanently" there removes it.
export const trashDay = (id: string) => updateRow('days', id, { deleted_at: new Date().toISOString() }, true)

// Permanent delete (manual only, from Recently deleted). Logs and sets cascade.
export const deleteDayForever = (id: string) => deleteRow('days', id)

// Restore a deleted day. If that date already has a live day, its exercises are moved into
// it (appended) and empty day fields are filled in; the emptied row stays deleted (never hard-deleted here).
export function restoreDay(id: string) {
  const raw = getData()!
  const day = raw.days.find((d) => d.id === id)
  if (!day) return
  const index = ix()
  const live = index.dayByDate.get(day.date)
  if (!live) return updateRow('days', id, { deleted_at: null }, true)

  const liveLogs = index.logsOfDay.get(live.id) ?? []
  let pos = liveLogs.length ? Math.max(...liveLogs.map((l) => l.position)) + 1 : 0
  raw.logs
    .filter((l) => l.day_id === id)
    .sort((a, b) => a.position - b.position)
    .forEach((l) => updateRow('logs', l.id, { day_id: live.id, position: pos++ }, true))

  const patch: Partial<Day> = {}
  if (!live.check_in && day.check_in) patch.check_in = day.check_in
  if (!live.check_out && day.check_out) patch.check_out = day.check_out
  if (!live.rating && day.rating) patch.rating = day.rating
  if (!live.pre_workout && day.pre_workout) patch.pre_workout = true
  if (day.notes && day.notes !== live.notes) patch.notes = live.notes ? `${live.notes}\n\n${day.notes}` : day.notes
  if (Object.keys(patch).length) updateRow('days', live.id, patch, true)
}
export const deleteSet = (id: string) => deleteRow('sets', id)

export function moveLog(logId: string, dir: -1 | 1) {
  const index = ix()
  const log = index.data.logs.find((l) => l.id === logId)!
  const logs = index.logsOfDay.get(log.day_id) ?? []
  const i = logs.findIndex((l) => l.id === logId)
  const j = i + dir
  if (j < 0 || j >= logs.length) return
  // renumber the whole day so positions are unique
  const order = [...logs]
  ;[order[i], order[j]] = [order[j], order[i]]
  order.forEach((l, pos) => l.position !== pos && updateRow('logs', l.id, { position: pos }))
}

export function createMuscle(name: string, color: string): string {
  const m: Muscle = { id: uuid(), name: name.trim(), color, archived: false }
  insertRow('muscles', m)
  return m.id
}

export function createExercise(input: {
  name: string
  primary_muscle_id: string | null
  secondary: string[]
  notes: string
  default_unit: Unit
}): string {
  const e: Exercise = {
    id: uuid(),
    name: input.name.trim(),
    primary_muscle_id: input.primary_muscle_id,
    notes: input.notes.trim() || null,
    default_unit: input.default_unit,
    archived: false,
  }
  insertRow('exercises', e)
  setSecondary(e.id, input.secondary.filter((m) => m !== input.primary_muscle_id))
  return e.id
}

// Makes the exercise's secondary muscles exactly `muscleIds`.
export function setSecondary(exerciseId: string, muscleIds: string[]) {
  const rows = getData()!.secondary.filter((s) => s.exercise_id === exerciseId)
  for (const r of rows) if (!muscleIds.includes(r.muscle_id)) deleteRow('secondary', r.id)
  for (const m of muscleIds) {
    if (!rows.some((r) => r.muscle_id === m)) insertRow('secondary', { id: uuid(), exercise_id: exerciseId, muscle_id: m })
  }
}

// Palette for new muscles: picked in order, skipping colors already used.
export const MUSCLE_COLORS = [
  '#e4572e', '#2e86de', '#3fa7d6', '#1b4f72', '#f39c12', '#8e44ad', '#c0399b',
  '#7f8c8d', '#27ae60', '#16a085', '#d35400', '#6ab04c', '#f1c40f', '#e17055',
]

export function nextMuscleColor() {
  const used = new Set(getData()!.muscles.map((m) => m.color.toLowerCase()))
  return MUSCLE_COLORS.find((c) => !used.has(c)) ?? MUSCLE_COLORS[getData()!.muscles.length % MUSCLE_COLORS.length]
}
