import { useState } from 'react'
import { PageHeader } from '../components/Bits'
import { ExerciseForm } from '../components/ExerciseForm'
import { addLog } from '../lib/actions'
import { byName, useIndex } from '../lib/derive'
import { isISODate, longDate, shortDate, today } from '../lib/dates'
import { SearchSelect } from '../components/SearchSelect'

// Full screen for picking (or creating) the exercise to add to a day. Picking one adds it
// and returns to the day with that exercise open.
export function AddExercise({ date: routeDate }: { date?: string }) {
  const date = routeDate && isISODate(routeDate) ? routeDate : today()
  const ix = useIndex()
  const [creating, setCreating] = useState<string | null>(null)
  const back = `#/log/${date}`
  const add = (exerciseId: string) => window.location.replace(`${back}?log=${addLog(date, exerciseId)}`)

  const options = ix.data.exercises
    .filter((e) => !e.archived)
    .sort(byName)
    .map((e) => {
      const m = e.primary_muscle_id ? ix.muscle.get(e.primary_muscle_id) : undefined
      const last = ix.logsOfExercise.get(e.id)?.[0]
      return { id: e.id, label: e.name, color: m?.color, sub: last ? shortDate(ix.logDate(last)) : m?.name }
    })

  return (
    <div className="page">
      <PageHeader back={back} title={<h1>Add exercise</h1>} right={<span className="muted small">{date === today() ? 'Today' : longDate(date)}</span>} />
      {creating !== null ? (
        <ExerciseForm initialName={creating} onDone={add} onCancel={() => setCreating(null)} />
      ) : (
        <SearchSelect
          startOpen
          options={options}
          placeholder="Choose an exercise"
          onPick={add}
          addLabel="Add new exercise"
          onAdd={(q) => setCreating(q)}
          onClose={() => window.location.replace(back)}
        />
      )}
    </div>
  )
}
