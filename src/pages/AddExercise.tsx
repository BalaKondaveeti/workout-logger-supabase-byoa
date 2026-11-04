import { PageHeader } from '../components/Bits'
import { ExerciseForm } from '../components/ExerciseForm'
import { addLog } from '../lib/actions'
import { closeChangeExercise, openExercise } from '../lib/nav'
import { updateRow } from '../lib/store'
import { byName, useIndex } from '../lib/derive'
import { isISODate, longDate, shortDate, today } from '../lib/dates'
import { SearchSelect } from '../components/SearchSelect'

// Full screen for picking the exercise to add to a day. Picking one adds it and returns to
// the day with that exercise open; "+ Add new exercise" opens the New exercise screen.
export function AddExercise({ date: routeDate }: { date?: string }) {
  const date = routeDate && isISODate(routeDate) ? routeDate : today()
  const ix = useIndex()
  const back = `#/log/${date}`
  const add = (exerciseId: string) => openExercise(date, addLog(date, exerciseId), true)

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
    done ? window.location.replace(done) : openExercise(date, addLog(date, exerciseId), true)
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

// Full screen for moving one entry (with its sets, times, notes and rating) to a different exercise.
export function ChangeExercise({ date: routeDate, logId }: { date?: string; logId: string }) {
  const date = routeDate && isISODate(routeDate) ? routeDate : today()
  const ix = useIndex()
  const log = ix.data.logs.find((l) => l.id === logId)
  const close = () => closeChangeExercise(date, logId)
  if (!log) return <p className="empty">This entry isn’t there any more.</p>
  const current = ix.exercise.get(log.exercise_id)
  const sets = ix.setsOfLog.get(log.id)?.length ?? 0

  const options = ix.data.exercises
    .filter((e) => !e.archived && e.id !== log.exercise_id)
    .sort(byName)
    .map((e) => {
      const m = e.primary_muscle_id ? ix.muscle.get(e.primary_muscle_id) : undefined
      const last = ix.logsOfExercise.get(e.id)?.[0]
      return { id: e.id, label: e.name, color: m?.color, sub: last ? shortDate(ix.logDate(last)) : m?.name }
    })

  const pick = (exerciseId: string) => {
    const to = ix.exercise.get(exerciseId)
    if (!confirm(`Move this entry (${sets} set${sets === 1 ? '' : 's'}) from "${current?.name ?? 'Unknown'}" to "${to?.name}"?`)) return
    updateRow('logs', log.id, { exercise_id: exerciseId }, true)
    close()
  }

  return (
    <div className="page">
      <PageHeader back="#/" onBack={close} title={<h1>Change exercise</h1>} right={<span className="muted small">{date === today() ? 'Today' : longDate(date)}</span>} />
      <p className="hint">
        Moving this entry from <strong>{current?.name ?? 'Unknown exercise'}</strong> ({sets} set{sets === 1 ? '' : 's'}). Its sets, times,
        notes and rating come along.
      </p>
      <SearchSelect startOpen options={options} placeholder="Choose the right exercise" onPick={pick} onClose={close} />
    </div>
  )
}
