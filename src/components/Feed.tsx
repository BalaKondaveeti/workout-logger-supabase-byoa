import { useState } from 'react'
import { deleteLog } from '../lib/actions'
import { useIndex } from '../lib/derive'
import { durationMinutes, longDate, parseDate, prettyTime } from '../lib/dates'
import { usePrefs } from '../lib/prefs'
import type { Day, Log } from '../lib/types'
import { fmtSet, fmtSets } from '../lib/units'
import { MuscleTags, Stars } from './Bits'
import { PencilIcon, TrashIcon } from './Icons'
import { SwipeRow } from './SwipeRow'

const PAGE_DAYS = 10

// "1:30 PM–3:00 PM", or just the check-in / check-out time when only one is set
export function dayTimes(day: Day) {
  if (day.check_in && day.check_out) return `${prettyTime(day.check_in)}–${prettyTime(day.check_out)}`
  if (day.check_in) return prettyTime(day.check_in)
  if (day.check_out) return `out ${prettyTime(day.check_out)}`
  return ''
}

// "1.5 hrs" when both times are set
export function dayHours(day: Day) {
  const min = durationMinutes(day.check_in, day.check_out)
  if (min === null) return ''
  const h = Math.round((min / 60) * 10) / 10
  return `${h} hr${h === 1 ? '' : 's'}`
}

// Calendar-page style badge: "OCT" over "17"
function DateBadge({ date }: { date: string }) {
  const d = parseDate(date)
  return (
    <span className="date-badge" aria-hidden>
      <span>{d.toLocaleDateString(undefined, { month: 'short' })}</span>
      <strong>{d.getDate()}</strong>
    </span>
  )
}

function weekday(date: string) {
  const d = parseDate(date)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { weekday: 'long', ...(sameYear ? {} : { year: 'numeric' }) })
}

// Pre-workout, day rating and size of the session as small chips, then the day's notes.
export function DayMeta({ day, exercises, sets }: { day: Day; exercises: number; sets: number }) {
  return (
    <>
      <div className="day-meta">
        {day.pre_workout && <span className="chip-static energy">⚡ Pre-workout</span>}
        {exercises > 0 && (
          <span className="chip-static">
            {exercises} exercise{exercises === 1 ? '' : 's'} · {sets} set{sets === 1 ? '' : 's'}
          </span>
        )}
        {day.rating ? <Stars value={day.rating} /> : null}
      </div>
      {day.notes && <p className="day-notes">{day.notes}</p>}
    </>
  )
}

export function LogRow({ log, showDate }: { log: Log; showDate?: boolean }) {
  const ix = useIndex()
  const { displayUnit } = usePrefs()
  const [open, setOpen] = useState(false)
  const ex = ix.exercise.get(log.exercise_id)
  const muscle = ex?.primary_muscle_id ? ix.muscle.get(ex.primary_muscle_id) : undefined
  const sets = ix.setsOfLog.get(log.id) ?? []
  const date = ix.logDate(log)

  return (
    <SwipeRow
      onTap={() => setOpen(!open)}
      actions={[
        { label: 'Edit', icon: <PencilIcon />, onClick: () => (window.location.hash = `#/log/${date}?log=${log.id}`) },
        {
          label: 'Delete',
          icon: <TrashIcon />,
          tone: 'delete',
          onClick: () => confirm(`Delete ${ex?.name ?? 'this exercise'} from ${longDate(date)}?`) && deleteLog(log.id),
        },
      ]}
    >
      <div className="row log-row">
        <span className="muscle-bar" style={{ background: muscle?.color }} aria-hidden />
        <div className="row-main">
          <div className="row-title-line">
            <span className="row-title">{ex?.name ?? 'Unknown exercise'}</span>
            <Stars value={log.rating} />
          </div>
          {showDate && <div className="row-sub">{longDate(date)}</div>}
          {!open && sets.length > 0 && <div className="sets-inline">{fmtSets(sets, displayUnit)}</div>}
          {!open && log.notes && <div className="row-note">{log.notes}</div>}
          {open && (
            <div className="row-details">
              <MuscleTags exerciseId={log.exercise_id} />
              <ol className="set-list">
                {sets.map((s) => (
                  <li key={s.id}>
                    <span className="mono-num">{fmtSet(s, displayUnit)}</span>
                    {s.note && <span className="muted"> — {s.note}</span>}
                  </li>
                ))}
              </ol>
              {log.notes && <p className="pre-wrap">{log.notes}</p>}
              <a className="small" href={`#/exercise/${log.exercise_id}`} onClick={(e) => e.stopPropagation()}>
                Exercise details →
              </a>
            </div>
          )}
        </div>
      </div>
    </SwipeRow>
  )
}

// Gym sessions: one card per day, newest first, with "Show more".
// `filter` limits which logs show (exercise / muscle pages); days with none are skipped.
export function Feed({ filter }: { filter?: (log: Log) => boolean }) {
  const ix = useIndex()
  const [limit, setLimit] = useState(PAGE_DAYS)

  const days = ix.dates
    .map((date) => {
      const day = ix.dayByDate.get(date)!
      const logs = (ix.logsOfDay.get(day.id) ?? []).filter((l) => !filter || filter(l))
      return { day, logs }
    })
    .filter(({ logs }) => !filter || logs.length > 0)

  if (!days.length) return <p className="empty">Nothing logged yet.</p>

  return (
    <div className="feed">
      {days.slice(0, limit).map(({ day, logs }) => (
        <section key={day.id} className="feed-day card">
          <a className="day-head" href={`#/log/${day.date}`} aria-label={`${longDate(day.date)}, open day`}>
            <DateBadge date={day.date} />
            <span className="grow day-head-main">
              <span className="day-date">{weekday(day.date)}</span>
              {dayTimes(day) && <span className="day-time">{dayTimes(day)}</span>}
            </span>
            {dayHours(day) && <span className="pill">{dayHours(day)}</span>}
          </a>
          {!filter && (
            <DayMeta
              day={day}
              exercises={logs.length}
              sets={logs.reduce((n, l) => n + (ix.setsOfLog.get(l.id)?.length ?? 0), 0)}
            />
          )}
          <div className="list">
            {logs.map((l) => (
              <LogRow key={l.id} log={l} />
            ))}
          </div>
        </section>
      ))}
      {days.length > limit && (
        <button className="btn btn-block" onClick={() => setLimit(limit + PAGE_DAYS)}>
          Show more
        </button>
      )}
    </div>
  )
}
