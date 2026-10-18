import { useState } from 'react'
import { MuscleTags, PageHeader, Stat } from '../components/Bits'
import { Chart } from '../components/Chart'
import { ExerciseForm } from '../components/ExerciseForm'
import { Feed } from '../components/Feed'
import { Heatmap } from '../components/Heatmap'
import { useIndex } from '../lib/derive'
import { relativeDay, shortDate } from '../lib/dates'
import { usePrefs } from '../lib/prefs'
import { exerciseStats, setsPerDate } from '../lib/stats'
import { updateRow } from '../lib/store'
import { convert, num } from '../lib/units'

export function ExerciseDetail({ id }: { id: string }) {
  const ix = useIndex()
  const { displayUnit } = usePrefs()
  const [editing, setEditing] = useState(false)
  const ex = ix.exercise.get(id)
  if (!ex) return <p className="empty">Exercise not found.</p>

  const unit = displayUnit === 'logged' ? ex.default_unit : displayUnit
  const w = (kg: number) => `${num(convert(kg, 'kg', unit))} ${unit}`
  const st = exerciseStats(ix, id)
  const logs = ix.logsOfExercise.get(id) ?? []

  return (
    <div className="page">
      <PageHeader
        back="history"
        title={
          <input
            className="title-input"
            aria-label="Exercise name"
            value={ex.name}
            onChange={(e) => updateRow('exercises', id, { name: e.target.value })}
            onBlur={(e) => !e.target.value.trim() && updateRow('exercises', id, { name: 'Untitled exercise' })}
          />
        }
        right={
          <button className="btn btn-sm" onClick={() => setEditing(!editing)}>
            {editing ? 'Close' : 'Edit'}
          </button>
        }
      />
      {editing ? (
        <ExerciseForm exercise={ex} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      ) : (
        <section className="section">
          {ex.archived && <p className="hint">Hidden from pickers. Unhide it under Menu → Exercises.</p>}
          <MuscleTags exerciseId={id} />
          <label className="field">
            <span>Machine notes</span>
            <textarea
              className="input"
              rows={2}
              placeholder="Seat height, pin position, cues…"
              value={ex.notes ?? ''}
              onChange={(e) => updateRow('exercises', id, { notes: e.target.value || null })}
            />
          </label>
        </section>
      )}

      <section className="section">
        <h2>Activity</h2>
        <Heatmap values={setsPerDate(ix, logs)} onTap={(d) => (window.location.hash = `#/log/${d}`)} />
      </section>

      <section className="stats">
        <Stat label="Last performed" value={st.last ? shortDate(st.last) : '—'} sub={st.last ? relativeDay(st.last) : undefined} />
        <Stat label="Sessions" value={st.sessions.length} />
        <Stat label="Best weight" value={st.pr ? w(st.pr.kg) : '—'} sub={st.pr ? shortDate(st.pr.date) : undefined} />
        <Stat label="Avg rating" value={st.avgRating ? `${st.avgRating.toFixed(1)} ★` : '—'} />
        <Stat label="Est. 1RM best" value={st.best1rm ? w(st.best1rm.kg) : '—'} sub={st.best1rm ? shortDate(st.best1rm.date) : undefined} />
        <Stat label="Est. 1RM latest" value={st.latest1rm ? w(st.latest1rm.kg) : '—'} sub={st.latest1rm ? shortDate(st.latest1rm.date) : undefined} />
      </section>
      <p className="hint">Estimated 1RM uses Epley: weight × (1 + reps / 30).</p>

      {st.sessions.length > 0 && (
        <section className="section">
          <Chart
            kind="line"
            label="Top weight per session"
            points={st.sessions.filter((s) => s.maxKg > 0).map((s) => ({ date: s.date, value: convert(s.maxKg, 'kg', unit) }))}
            format={(v) => `${num(v)} ${unit}`}
          />
          <Chart
            kind="bar"
            label="Volume per session"
            points={st.sessions.slice(-30).map((s) => ({ date: s.date, value: convert(s.volumeKg, 'kg', unit) }))}
            format={(v) => `${Math.round(v).toLocaleString()} ${unit}`}
          />
          <p className="hint">Volume = weight × reps, doubled for each-arm sets. Last 30 sessions.</p>
        </section>
      )}

      <section className="section">
        <h2>History</h2>
        <Feed filter={(l) => l.exercise_id === id} />
      </section>
    </div>
  )
}
