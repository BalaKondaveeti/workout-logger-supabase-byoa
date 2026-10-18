import { PageHeader, Stat } from '../components/Bits'
import { Feed } from '../components/Feed'
import { Heatmap } from '../components/Heatmap'
import { Freshness } from '../components/SaveStatus'
import { SearchSelect } from '../components/SearchSelect'
import { byName, useIndex } from '../lib/derive'
import { addDays, daysBetween, shortDate, today, weekStart } from '../lib/dates'

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
  const monthAgo = addDays(now, -29)
  const visits30 = visits.filter((d) => d >= monthAgo)
  const sets30 = visits30.reduce((sum, d) => sum + (ix.setsPerDate.get(d) ?? 0), 0)
  const thisWeek = visits.filter((d) => d >= weekStart(now)).length

  return (
    <div className="page">
      <PageHeader title={<h1>Gym</h1>} right={<Freshness />} />
      <section className="section">
        <h2>Last 30 days</h2>
        <Heatmap days={30} size="lg" values={ix.setsPerDate} onTap={(d) => (window.location.hash = `#/log/${d}`)} />
      </section>
      <section className="stats">
        <Stat
          label="Since last visit"
          value={since === null ? '—' : since === 0 ? 'Today' : `${since} day${since === 1 ? '' : 's'}`}
          sub={last && since ? shortDate(last) : undefined}
        />
        <Stat label="This week" value={`${thisWeek} visit${thisWeek === 1 ? '' : 's'}`} />
        <Stat label="Last 30 days" value={`${visits30.length} visit${visits30.length === 1 ? '' : 's'}`} />
        <Stat label="Sets, 30 days" value={sets30} />
      </section>
      <div className="grid-2">
        <SearchSelect options={exercises} placeholder="Exercise" onPick={(id) => (window.location.hash = `#/exercise/${id}`)} />
        <SearchSelect options={muscles} placeholder="Muscle" onPick={(id) => (window.location.hash = `#/muscle/${id}`)} />
      </div>
      <section className="section">
        <h2>History</h2>
        <Feed />
      </section>
    </div>
  )
}
