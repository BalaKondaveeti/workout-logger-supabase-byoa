import { useState, type FormEvent } from 'react'
import { createExercise, createMuscle, nextMuscleColor, setSecondary } from '../lib/actions'
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

// Create or edit an exercise: name, primary + secondary muscles, machine notes, default unit.
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
  const [secondary, setSecondaryIds] = useState<string[]>(exercise ? (ix.secondaryOf.get(exercise.id) ?? []) : [])
  const [notes, setNotes] = useState(exercise?.notes ?? '')
  const [unit, setUnit] = useState<Unit>(exercise?.default_unit ?? 'kg')
  const [adding, setAdding] = useState<'primary' | 'secondary' | null>(null)

  const muscles = ix.data.muscles.filter((m) => !m.archived || m.id === primary || secondary.includes(m.id)).sort(byName)

  const addMuscle = (target: 'primary' | 'secondary', query: string) => {
    if (!query) return setAdding(target)
    const existing = ix.data.muscles.find((m) => m.name.toLowerCase() === query.toLowerCase())
    const id = existing?.id ?? createMuscle(query, nextMuscleColor())
    if (target === 'primary') setPrimary(id)
    else setSecondaryIds((s) => [...new Set([...s, id])])
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const sec = secondary.filter((m) => m !== primary)
    if (exercise) {
      updateRow('exercises', exercise.id, {
        name: name.trim(),
        primary_muscle_id: primary,
        notes: notes.trim() || null,
        default_unit: unit,
      })
      setSecondary(exercise.id, sec)
      onDone(exercise.id)
    } else {
      onDone(createExercise({ name, primary_muscle_id: primary, secondary: sec, notes, default_unit: unit }))
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
        {adding === 'primary' ? (
          <NewMuscle onCreated={(id) => (setPrimary(id), setAdding(null))} onCancel={() => setAdding(null)} />
        ) : (
          <SearchSelect
            options={muscles.map((m) => ({ id: m.id, label: m.name, color: m.color }))}
            value={primary}
            placeholder="Choose a muscle"
            onPick={setPrimary}
            addLabel="Add new muscle"
            onAdd={(q) => addMuscle('primary', q)}
          />
        )}
      </div>
      <div className="field">
        <span>Secondary muscles</span>
        <div className="chips">
          {muscles
            .filter((m) => m.id !== primary)
            .map((m) => {
              const on = secondary.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`chip${on ? ' on' : ''}`}
                  style={{ '--tag-color': m.color } as React.CSSProperties}
                  aria-pressed={on}
                  onClick={() => setSecondaryIds((s) => (on ? s.filter((x) => x !== m.id) : [...s, m.id]))}
                >
                  {m.name}
                </button>
              )
            })}
          {adding !== 'secondary' && (
            <button type="button" className="chip add" onClick={() => setAdding('secondary')}>
              + New
            </button>
          )}
        </div>
        {adding === 'secondary' && (
          <NewMuscle
            onCreated={(id) => (setSecondaryIds((s) => [...s, id]), setAdding(null))}
            onCancel={() => setAdding(null)}
          />
        )}
      </div>
      <label className="field">
        <span>Machine notes</span>
        <textarea
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
