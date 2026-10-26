import { useEffect, useRef, useState } from 'react'
import { MuscleTags, PageHeader, Stars } from '../components/Bits'
import { DownIcon, UpIcon, CloseIcon, ChevronIcon } from '../components/Icons'
import { SaveStatus } from '../components/SaveStatus'
import { addSet, deleteLog, deleteSet, moveLog, trashDay, updateDay } from '../lib/actions'
import { lastTime, useIndex } from '../lib/derive'
import { durationMinutes, hhmm, isISODate, longDate, nowTime, prettyDuration, shortDate, today } from '../lib/dates'
import { setPref, usePrefs } from '../lib/prefs'
import { updateRow } from '../lib/store'
import type { GymSet, Log } from '../lib/types'
import { fmtSets } from '../lib/units'

// Number field that keeps what you type ("4." or "") while the stored value is a number.
function NumInput({
  value,
  onChange,
  decimal,
  placeholder,
  label,
  autoFocus,
  className,
}: {
  value: number | null
  onChange: (n: number | null) => void
  decimal?: boolean
  placeholder?: string
  label: string
  autoFocus?: boolean
  className?: string
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text.replace(',', '.'))
    if (parsed !== value) setText(value === null ? '' : String(value))
  }, [value])
  return (
    <input
      className={`input num ${className ?? ''}`}
      inputMode={decimal ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      aria-label={label}
      placeholder={placeholder}
      autoFocus={autoFocus}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = decimal ? e.target.value.replace(/[^\d.,]/g, '') : e.target.value.replace(/\D/g, '')
        setText(t)
        const n = t.trim() === '' ? null : Number(t.replace(',', '.'))
        if (n === null || Number.isFinite(n)) onChange(n === null ? null : decimal ? n : Math.round(n))
      }}
    />
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`check${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch-row">
      <span className="grow">{label}</span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function SetRow({ set, n, focus, showSides }: { set: GymSet; n: number; focus: boolean; showSides: boolean }) {
  const [noteOpen, setNoteOpen] = useState(!!set.note)
  const patch = (p: Partial<GymSet>) => updateRow('sets', set.id, p)
  return (
    <div className="set-row">
      <div className="set-main">
        <span className="set-n">{n}</span>
        <NumInput label={`Set ${n} weight`} decimal placeholder="Wt" value={set.weight} onChange={(weight) => patch({ weight })} className="weight" />
        <button
          type="button"
          className="unit-btn"
          aria-label={`Unit ${set.unit}, tap to switch`}
          onClick={() => patch({ unit: set.unit === 'kg' ? 'lb' : 'kg' })}
        >
          {set.unit}
        </button>
        <span className="times">×</span>
        <NumInput label={`Set ${n} reps`} placeholder="Reps" value={set.reps} onChange={(reps) => patch({ reps })} autoFocus={focus} className="reps" />
        <button type="button" className="icon-btn" aria-label={`Remove set ${n}`} onClick={() => deleteSet(set.id)}>
          <CloseIcon />
        </button>
      </div>
      <div className="set-opts">
        <Check label="Each arm" checked={set.per_arm && !set.side} onChange={(v) => patch({ per_arm: v, side: null })} />
        {(showSides || set.side) && (
          <>
            <Check label="Left" checked={set.side === 'left'} onChange={(v) => patch({ side: v ? 'left' : null, per_arm: false })} />
            <Check label="Right" checked={set.side === 'right'} onChange={(v) => patch({ side: v ? 'right' : null, per_arm: false })} />
          </>
        )}
        {!noteOpen && (
          <button type="button" className="link-btn" onClick={() => setNoteOpen(true)}>
            + note
          </button>
        )}
      </div>
      {noteOpen && (
        <input
          className="input input-sm"
          placeholder="Set note"
          value={set.note ?? ''}
          autoFocus={!set.note}
          onChange={(e) => patch({ note: e.target.value || null })}
        />
      )}
    </div>
  )
}

function LogEditor({
  log,
  date,
  open,
  onToggle,
  isFirst,
  isLast,
}: {
  log: Log
  date: string
  open: boolean
  onToggle: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const ix = useIndex()
  const { displayUnit, sides } = usePrefs()
  const [focusSet, setFocusSet] = useState<string | null>(null)
  const ex = ix.exercise.get(log.exercise_id)
  const sets = ix.setsOfLog.get(log.id) ?? []
  const prev = lastTime(ix, log.exercise_id, date)
  const prevSets = prev ? (ix.setsOfLog.get(prev.id) ?? []) : []
  const ref = useRef<HTMLDivElement>(null)
  // Left / Right checkboxes: remembered per exercise, and always on when a set already uses them
  const showSides = sides[log.exercise_id] ?? sets.some((s) => s.side)

  useEffect(() => {
    if (open && new URLSearchParams(window.location.hash.split('?')[1]).get('log') === log.id) {
      ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [open, log.id])

  return (
    <div className={`log-card${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className="log-card-head" onClick={onToggle} aria-expanded={open}>
        <span className="grow">
          <span className="log-card-title">{ex?.name ?? 'Unknown exercise'}</span>
          {!open && <span className="sets-inline">{sets.length ? fmtSets(sets, displayUnit) : 'No sets yet'}</span>}
        </span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="log-card-body">
          <MuscleTags exerciseId={log.exercise_id} />
          {ex && (
            <label className="field">
              <span>Machine notes</span>
              <textarea
                className="input"
                rows={1}
                placeholder="Seat height, pin position, cues…"
                value={ex.notes ?? ''}
                onChange={(e) => updateRow('exercises', ex.id, { notes: e.target.value || null })}
              />
            </label>
          )}
          <div className="last-time">
            <span className="muted small">Last time</span>
            {prev ? (
              <a href={`#/log/${ix.logDate(prev)}`}>
                {shortDate(ix.logDate(prev))} · {fmtSets(prevSets, displayUnit, ', ') || 'no sets'}
                {prev.rating ? <> · <Stars value={prev.rating} /></> : null}
              </a>
            ) : (
              <span className="muted">First time</span>
            )}
          </div>
          <Switch
            label="Left / right"
            checked={showSides}
            onChange={(v) => setPref('sides', { ...sides, [log.exercise_id]: v })}
          />
          {sets.map((s, i) => (
            <SetRow key={s.id} set={s} n={i + 1} focus={s.id === focusSet} showSides={showSides} />
          ))}
          <button type="button" className="btn btn-block btn-big" onClick={() => setFocusSet(addSet(log.id))}>
            + Add set
          </button>
          <div className="field">
            <span>Rating</span>
            <Stars value={log.rating} onChange={(rating) => updateRow('logs', log.id, { rating })} />
          </div>
          <label className="field">
            <span>Notes</span>
            <textarea
              className="input"
              rows={2}
              value={log.notes ?? ''}
              onChange={(e) => updateRow('logs', log.id, { notes: e.target.value || null })}
            />
          </label>
          <div className="inline log-card-foot">
            <button type="button" className="icon-btn" aria-label="Move up" disabled={isFirst} onClick={() => moveLog(log.id, -1)}>
              <UpIcon />
            </button>
            <button type="button" className="icon-btn" aria-label="Move down" disabled={isLast} onClick={() => moveLog(log.id, 1)}>
              <DownIcon />
            </button>
            <span className="grow" />
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => confirm(`Remove ${ex?.name ?? 'this exercise'} and its ${sets.length} sets from this day?`) && deleteLog(log.id)}
            >
              Remove exercise
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function LogDay({ date: routeDate, focusLog }: { date?: string; focusLog?: string }) {
  const date = routeDate && isISODate(routeDate) ? routeDate : today()
  const ix = useIndex()
  const day = ix.dayByDate.get(date)
  const logs = day ? (ix.logsOfDay.get(day.id) ?? []) : []
  const [openLogs, setOpenLogs] = useState<Set<string>>(() => new Set(focusLog ? [focusLog] : []))
  const dur = durationMinutes(day?.check_in ?? null, day?.check_out ?? null)

  const toggle = (id: string) =>
    setOpenLogs((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="page">
      <PageHeader back="#/" title={date === today() ? 'Today' : longDate(date)} right={<SaveStatus />}>
        <a className="btn btn-primary btn-block btn-big head-action" href={`#/log/${date}/add`}>
          + Add exercise
        </a>
      </PageHeader>

      <section className="section card card-pad">
        <label className="field">
          <span>Date</span>
          <input
            className="input"
            type="date"
            value={date}
            max={today()}
            onChange={(e) => e.target.value && window.location.replace(`#/log/${e.target.value}`)}
          />
        </label>
        <div className="times-grid">
          {(['check_in', 'check_out'] as const).map((k) => (
            <div className="field" key={k}>
              <span>{k === 'check_in' ? 'Check-in' : 'Check-out'}</span>
              <div className="inline">
                <input
                  className="input grow"
                  type="time"
                  value={hhmm(day?.[k] ?? null)}
                  onChange={(e) => updateDay(date, { [k]: e.target.value || null })}
                />
                <button type="button" className="btn btn-sm now-btn" onClick={() => updateDay(date, { [k]: nowTime() })}>
                  Now
                </button>
              </div>
            </div>
          ))}
        </div>
        {dur !== null && <p className="hint">Duration {prettyDuration(dur)}</p>}
        <label className="check check-lg">
          <input type="checkbox" checked={!!day?.pre_workout} onChange={(e) => updateDay(date, { pre_workout: e.target.checked })} />
          Pre-workout ⚡
        </label>
        <div className="field">
          <span>Day rating</span>
          <Stars value={day?.rating ?? null} onChange={(rating) => updateDay(date, { rating })} />
        </div>
        <label className="field">
          <span>Notes for the day</span>
          <textarea
            className="input"
            rows={2}
            value={day?.notes ?? ''}
            onChange={(e) => updateDay(date, { notes: e.target.value || null })}
          />
        </label>
      </section>

      <section className="section">
        <h2>Exercises</h2>
        {logs.length === 0 && <p className="hint">Nothing logged for this day yet. Tap “+ Add exercise” above.</p>}
        {logs.map((l, i) => (
          <LogEditor
            key={l.id}
            log={l}
            date={date}
            open={openLogs.has(l.id)}
            onToggle={() => toggle(l.id)}
            isFirst={i === 0}
            isLast={i === logs.length - 1}
          />
        ))}
      </section>

      {day && (
        <button
          type="button"
          className="btn btn-danger btn-block"
          onClick={() => {
            const n = logs.reduce((sum, l) => sum + (ix.setsOfLog.get(l.id)?.length ?? 0), 0)
            if (!confirm(`Delete ${longDate(date)} (${logs.length} exercise${logs.length === 1 ? '' : 's'}, ${n} set${n === 1 ? '' : 's'})? It goes to Menu → Recently deleted, where you can restore it.`)) return
            trashDay(day.id)
            window.location.replace('#/')
          }}
        >
          Delete this day
        </button>
      )}
    </div>
  )
}
