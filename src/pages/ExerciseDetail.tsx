import { useState } from 'react'
import { AutoTextarea, MuscleTags, PageHeader, Stars, Stat } from '../components/Bits'
import { SearchSelect } from '../components/SearchSelect'
import { Chart } from '../components/Chart'
import { ExerciseForm } from '../components/ExerciseForm'
import { PencilIcon } from '../components/Icons'
import { Feed } from '../components/Feed'
import { Heatmap } from '../components/Heatmap'
import { lastMerge, undoMerge } from '../lib/actions'
import { byName, useIndex } from '../lib/derive'
import { longDate, prettySeconds, relativeDay, shortDate } from '../lib/dates'
import { setPref, usePrefs } from '../lib/prefs'
import { adjustedAvgKg, exerciseStats, setsPerDate, setTiming, usualReps, WARMUP_SHARE } from '../lib/stats'
import { updateRow } from '../lib/store'
import { convert, fmtSets, num } from '../lib/units'

export function ExerciseDetail({ id }: { id: string }) {
  const ix = useIndex()
  const { displayUnit, weightChart } = usePrefs()
  const [merged, setMerged] = useState(() => (lastMerge?.targetId === id ? lastMerge : null))
  const ex = ix.exercise.get(id)
  if (!ex) return <p className="empty">Exercise not found.</p>

  const unit = displayUnit === 'logged' ? ex.default_unit : displayUnit
  const w = (kg: number) => `${num(convert(kg, 'kg', unit))} ${unit}`
  const st = exerciseStats(ix, id)
  const reps = usualReps(st.sessions.flatMap((s) => s.sets))
  const logs = ix.logsOfExercise.get(id) ?? []
  const timed = logs.map((l) => setTiming(ix.setsOfLog.get(l.id) ?? [])).filter((t): t is NonNullable<typeof t> => t !== null)
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

  return (
    <div className="page">
      <PageHeader
        back="history"
        title={
          <span className="title-with-edit">
            <h1>{ex.name}</h1>
            <a className="icon-btn" href={`#/exercise/${id}/edit`} aria-label={`Edit ${ex.name}`}>
              <PencilIcon />
            </a>
          </span>
        }
      />
      {merged && (
        <div className="merge-done">
          <span className="grow">
            Merged <strong>{merged.sourceName}</strong> in ({merged.logIds.length} entr{merged.logIds.length === 1 ? 'y' : 'ies'}).
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              undoMerge(merged)
              setMerged(null)
            }}
          >
            Undo
          </button>
        </div>
      )}
      <section className="section card card-pad">
          {ex.archived && <p className="hint">Hidden from pickers. Unhide it under Menu → Exercises.</p>}
          <MuscleTags exerciseId={id} />
          <label className="field">
            <span>Machine notes</span>
            <AutoTextarea
              className="input"
              rows={2}
              placeholder="Seat height, pin position, cues…"
              value={ex.notes ?? ''}
              onChange={(e) => updateRow('exercises', id, { notes: e.target.value || null })}
            />
          </label>
          <a className="link-btn small" href={`#/merge?from=${id}`}>
            Merge with another exercise…
          </a>
        </section>

      <section className="section card card-pad">
        <h2>Activity</h2>
        <Heatmap values={setsPerDate(ix, logs)} onTap={(d) => (window.location.hash = `#/log/${d}`)} />
      </section>

      <section className="stats">
        <Stat label="Last performed" value={st.last ? shortDate(st.last) : '—'} sub={st.last ? relativeDay(st.last) : undefined} />
        <Stat label="Sessions" value={st.sessions.length} />
        <Stat label="Best weight" value={st.pr ? w(st.pr.kg) : '—'} sub={st.pr ? shortDate(st.pr.date) : undefined} />
        <Stat label="Avg rating" value={st.avgRating ? `${st.avgRating.toFixed(1)} ★` : '—'} />
        <Stat label="Est. 1RM best" value={st.best1rm ? w(st.best1rm.kg) : '—'} sub={st.best1rm ? shortDate(st.best1rm.date) : undefined} />
        <Stat label="Avg duration" value={timed.length ? prettySeconds(avg(timed.map((t) => t.durationSec))) : '—'} sub={timed.length ? `${timed.length} timed` : 'no set times'} />
        <Stat label="Avg rest" value={timed.length ? prettySeconds(avg(timed.map((t) => t.avgRestSec))) : '—'} sub={timed.length ? 'between sets' : undefined} />
        <Stat label="Est. 1RM latest" value={st.latest1rm ? w(st.latest1rm.kg) : '—'} sub={st.latest1rm ? shortDate(st.latest1rm.date) : undefined} />
      </section>
      <p className="hint">Estimated 1RM uses Epley: weight × (1 + reps / 30).</p>

      {st.sessions.length > 0 && (
        <section className="section card card-pad">
          <div className="segmented" role="radiogroup" aria-label="Weight chart">
            {(
              [
                ['avg', 'Average weight'],
                ['top', 'Top weight'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} role="radio" aria-checked={weightChart === v} onClick={() => setPref('weightChart', v)}>
                {label}
              </button>
            ))}
          </div>
          <Chart
            key={weightChart}
            kind="line"
            label={weightChart === 'avg' ? `Average weight per session (at ${reps} reps)` : 'Top weight per session'}
            points={st.sessions
              .map((s) => ({ date: s.date, kg: weightChart === 'avg' ? adjustedAvgKg(s.sets, reps) : s.maxKg }))
              .filter((p) => p.kg > 0)
              .map((p) => ({ date: p.date, value: convert(p.kg, 'kg', unit) }))}
            format={(v) => `${num(v)} ${unit}`}
          />
          <Chart
            kind="bar"
            label="Volume per session"
            points={st.sessions.slice(-30).map((s) => ({ date: s.date, value: convert(s.volumeKg, 'kg', unit) }))}
            format={(v) => `${Math.round(v).toLocaleString()} ${unit}`}
          />
          <p className="hint">
            {weightChart === 'avg'
              ? `Average weight: every set converted to its equal at ${reps} reps (your usual for this exercise, Epley), warm-ups under ${Math.round(WARMUP_SHARE * 100)}% of the day's best left out, then averaged. `
              : 'Top weight = heaviest set of the session. '}
            Volume = weight × reps, doubled for each-arm sets. Last 30 sessions.
          </p>
        </section>
      )}

      <History id={id} />
    </div>
  )
}

// History of one exercise. "Select" lets you tick entries and move them to another exercise.
function History({ id }: { id: string }) {
  const ix = useIndex()
  const { displayUnit } = usePrefs()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [picking, setPicking] = useState(false)
  const [moved, setMoved] = useState<{ ids: string[]; to: string } | null>(null)
  const logs = ix.logsOfExercise.get(id) ?? []
  const ex = ix.exercise.get(id)

  const toggle = (logId: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(logId)) next.delete(logId)
      else next.add(logId)
      return next
    })
  const stop = () => {
    setSelecting(false)
    setSelected(new Set())
    setPicking(false)
  }
  const options = ix.data.exercises
    .filter((e) => !e.archived && e.id !== id)
    .sort(byName)
    .map((e) => {
      const m = e.primary_muscle_id ? ix.muscle.get(e.primary_muscle_id) : undefined
      const last = ix.logsOfExercise.get(e.id)?.[0]
      return { id: e.id, label: e.name, color: m?.color, sub: last ? shortDate(ix.logDate(last)) : m?.name }
    })
  const moveTo = (to: string) => {
    const ids = [...selected]
    const name = ix.exercise.get(to)?.name
    if (!confirm(`Move ${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} from "${ex?.name}" to "${name}"? Sets, times, notes and ratings come along.`)) return
    ids.forEach((logId) => updateRow('logs', logId, { exercise_id: to }, true))
    setMoved({ ids, to })
    stop()
  }
  const undo = () => {
    if (!moved) return
    moved.ids.forEach((logId) => updateRow('logs', logId, { exercise_id: id }, true))
    setMoved(null)
  }

  return (
    <section className={`section${selecting ? ' has-bottom-action' : ''}`}>
      <div className="inline">
        <h2 className="grow">History</h2>
        {logs.length > 0 && (
          <button type="button" className="btn btn-sm" onClick={() => (selecting ? stop() : (setSelecting(true), setMoved(null)))}>
            {selecting ? 'Cancel' : 'Select'}
          </button>
        )}
      </div>

      {moved && (
        <div className="merge-done">
          <span className="grow">
            Moved {moved.ids.length} entr{moved.ids.length === 1 ? 'y' : 'ies'} to{' '}
            <a href={`#/exercise/${moved.to}`}>
              <strong>{ix.exercise.get(moved.to)?.name}</strong>
            </a>
            .
          </span>
          <button type="button" className="btn btn-sm" onClick={undo}>
            Undo
          </button>
        </div>
      )}

      {!selecting ? (
        <Feed filter={(l) => l.exercise_id === id} />
      ) : (
        <>
          <div className="inline select-bar">
            <span className="grow muted small">{selected.size ? `${selected.size} selected` : 'Tap entries to select'}</span>
            <button
              type="button"
              className="link-btn small"
              onClick={() => setSelected(selected.size === logs.length ? new Set() : new Set(logs.map((l) => l.id)))}
            >
              {selected.size === logs.length ? 'Select none' : 'Select all'}
            </button>
          </div>
          <div className="card">
            <div className="list">
              {logs.map((l) => {
                const sets = ix.setsOfLog.get(l.id) ?? []
                const on = selected.has(l.id)
                return (
                  <label key={l.id} className={`row select-row${on ? ' on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(l.id)} />
                    <span className="row-main">
                      <span className="row-title">{longDate(ix.logDate(l))}</span>
                      <span className="sets-inline">{sets.length ? fmtSets(sets, displayUnit) : 'No sets'}</span>
                    </span>
                    <Stars value={l.rating} />
                  </label>
                )
              })}
            </div>
          </div>
          <div className="bottom-action">
            <button type="button" className="btn btn-primary btn-block btn-big" disabled={!selected.size} onClick={() => setPicking(true)}>
              {selected.size ? `Move ${selected.size} to…` : 'Select entries to move'}
            </button>
          </div>
        </>
      )}

      {picking && (
        <div className="sheet-backdrop" onClick={() => setPicking(false)}>
          <div className="sheet sheet-tall" role="dialog" aria-modal="true" aria-label="Move to exercise" onClick={(e) => e.stopPropagation()}>
            <h3>
              Move {selected.size} entr{selected.size === 1 ? 'y' : 'ies'} to…
            </h3>
            <SearchSelect startOpen options={options} placeholder="Choose an exercise" onPick={moveTo} onClose={() => setPicking(false)} />
          </div>
        </div>
      )}
    </section>
  )
}

// Full screen for editing an exercise (name, muscles, machine notes, default unit).
export function EditExercise({ id }: { id: string }) {
  const ix = useIndex()
  const ex = ix.exercise.get(id)
  const back = `#/exercise/${id}`
  if (!ex) return <p className="empty">Exercise not found.</p>
  return (
    <div className="page">
      <PageHeader back={back} title={<h1>Edit exercise</h1>} />
      <ExerciseForm exercise={ex} onDone={() => window.location.replace(back)} onCancel={() => window.location.replace(back)} />
    </div>
  )
}
