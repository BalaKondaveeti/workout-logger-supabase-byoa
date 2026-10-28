import { PageHeader, Stat } from '../components/Bits'
import { Chart } from '../components/Chart'
import { Heatmap } from '../components/Heatmap'
import { SearchSelect } from '../components/SearchSelect'
import { addDays, daysBetween, durationMinutes, prettyDuration, shortDate, today } from '../lib/dates'
import { byName, useIndex } from '../lib/derive'
import { setPref, usePrefs, type StatsRange } from '../lib/prefs'
import { perWeek } from '../lib/stats'

const RANGES: { value: StatsRange; label: string; days?: number }[] = [
  { value: '4w', label: '4 weeks', days: 28 },
  { value: '12w', label: '12 weeks', days: 84 },
  { value: 'all', label: 'All time' },
]

const round1 = (n: number) => Math.round(n * 10) / 10

export function Stats() {
  const ix = useIndex()
  const { statsRange } = usePrefs()
  const range = RANGES.find((r) => r.value === statsRange) ?? RANGES[1]
  const now = today()

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

  // ---- the chosen period ----
  const allVisits = [...ix.dates].filter((d) => d <= now).sort() // oldest first
  const first = allVisits[0]
  const start = range.days ? addDays(now, -(range.days - 1)) : (first ?? now)
  const visits = allVisits.filter((d) => d >= start)
  const days = daysBetween(start, now) + 1
  const weeks = Math.max(1, days / 7)
  const perWeekAvg = visits.length / weeks

  const gaps = visits.slice(1).map((d, i) => daysBetween(visits[i], d))
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
  const longestGap = gaps.length ? Math.max(...gaps) : null

  const inRange = new Set(visits)
  const dayRows = ix.data.days.filter((d) => inRange.has(d.date))
  const durations = dayRows.map((d) => durationMinutes(d.check_in, d.check_out)).filter((m): m is number => m !== null)
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null

  // exercises and muscles trained in the period: sessions (dates) and sets
  const exStats = new Map<string, { dates: Set<string>; sets: number; last: string }>()
  for (const l of ix.data.logs) {
    const date = ix.logDate(l)
    if (!inRange.has(date)) continue
    const st = exStats.get(l.exercise_id) ?? { dates: new Set<string>(), sets: 0, last: date }
    st.dates.add(date)
    st.sets += ix.setsOfLog.get(l.id)?.length ?? 0
    if (date > st.last) st.last = date
    exStats.set(l.exercise_id, st)
  }
  const exList = [...exStats]
    .map(([id, st]) => ({ ex: ix.exercise.get(id), id, ...st }))
    .filter((r) => r.ex)
    .sort((a, b) => b.dates.size - a.dates.size || b.sets - a.sets || a.ex!.name.localeCompare(b.ex!.name))

  const muscleStats = new Map<string, { dates: Set<string>; sets: number }>()
  for (const r of exList) {
    const mId = r.ex!.primary_muscle_id
    if (!mId) continue
    const st = muscleStats.get(mId) ?? { dates: new Set<string>(), sets: 0 }
    r.dates.forEach((d) => st.dates.add(d))
    st.sets += r.sets
    muscleStats.set(mId, st)
  }
  const muscleList = [...muscleStats]
    .map(([id, st]) => ({ m: ix.muscle.get(id), id, ...st }))
    .filter((r) => r.m)
    .sort((a, b) => b.dates.size - a.dates.size || b.sets - a.sets)

  const splitCounts = new Map<string, number>()
  for (const d of dayRows) if (d.type_id) splitCounts.set(d.type_id, (splitCounts.get(d.type_id) ?? 0) + 1)
  const splits = [...splitCounts]
    .map(([id, n]) => ({ t: ix.dayType.get(id), n }))
    .filter((r) => r.t)
    .sort((a, b) => b.n - a.n)

  const chartWeeks = range.days ? range.days / 7 : Math.min(26, Math.max(4, Math.ceil(weeks)))

  return (
    <div className="page">
      <PageHeader title={<h1 className="large-title">Stats</h1>} />
      <div className="grid-2">
        <SearchSelect floating options={exercises} placeholder="Workout" onPick={(id) => (window.location.hash = `#/exercise/${id}`)} />
        <SearchSelect floating options={muscles} placeholder="Muscle" onPick={(id) => (window.location.hash = `#/muscle/${id}`)} />
      </div>

      <div className="segmented" role="radiogroup" aria-label="Period">
        {RANGES.map((r) => (
          <button key={r.value} role="radio" aria-checked={r.value === range.value} onClick={() => setPref('statsRange', r.value)}>
            {r.label}
          </button>
        ))}
      </div>
      <p className="hint">
        {range.days ? `Last ${range.days / 7} weeks` : first ? `Since ${shortDate(first)}` : 'No visits yet'} · {shortDate(start)} – today
      </p>

      <section className="stats">
        <Stat label="Visits" value={visits.length} sub={`in ${Math.round(weeks)} week${Math.round(weeks) === 1 ? '' : 's'}`} highlight />
        <Stat label="Visits / week" value={round1(perWeekAvg)} sub="average" highlight />
        <Stat label="Avg gap" value={avgGap === null ? '—' : round1(avgGap)} sub="days between visits" />
        <Stat label="Longest gap" value={longestGap ?? '—'} sub={longestGap === null ? undefined : 'days'} />
        <Stat label="Exercises trained" value={exList.length} sub={`${muscleList.length} muscle${muscleList.length === 1 ? '' : 's'}`} />
        <Stat label="Avg session" value={avgDuration === null ? '—' : prettyDuration(Math.round(avgDuration))} sub={durations.length ? `${durations.length} timed` : 'no check-in/out'} />
      </section>

      <section className="section card card-pad">
        <h2>Visits per week</h2>
        <Chart kind="bar" label="Visits per week" points={perWeek(allVisits, chartWeeks)} format={(v) => `${v}`} />
      </section>

      <section className="section card card-pad">
        <h2>Activity</h2>
        <Heatmap values={ix.setsPerDate} onTap={(d) => (window.location.hash = `#/log/${d}`)} />
      </section>

      {splits.length > 0 && (
        <section className="section">
          <h2>Splits</h2>
          <div className="day-meta stats-splits">
            {splits.map(({ t, n }) => (
              <span key={t!.id} className="chip-static chip-type">
                <span className="dot" style={{ background: t!.color }} />
                {t!.name} · {n}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2>Exercises trained</h2>
        {exList.length === 0 ? (
          <p className="hint">Nothing in this period.</p>
        ) : (
          <div className="card">
            <div className="list">
              {exList.map((r) => {
                const m = r.ex!.primary_muscle_id ? ix.muscle.get(r.ex!.primary_muscle_id) : undefined
                return (
                  <a key={r.id} className="row row-link stat-row" href={`#/exercise/${r.id}`}>
                    <span className="dot" style={{ background: m?.color }} />
                    <span className="grow row-title">{r.ex!.name}</span>
                    <span className="stat-row-num">
                      {r.dates.size}× <span className="muted small">· {r.sets} sets · {shortDate(r.last)}</span>
                    </span>
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {muscleList.length > 0 && (
        <section className="section">
          <h2>Muscles trained</h2>
          <div className="card">
            <div className="list">
              {muscleList.map((r) => (
                <a key={r.id} className="row row-link stat-row" href={`#/muscle/${r.id}`}>
                  <span className="dot" style={{ background: r.m!.color }} />
                  <span className="grow row-title">{r.m!.name}</span>
                  <span className="stat-row-num">
                    {r.dates.size}× <span className="muted small">· {r.sets} sets</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
          <p className="hint">Counted by each exercise's primary muscle. × = days trained.</p>
        </section>
      )}
    </div>
  )
}
