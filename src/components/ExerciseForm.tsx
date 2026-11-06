import { AutoTextarea } from './Bits'
import { useState, type FormEvent } from 'react'
import { createExercise, createMuscle, nextMuscleColor } from '../lib/actions'
import { byName, useIndex } from '../lib/derive'
import { updateRow } from '../lib/store'
import type { Exercise, Unit } from '../lib/types'
import { SearchSelect } from './SearchSelect'

export function UnitToggle({ value, onChange }: { value: Unit; onChange: (u: Unit) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Unit">
      {(['kg', 'lb'] as const).map((u) => (
        <button key={u} type="button" role="radio" aria-checked={value === u} onClick={() => onChange(u)}>
          {u}
        </button>
      ))}
    </div>
  )
}

// Inline "new muscle" input, shown when "+ Add new" was chosen without typing a name.
function NewMuscle({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const add = () => name.trim() && onCreated(createMuscle(name, nextMuscleColor()))
  return (
    <div className="inline">
      <input
        className="input grow"
        autoFocus
        placeholder="New muscle name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
      />
      <button type="button" className="btn" onClick={add} disabled={!name.trim()}>
        Add
      </button>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

// Create or edit an exercise: name, primary muscle, machine notes, default unit.
export function ExerciseForm({
  exercise,
  initialName = '',
  onDone,
  onCancel,
}: {
  exercise?: Exercise
  initialName?: string
  onDone: (id: string) => void
  onCancel: () => void
}) {
  const ix = useIndex()
  const [name, setName] = useState(exercise?.name ?? initialName)
  const [primary, setPrimary] = useState<string | null>(exercise?.primary_muscle_id ?? null)
  const [notes, setNotes] = useState(exercise?.notes ?? '')
  const [unit, setUnit] = useState<Unit>(exercise?.default_unit ?? 'lb') // new exercises default to lb
  const [adding, setAdding] = useState(false)

  const muscles = ix.data.muscles.filter((m) => !m.archived || m.id === primary).sort(byName)

  const addMuscle = (query: string) => {
    if (!query) return setAdding(true)
    const existing = ix.data.muscles.find((m) => m.name.toLowerCase() === query.toLowerCase())
    setPrimary(existing?.id ?? createMuscle(query, nextMuscleColor()))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (exercise) {
      updateRow('exercises', exercise.id, {
        name: name.trim(),
        primary_muscle_id: primary,
        notes: notes.trim() || null,
        default_unit: unit,
      })
      onDone(exercise.id)
    } else {
      onDone(createExercise({ name, primary_muscle_id: primary, notes, default_unit: unit }))
    }
  }

  return (
    <form className="form panel" onSubmit={submit}>
      <label className="field">
        <span>Name</span>
        <input
          className="input"
          autoFocus={!exercise}
          placeholder="e.g. Lat pulldown cable"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <div className="field">
        <span>Primary muscle</span>
        {adding ? (
          <NewMuscle onCreated={(id) => (setPrimary(id), setAdding(false))} onCancel={() => setAdding(false)} />
        ) : (
          <SearchSelect
            options={muscles.map((m) => ({ id: m.id, label: m.name, color: m.color }))}
            value={primary}
            placeholder="Choose a muscle"
            onPick={setPrimary}
            addLabel="Add new muscle"
            onAdd={addMuscle}
          />
        )}
      </div>
      <label className="field">
        <span>Machine notes</span>
        <AutoTextarea
          className="input"
          rows={2}
          placeholder="Seat height, pin position, cues…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="field">
        <span>Default unit</span>
        <UnitToggle value={unit} onChange={setUnit} />
      </div>
      <div className="inline">
        <button className="btn btn-primary grow" disabled={!name.trim()}>
          {exercise ? 'Save' : 'Add exercise'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
