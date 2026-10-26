import { PageHeader } from '../components/Bits'
import { ExerciseForm } from '../components/ExerciseForm'
import { addLog } from '../lib/actions'
import { byName, useIndex } from '../lib/derive'
import { isISODate, longDate, shortDate, today } from '../lib/dates'
import { SearchSelect } from '../components/SearchSelect'

// Full screen for picking the exercise to add to a day. Picking one adds it and returns to
// the day with that exercise open; "+ Add new exercise" opens the New exercise screen.
export function AddExercise({ date: routeDate }: { date?: string }) {
  const date = routeDate && isISODate(routeDate) ? routeDate : today()
  const ix = useIndex()
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
      <SearchSelect
        startOpen
        options={options}
        placeholder="Choose an exercise"
        onPick={add}
        addLabel="Add new exercise"
        onAdd={(q) => window.location.replace(`#/log/${date}/new${q ? `?name=${encodeURIComponent(q)}` : ''}`)}
        onClose={() => window.location.replace(back)}
      />
    </div>
  )
}

// Full screen for creating an exercise from a day: saving adds it to the day and opens it there.
export function NewExercise({ date: routeDate, name = '', done, cancel }: { date?: string; name?: string; done?: string; cancel?: string }) {
  const date = routeDate && isISODate(routeDate) ? routeDate : today()
  const back = cancel ?? `#/log/${date}/add`
  const onDone = (exerciseId: string) =>
    window.location.replace(done ?? `#/log/${date}?log=${addLog(date, exerciseId)}`)
  return (
    <div className="page">
      <PageHeader
        back={back}
        title={<h1>New exercise</h1>}
        right={done ? undefined : <span className="muted small">{date === today() ? 'Today' : longDate(date)}</span>}
      />
      <ExerciseForm initialName={name} onDone={onDone} onCancel={() => window.location.replace(back)} />
    </div>
  )
}
