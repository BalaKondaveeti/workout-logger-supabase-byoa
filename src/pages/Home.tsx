import { PageHeader, Stat } from '../components/Bits'
import { Feed } from '../components/Feed'
import { Heatmap } from '../components/Heatmap'
import { Freshness } from '../components/SaveStatus'
import { useIndex } from '../lib/derive'
import { restLevel } from '../lib/stats'
import { addDays, daysBetween, shortDate, today } from '../lib/dates'

export function Home() {
  const ix = useIndex()
  const now = today()
  const visits = ix.dates.filter((d) => d <= now)
  const last = visits[0]
  const since = last ? daysBetween(last, now) : null
  const level = restLevel(since)
  const visits7 = visits.filter((d) => d >= addDays(now, -6)).length
  const visits30 = visits.filter((d) => d >= addDays(now, -29)).length

  return (
    <div className="page">
      <PageHeader title={<h1 className="large-title">Gym</h1>} right={<Freshness />} />
      <section className="section card card-pad">
        <h2>Activity</h2>
        <Heatmap values={ix.setsPerDate} onTap={(d) => (window.location.hash = `#/log/${d}`)} />
      </section>
      <section className="stats stats-3 stats-compact">
        <Stat
          label="Last visit"
          value={since ?? '—'}
          sub={since === null ? undefined : `day${since === 1 ? '' : 's'} ago · ${shortDate(last)}`}
          highlight
          tone={level === 'warn' ? 'warn' : level === 'ok' ? undefined : 'alert'}
        />
        <Stat label="Last 7 days" value={visits7} sub={visits7 === 1 ? 'visit' : 'visits'} highlight />
        <Stat label="Last 30 days" value={visits30} sub={visits30 === 1 ? 'visit' : 'visits'} highlight />
      </section>
      <section className="section">
        <h2>Gym sessions</h2>
        <Feed />
      </section>
    </div>
  )
}
