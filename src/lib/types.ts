export type Unit = 'kg' | 'lb'

type Row = { id: string; user_id?: string; created_at?: string }

export type Muscle = Row & { name: string; color: string; archived: boolean }

// A day's split / workout type (Push, Pull, Legs, Arms…): the user's own list.
export type DayType = Row & { name: string; color: string; archived: boolean }

export type Exercise = Row & {
  name: string
  primary_muscle_id: string | null
  notes: string | null
  default_unit: Unit
  archived: boolean
}

export type Secondary = Row & { exercise_id: string; muscle_id: string }

export type Day = Row & {
  date: string // yyyy-mm-dd
  check_in: string | null // hh:mm[:ss]
  check_out: string | null
  pre_workout: boolean
  pre_workout_note: string | null
  rating: number | null
  notes: string | null
  type_id?: string | null // DayType (split); missing before the column exists
  deleted_at?: string | null // set = in Recently deleted (soft delete); missing before the column exists
}

export type Log = Row & {
  day_id: string
  exercise_id: string
  position: number
  rating: number | null
  notes: string | null
}

export type GymSet = Row & {
  log_id: string
  position: number
  weight: number | null
  unit: Unit
  reps: number | null
  per_arm: boolean
  side: 'left' | 'right' | null
  note: string | null
  done_at?: string | null // when the set was logged (set on "+ Add set", editable); null for older sets
}

export type Note = Row & { body: string; updated_at: string }

export type Data = {
  muscles: Muscle[]
  exercises: Exercise[]
  secondary: Secondary[]
  days: Day[]
  logs: Log[]
  sets: GymSet[]
  notes: Note[]
  dayTypes: DayType[]
}

export type Table = keyof Data

export const TABLES: Record<Table, string> = {
  muscles: 'gym_muscles',
  exercises: 'gym_exercises',
  secondary: 'gym_exercise_secondary_muscles',
  days: 'gym_days',
  logs: 'gym_logs',
  sets: 'gym_sets',
  notes: 'gym_notes',
  dayTypes: 'gym_day_types',
}

// Tables added after launch: until their SQL is run, loading treats them as empty.
export const OPTIONAL_TABLES: Table[] = ['dayTypes']

// Columns added after launch whose writes are dropped (not failed) until their SQL is run.
export const OPTIONAL_COLUMNS: Partial<Record<Table, string[]>> = { sets: ['done_at'] }
