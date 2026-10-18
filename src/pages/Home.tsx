import { PageHeader, Stat } from '../components/Bits'
import { Feed } from '../components/Feed'
import { Heatmap } from '../components/Heatmap'
import { Freshness } from '../components/SaveStatus'
import { SearchSelect } from '../components/SearchSelect'
import { byName, useIndex } from '../lib/derive'
import { addDays, daysBetween, shortDate, today } from '../lib/dates'

export function Home() {
  const ix = useIndex()
  const exercises = ix.data.exercises
    .filter((e) => !e.archived)
    .sort(byName)
    .map((e) => {
      const m = e.primary_muscle_id ? ix.muscle.get(e.primary_muscle_id) : undefined
      return { id: e.id, label: e.name, color: m?.color, sub: m?.name }
    })
  const muscles = ix.data.muscles
    .filter((m) => !m.archived)
    .sort(byName)
    .map((m) => ({ id: m.id, label: m.name, color: m.color }))

  const now = today()
  const visits = ix.dates.filter((d) => d <= now)
  const last = visits[0]
  const since = last ? daysBetween(last, now) : null
  const visits7 = visits.filter((d) => d >= addDays(now, -6)).length
  const visits30 = visits.filter((d) => d >= addDays(now, -29)).length
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  return (
    <div className="page">
      <PageHeader title={<h1>Gym</h1>} right={<Freshness />} />
      <div className="grid-2">
        <SearchSelect options={exercises} placeholder="Workout" onPick={(id) => (window.location.hash = `#/exercise/${id}`)} />
        <SearchSelect options={muscles} placeholder="Muscle" onPick={(id) => (window.location.hash = `#/muscle/${id}`)} />
      </div>
      <section className="section">
        <h2>Activity</h2>
        <Heatmap values={ix.setsPerDate} onTap={(d) => (window.location.hash = `#/log/${d}`)} />
      </section>
      <section className="stats stats-3">
        <Stat label="Since last visit" value={since === null ? '—' : plural(since, 'day')} sub={last ? shortDate(last) : undefined} />
        <Stat label="Last 7 days" value={plural(visits7, 'visit')} />
        <Stat label="Last 30 days" value={plural(visits30, 'visit')} />
      </section>
      <section className="section">
        <h2>Gym sessions</h2>
        <Feed />
      </section>
    </div>
  )
}
