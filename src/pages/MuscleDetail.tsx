import { PageHeader, Stat } from '../components/Bits'
import { Chart } from '../components/Chart'
import { Feed } from '../components/Feed'
import { Heatmap } from '../components/Heatmap'
import { byName, exercisesForMuscle, useIndex } from '../lib/derive'
import { daysBetween, shortDate, today } from '../lib/dates'
import { perWeek, setsPerDate } from '../lib/stats'
import { updateRow } from '../lib/store'
import type { Exercise } from '../lib/types'

function ExerciseLinks({ list }: { list: Exercise[] }) {
  if (!list.length) return <p className="hint">None</p>
  return (
    <div className="list">
      {[...list].sort(byName).map((e) => (
        <a key={e.id} className="row row-link" href={`#/exercise/${e.id}`}>
          <span className="row-main row-title">{e.name}</span>
          {e.archived && <span className="muted small">hidden</span>}
        </a>
      ))}
    </div>
  )
}

export function MuscleDetail({ id }: { id: string }) {
  const ix = useIndex()
  const muscle = ix.muscle.get(id)
  if (!muscle) return <p className="empty">Muscle not found.</p>

  const { primary, secondary } = exercisesForMuscle(ix, id)
  const exIds = new Set([...primary, ...secondary].map((e) => e.id))
  const logs = ix.data.logs.filter((l) => exIds.has(l.exercise_id))
  const dates = [...new Set(logs.map(ix.logDate))].sort()
  const last = dates[dates.length - 1]
  const weeks = perWeek(dates, 12)
  const recent = weeks.slice(-4).reduce((s, w) => s + w.value, 0) / 4

  return (
    <div className="page">
      <PageHeader
        back="history"
        title={
          <div className="inline">
            <span className="dot dot-lg" style={{ background: muscle.color }} />
            <input
              className="title-input"
              aria-label="Muscle name"
              value={muscle.name}
              onChange={(e) => updateRow('muscles', id, { name: e.target.value })}
            />
          </div>
        }
      />
      <section className="section card card-pad">
        <h2>Activity</h2>
        <Heatmap values={setsPerDate(ix, logs)} onTap={(d) => (window.location.hash = `#/log/${d}`)} />
      </section>
      <section className="stats">
        <Stat label="Last trained" value={last ? shortDate(last) : '—'} />
        <Stat label="Days since" value={last ? daysBetween(last, today()) : '—'} />
        <Stat label="Sessions / week" value={recent.toFixed(1)} sub="last 4 weeks" />
        <Stat label="Sessions" value={dates.length} sub="all time" />
      </section>
      <section className="section card card-pad">
        <Chart kind="bar" label="Sessions per week" points={weeks} format={(v) => `${Math.round(v * 10) / 10}`} />
      </section>
      <section className="section">
        <h2>Primary for</h2>
        <ExerciseLinks list={primary} />
        <h2>Secondary for</h2>
        <ExerciseLinks list={secondary} />
      </section>
      <section className="section">
        <h2>History</h2>
        <Feed filter={(l) => exIds.has(l.exercise_id)} />
      </section>
    </div>
  )
}
