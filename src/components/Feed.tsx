import { useState } from 'react'
import { deleteLog } from '../lib/actions'
import { useIndex } from '../lib/derive'
import { longDate, prettyDuration, durationMinutes, prettyTime } from '../lib/dates'
import { usePrefs } from '../lib/prefs'
import type { Day, Log } from '../lib/types'
import { fmtSet, fmtSets } from '../lib/units'
import { MuscleTags, Stars } from './Bits'
import { PencilIcon, TrashIcon } from './Icons'
import { SwipeRow } from './SwipeRow'

const PAGE_DAYS = 10

export function DayMeta({ day }: { day: Day }) {
  const dur = durationMinutes(day.check_in, day.check_out)
  const parts: string[] = []
  if (day.check_in || day.check_out) {
    parts.push(`${prettyTime(day.check_in) || '…'}–${prettyTime(day.check_out) || '…'}${dur !== null ? ` (${prettyDuration(dur)})` : ''}`)
  }
  if (day.pre_workout) parts.push('Pre-workout ⚡')
  return (
    <>
      {(parts.length > 0 || day.rating) && (
        <div className="day-meta">
          {parts.join(' · ')}
          {day.rating ? <Stars value={day.rating} /> : null}
        </div>
      )}
      {day.notes && <p className="day-notes">{day.notes}</p>}
    </>
  )
}

export function LogRow({ log, showDate }: { log: Log; showDate?: boolean }) {
  const ix = useIndex()
  const { displayUnit } = usePrefs()
  const [open, setOpen] = useState(false)
  const ex = ix.exercise.get(log.exercise_id)
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

// Statement-style history: one block per gym day, newest first, with "Show more".
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
        <section key={day.id} className="feed-day">
          <a className="day-head" href={`#/log/${day.date}`}>
            <span className="day-date">{longDate(day.date)}</span>
            <span className="muted small">{logs.length ? `${logs.length} exercise${logs.length > 1 ? 's' : ''}` : ''}</span>
          </a>
          {!filter && <DayMeta day={day} />}
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
