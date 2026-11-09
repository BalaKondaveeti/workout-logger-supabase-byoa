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
      <SplitGaps />
      <section className="section">
        <h2>Gym sessions</h2>
        <Feed />
      </section>
    </div>
  )
}

// Days since each split was last done, and its usual gap. Longest-ago first, so the top one is
// what's due next. Tap a split to open the last day it was done.
function SplitGaps() {
  const ix = useIndex()
  const now = today()
  const splits = ix.data.dayTypes.filter((t) => !t.archived)
  if (!splits.length) return null

  const rows = splits.map((t) => {
    const dates = [...new Set(ix.data.days.filter((d) => d.type_id === t.id && d.date <= now).map((d) => d.date))].sort()
    const last = dates[dates.length - 1]
    const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d))
    return {
      t,
      last,
      since: last ? daysBetween(last, now) : null,
      avgGap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
      count: dates.length,
    }
  })
  // never done first, then longest since; ties by name
  rows.sort((a, b) => (b.since ?? Infinity) - (a.since ?? Infinity) || a.t.name.localeCompare(b.t.name))

  return (
    <section className="section">
      <h2>Splits</h2>
      <div className="card">
        <div className="list">
          {rows.map((r) => {
            const body = (
              <>
                <span className="dot" style={{ background: r.t.color }} />
                <span className="grow">
                  <span className="row-title">{r.t.name}</span>
                  <span className="muted small split-sub">
                    {r.last ? `Last ${shortDate(r.last)}` : 'Not done yet'}
                    {r.avgGap !== null ? ` · usually every ${Math.round(r.avgGap * 10) / 10} days` : ''}
                  </span>
                </span>
                <span className="split-since">
                  {r.since === null ? (
                    <span className="muted">—</span>
                  ) : r.since === 0 ? (
                    <strong>Today</strong>
                  ) : (
                    <>
                      <strong>{r.since}</strong>
                      <span className="muted small"> day{r.since === 1 ? '' : 's'} ago</span>
                    </>
                  )}
                </span>
              </>
            )
            return r.last ? (
              <a key={r.t.id} className="row row-link split-row" href={`#/log/${r.last}`}>
                {body}
              </a>
            ) : (
              <div key={r.t.id} className="row split-row">
                {body}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
