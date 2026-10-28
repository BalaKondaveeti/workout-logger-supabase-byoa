import { useEffect, useRef, useState } from 'react'
import { MuscleTags, PageHeader, Stars } from '../components/Bits'
import { DownIcon, UpIcon, CloseIcon, ChevronIcon } from '../components/Icons'
import { SaveStatus } from '../components/SaveStatus'
import { SearchSelect } from '../components/SearchSelect'
import { addedSets, addSet, deleteLog, deleteSet, moveLog, trashDay, updateDay, createDayType } from '../lib/actions'
import { byName, lastTime, useIndex } from '../lib/derive'
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

function SetRow({ set, n, focus, showSides, flash }: { set: GymSet; n: number; focus: boolean; showSides: boolean; flash: boolean }) {
  const [noteOpen, setNoteOpen] = useState(!!set.note)
  const patch = (p: Partial<GymSet>) => updateRow('sets', set.id, p)
  const missing = set.reps === null && addedSets.has(set.id)
  return (
    <div className={`set-row${flash ? ' just-added' : ''}${missing ? ' missing-reps' : ''}`} data-set={set.id}>
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
  const [flash, setFlash] = useState<{ id: string; text: string; warn?: boolean } | null>(null)
  const flashTimer = useRef(0)
  const [doneWarn, setDoneWarn] = useState('')
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
              <span>
                {shortDate(ix.logDate(prev))} · {fmtSets(prevSets, displayUnit, ', ') || 'no sets'}
                {prev.rating ? <> · <Stars value={prev.rating} /></> : null}
              </span>
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
            <SetRow key={s.id} set={s} n={i + 1} focus={s.id === focusSet} showSides={showSides} flash={flash?.id === s.id} />
          ))}
          <button
            type="button"
            className={`btn btn-block btn-big add-set${flash ? (flash.warn ? ' warn' : ' done') : ''}`}
            onClick={() => {
              const show = (f: { id: string; text: string; warn?: boolean }) => {
                setFlash(f)
                clearTimeout(flashTimer.current)
                flashTimer.current = window.setTimeout(() => setFlash(null), 1600)
              }
              // the last set still has no reps: point at it instead of adding another (stops double taps)
              const last = sets[sets.length - 1]
              if (last && last.reps === null) {
                focusReps(last.id)
                show({ id: last.id, text: `Add reps to set ${sets.length} first`, warn: true })
                return
              }
              const id = addSet(log.id)
              setFocusSet(id)
              navigator.vibrate?.(12)
              show({ id, text: `✓ Set ${sets.length + 1} added` })
            }}
          >
            {flash?.text ?? '+ Add set'}
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
          <button
            type="button"
            className={`btn btn-block btn-big btn-done${doneWarn ? ' warn' : ''}`}
            onClick={() => {
              const empty = sets.findIndex((s) => s.reps === null && addedSets.has(s.id))
              if (empty >= 0 && !doneWarn) {
                // first tap: point at the set that still needs reps; a second tap closes anyway
                focusReps(sets[empty].id)
                setDoneWarn(`Set ${empty + 1} has no reps · tap again to close`)
                window.setTimeout(() => setDoneWarn(''), 2500)
                return
              }
              setDoneWarn('')
              onToggle()
              window.setTimeout(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0)
            }}
          >
            {doneWarn || 'Done'}
          </button>
        </div>
      )}
    </div>
  )
}

function focusReps(setId: string) {
  const input = document.querySelector<HTMLInputElement>(`[data-set="${setId}"] input.reps`)
  input?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  input?.focus()
}

// Sets added on this screen that still have no reps.
function emptySets(ix: ReturnType<typeof useIndex>, logs: Log[]) {
  return logs.flatMap((l) =>
    (ix.setsOfLog.get(l.id) ?? [])
      .map((s, i) => ({ s, n: i + 1, log: l }))
      .filter(({ s }) => s.reps === null && addedSets.has(s.id)),
  )
}

// Shown when leaving the day while a new set has no reps.
function MissingRepsSheet({
  items,
  onFill,
  onDelete,
  onKeep,
}: {
  items: { s: GymSet; n: number; log: Log }[]
  onFill: () => void
  onDelete: () => void
  onKeep: () => void
}) {
  const ix = useIndex()
  return (
    <div className="sheet-backdrop" onClick={onFill}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="missing-reps-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="missing-reps-title">No reps entered</h3>
        <p className="muted">
          {items.length === 1 ? 'This set has' : 'These sets have'} no rep count. Fill {items.length === 1 ? 'it' : 'them'} in,
          or delete {items.length === 1 ? 'it' : 'them'} if added by mistake?
        </p>
        <ul className="sheet-list">
          {items.map(({ s, n, log }) => (
            <li key={s.id}>
              {ix.exercise.get(log.exercise_id)?.name ?? 'Exercise'} · set {n}
              {s.weight !== null ? ` · ${s.weight}${s.unit}` : ''}
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary btn-block btn-big" onClick={onFill}>
          Fill in reps
        </button>
        <button type="button" className="btn btn-danger btn-block" onClick={onDelete}>
          Delete {items.length === 1 ? 'empty set' : `${items.length} empty sets`}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onKeep}>
          Keep without reps
        </button>
      </div>
    </div>
  )
}

// The day's split (Push, Pull, Legs…), picked from the user's own list; "+ Add new" adds to it.
function SplitPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const ix = useIndex()
  const options = ix.data.dayTypes
    .filter((t) => !t.archived || t.id === value)
    .sort(byName)
    .map((t) => ({ id: t.id, label: t.name, color: t.color }))
  return (
    <div className="field">
      <span>Split</span>
      <div className="inline split-picker">
        <div className="grow">
          <SearchSelect
            options={options}
            value={value}
            placeholder="Push, pull, legs…"
            onPick={onChange}
            addLabel="Add new split"
            onAdd={(q) => {
              const name = q || window.prompt('New split name (e.g. Push, Pull, Legs, Arms)')?.trim()
              if (!name) return
              const existing = ix.data.dayTypes.find((t) => t.name.toLowerCase() === name.toLowerCase())
              onChange(existing?.id ?? createDayType(name))
            }}
          />
        </div>
        {value && (
          <button type="button" className="icon-btn" aria-label="Clear split" onClick={() => onChange(null)}>
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  )
}

export function LogDay({ date: routeDate, focusLog }: { date?: string; focusLog?: string }) {
  const date = routeDate && isISODate(routeDate) ? routeDate : today()
  const ix = useIndex()
  const day = ix.dayByDate.get(date)
  const logs = day ? (ix.logsOfDay.get(day.id) ?? []) : []
  const [openLogs, setOpenLogs] = useState<Set<string>>(() => new Set(focusLog ? [focusLog] : []))
  const [leaving, setLeaving] = useState<string | null>(null) // href we were about to go to
  const empties = emptySets(ix, logs)
  const emptiesRef = useRef(empties)
  emptiesRef.current = empties

  // Leaving the day (back, tabs, + Add exercise) with a new set that has no reps: ask first.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null
      if (!a || !emptiesRef.current.length) return
      if (a.getAttribute('href') === window.location.hash) return
      e.preventDefault()
      e.stopPropagation()
      setLeaving(a.getAttribute('href'))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  const go = (href: string | null) => {
    setLeaving(null)
    if (href) window.location.hash = href
  }
  const dur = durationMinutes(day?.check_in ?? null, day?.check_out ?? null)

  const toggle = (id: string) =>
    setOpenLogs((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="page has-bottom-action">
      <PageHeader back="#/" title={date === today() ? 'Today' : longDate(date)} right={<SaveStatus />} />
      <div className="bottom-action">
        <a className="btn btn-primary btn-block btn-big" href={`#/log/${date}/add`}>
          + Add exercise
        </a>
      </div>

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
        <SplitPicker value={day?.type_id ?? null} onChange={(type_id) => updateDay(date, { type_id })} />
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
        {logs.length === 0 && <p className="hint">Nothing logged for this day yet. Tap “+ Add exercise” below.</p>}
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

      {leaving !== null && empties.length > 0 && (
        <MissingRepsSheet
          items={empties}
          onFill={() => {
            const first = empties[0]
            setLeaving(null)
            setOpenLogs((s) => new Set([...s, first.log.id]))
            window.setTimeout(() => focusReps(first.s.id), 50)
          }}
          onDelete={() => {
            empties.forEach(({ s }) => deleteSet(s.id))
            go(leaving)
          }}
          onKeep={() => {
            empties.forEach(({ s }) => addedSets.delete(s.id))
            go(leaving)
          }}
        />
      )}

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
