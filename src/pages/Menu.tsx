import { useState } from 'react'
import { PageHeader } from '../components/Bits'
import { ExerciseForm } from '../components/ExerciseForm'
import { DateBadge, DayMeta, dayTimes, weekday } from '../components/Feed'
import { RightIcon } from '../components/Icons'
import { createMuscle, deleteDayForever, nextMuscleColor, restoreDay } from '../lib/actions'
import { loadConfig } from '../lib/config'
import { byName, useIndex, type TrashedDay } from '../lib/derive'
import { longDate, relativeDay, toISODate } from '../lib/dates'
import { setPref, usePrefs, type DisplayUnit } from '../lib/prefs'
import { updateRow, upsertRow, uuid } from '../lib/store'
import { fmtSets, LB_PER_KG, num } from '../lib/units'

type Props = { path: string; email?: string; onSignOut: () => void; onChangeProject: () => void }

export function Menu({ path, email, onSignOut, onChangeProject }: Props) {
  if (path === 'exercises') return <Exercises />
  if (path === 'muscles') return <Muscles />
  if (path === 'notes') return <Notes />
  if (path === 'units') return <Units />
  if (path === 'deleted') return <RecentlyDeleted />
  if (path === 'connection') return <Connection onChangeProject={onChangeProject} />
  return <MenuHome email={email} onSignOut={onSignOut} />
}

function Item({ href, label, detail }: { href: string; label: string; detail?: string }) {
  return (
    <a className="menu-item" href={href}>
      <span className="grow">{label}</span>
      {detail && <span className="menu-detail">{detail}</span>}
      <RightIcon />
    </a>
  )
}

function MenuHome({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  const ix = useIndex()
  const { displayUnit } = usePrefs()
  const host = (() => {
    try {
      return new URL(loadConfig().url).hostname.split('.')[0]
    } catch {
      return ''
    }
  })()
  return (
    <div className="page">
      <PageHeader title={<h1 className="large-title">Menu</h1>} />
      <section className="section">
        <h2>Lists</h2>
        <div className="menu-group">
          <Item href="#/menu/exercises" label="Exercises" detail={String(ix.data.exercises.filter((e) => !e.archived).length)} />
          <Item href="#/menu/muscles" label="Muscles" detail={String(ix.data.muscles.filter((m) => !m.archived).length)} />
        </div>
      </section>
      <section className="section">
        <h2>Notes</h2>
        <div className="menu-group">
          <Item href="#/menu/notes" label="General gym notes" />
        </div>
      </section>
      <section className="section">
        <h2>Units</h2>
        <div className="menu-group">
          <Item href="#/menu/units" label="Units & converter" detail={displayUnit === 'logged' ? 'As logged' : displayUnit} />
        </div>
      </section>
      <section className="section">
        <h2>Deleted</h2>
        <div className="menu-group">
          <Item href="#/menu/deleted" label="Recently deleted" detail={ix.trash.length ? String(ix.trash.length) : undefined} />
        </div>
      </section>
      <section className="section">
        <h2>Account</h2>
        <div className="menu-group">
          <Item href="#/menu/connection" label="Supabase connection" detail={host} />
          <button className="menu-item danger" onClick={() => confirm('Sign out?') && onSignOut()}>
            <span className="grow">Sign out</span>
            <span className="menu-detail">{email}</span>
          </button>
        </div>
      </section>
    </div>
  )
}

// Deleted days wait here until restored or deleted permanently (by hand only).
function RecentlyDeleted() {
  const ix = useIndex()
  return (
    <div className="page">
      <PageHeader back="#/menu" title={<h1>Recently deleted</h1>} />
      <p className="hint">Deleted gym days stay here until you restore them or delete them permanently.</p>
      {ix.trash.length === 0 ? (
        <p className="empty">Nothing deleted.</p>
      ) : (
        <div className="feed">
          {ix.trash.map((t) => (
            <TrashCard key={t.day.id} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function TrashCard({ t }: { t: TrashedDay }) {
  const ix = useIndex()
  const { displayUnit } = usePrefs()
  const { day, logs, sets } = t
  const merges = ix.dayByDate.has(day.date)
  const restore = () => {
    if (merges && !confirm(`${longDate(day.date)} already has a session. Add these ${logs.length} exercises to it?`)) return
    restoreDay(day.id)
  }
  const forever = () => {
    if (!confirm(`Permanently delete ${longDate(day.date)} (${logs.length} exercise${logs.length === 1 ? '' : 's'}, ${sets} set${sets === 1 ? '' : 's'})? This can't be undone.`)) return
    deleteDayForever(day.id)
  }
  return (
    <section className="feed-day card trash-day">
      <div className="day-head">
        <DateBadge date={day.date} />
        <span className="grow day-head-main">
          <span className="day-date">{weekday(day.date)}</span>
          {dayTimes(day) && <span className="day-time">{dayTimes(day)}</span>}
        </span>
        {day.deleted_at && <span className="pill">Deleted {relativeDay(toISODate(new Date(day.deleted_at))).toLowerCase()}</span>}
      </div>
      <DayMeta day={day} exercises={logs.length} sets={sets} />
      {logs.length > 0 && (
        <div className="list">
          {logs.map((l) => {
            const ex = ix.exercise.get(l.exercise_id)
            const m = ex?.primary_muscle_id ? ix.muscle.get(ex.primary_muscle_id) : undefined
            const s = t.setsOfLog.get(l.id) ?? []
            return (
              <div key={l.id} className="row log-row">
                <span className="muscle-bar" style={{ background: m?.color }} aria-hidden />
                <div className="row-main">
                  <span className="row-title">{ex?.name ?? 'Unknown exercise'}</span>
                  {s.length > 0 && <div className="sets-inline">{fmtSets(s, displayUnit)}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="trash-actions">
        <button className="btn btn-primary" onClick={restore}>
          {merges ? 'Restore into day' : 'Restore'}
        </button>
        <button className="btn btn-danger" onClick={forever}>
          Delete permanently
        </button>
      </div>
    </section>
  )
}

function Exercises() {
  const ix = useIndex()
  const [editing, setEditing] = useState<string | null>(null) // exercise id being edited inline
  const [showHidden, setShowHidden] = useState(false)
  const list = ix.data.exercises.filter((e) => showHidden || !e.archived).sort(byName)
  const hiddenCount = ix.data.exercises.filter((e) => e.archived).length

  return (
    <div className="page">
      <PageHeader back="#/menu" title={<h1>Exercises</h1>} />
      <a className="btn btn-primary btn-block" href="#/menu/exercises/new">
        + Add exercise
      </a>
      <div className="list">
        {list.map((e) => {
          const m = e.primary_muscle_id ? ix.muscle.get(e.primary_muscle_id) : undefined
          if (editing === e.id) {
            return <ExerciseForm key={e.id} exercise={e} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
          }
          return (
            <div key={e.id} className={`manage-row${e.archived ? ' archived' : ''}`}>
              {m && <span className="dot" style={{ background: m.color }} />}
              <a className="grow manage-name" href={`#/exercise/${e.id}`}>
                {e.name}
                <span className="muted small"> {m?.name ?? ''}</span>
              </a>
              <button className="btn btn-sm" onClick={() => setEditing(e.id)}>
                Edit
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => updateRow('exercises', e.id, { archived: !e.archived }, true)}>
                {e.archived ? 'Unhide' : 'Hide'}
              </button>
            </div>
          )
        })}
      </div>
      {hiddenCount > 0 && (
        <button className="btn btn-ghost" onClick={() => setShowHidden(!showHidden)}>
          {showHidden ? 'Hide hidden' : `Show hidden (${hiddenCount})`}
        </button>
      )}
    </div>
  )
}

function Muscles() {
  const ix = useIndex()
  const [name, setName] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const list = ix.data.muscles.filter((m) => showHidden || !m.archived).sort(byName)
  const hiddenCount = ix.data.muscles.filter((m) => m.archived).length
  const add = () => {
    if (!name.trim()) return
    createMuscle(name, nextMuscleColor())
    setName('')
  }

  return (
    <div className="page">
      <PageHeader back="#/menu" title={<h1>Muscles</h1>} />
      <div className="inline">
        <input
          className="input grow"
          placeholder="New muscle"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn btn-primary" onClick={add} disabled={!name.trim()}>
          Add
        </button>
      </div>
      <div className="list">
        {list.map((m) => (
          <div key={m.id} className={`manage-row${m.archived ? ' archived' : ''}`}>
            <input
              type="color"
              className="input input-color"
              aria-label={`${m.name} color`}
              value={m.color}
              onChange={(e) => updateRow('muscles', m.id, { color: e.target.value })}
            />
            <input
              className="input grow"
              aria-label="Muscle name"
              value={m.name}
              onChange={(e) => updateRow('muscles', m.id, { name: e.target.value })}
            />
            <a className="btn btn-sm" href={`#/muscle/${m.id}`}>
              View
            </a>
            <button className="btn btn-sm btn-ghost" onClick={() => updateRow('muscles', m.id, { archived: !m.archived }, true)}>
              {m.archived ? 'Unhide' : 'Hide'}
            </button>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button className="btn btn-ghost" onClick={() => setShowHidden(!showHidden)}>
          {showHidden ? 'Hide hidden' : `Show hidden (${hiddenCount})`}
        </button>
      )}
    </div>
  )
}

function Notes() {
  const ix = useIndex()
  const note = ix.data.notes[0]
  return (
    <div className="page">
      <PageHeader back="#/menu" title={<h1>Gym notes</h1>} />
      <textarea
        className="input notepad"
        placeholder="Anything: routines, goals, machine numbers, reminders…"
        value={note?.body ?? ''}
        onChange={(e) => {
          const now = new Date().toISOString()
          if (note) updateRow('notes', note.id, { body: e.target.value, updated_at: now })
          else upsertRow('notes', { id: uuid(), body: e.target.value, updated_at: now }, 'user_id')
        }}
      />
      {note?.updated_at && <p className="hint">Saved {new Date(note.updated_at).toLocaleString()}</p>}
    </div>
  )
}

function Units() {
  const { displayUnit } = usePrefs()
  const [kg, setKg] = useState('')
  const [lb, setLb] = useState('')
  const options: { value: DisplayUnit; label: string }[] = [
    { value: 'logged', label: 'As logged' },
    { value: 'kg', label: 'kg' },
    { value: 'lb', label: 'lb' },
  ]
  return (
    <div className="page">
      <PageHeader back="#/menu" title={<h1>Units</h1>} />
      <section className="section">
        <h2>Show weights in</h2>
        <div className="segmented">
          {options.map((o) => (
            <button key={o.value} aria-checked={displayUnit === o.value} role="radio" onClick={() => setPref('displayUnit', o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="hint">Only changes how weights are displayed. Every set keeps the unit it was logged in.</p>
      </section>
      <section className="section">
        <h2>Converter</h2>
        <div className="grid-2">
          <label className="field">
            <span>kg</span>
            <input
              className="input input-big"
              inputMode="decimal"
              value={kg}
              onChange={(e) => {
                setKg(e.target.value)
                const n = Number(e.target.value.replace(',', '.'))
                setLb(e.target.value.trim() && Number.isFinite(n) ? num(n * LB_PER_KG) : '')
              }}
            />
          </label>
          <label className="field">
            <span>lb</span>
            <input
              className="input input-big"
              inputMode="decimal"
              value={lb}
              onChange={(e) => {
                setLb(e.target.value)
                const n = Number(e.target.value.replace(',', '.'))
                setKg(e.target.value.trim() && Number.isFinite(n) ? num(n / LB_PER_KG) : '')
              }}
            />
          </label>
        </div>
        <p className="hint">1 kg = {LB_PER_KG} lb</p>
      </section>
    </div>
  )
}

function Connection({ onChangeProject }: { onChangeProject: () => void }) {
  const { url, key } = loadConfig()
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const masked = key.length > 16 ? `${key.slice(0, 14)}${'•'.repeat(10)}${key.slice(-4)}` : '•'.repeat(key.length)
  return (
    <div className="page">
      <PageHeader back="#/menu" title={<h1>Supabase</h1>} />
      <section className="section">
        <div className="field">
          <span>Project URL</span>
          <div className="mono">{url}</div>
        </div>
        <div className="field">
          <span>Publishable key</span>
          <div className="mono">{show ? key : masked}</div>
          <div className="inline">
            <button className="btn btn-sm" onClick={() => setShow(!show)}>
              {show ? 'Hide' : 'Show'}
            </button>
            <button
              className="btn btn-sm"
              onClick={() =>
                navigator.clipboard?.writeText(key).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <p className="hint">The publishable key is safe to share: your data is protected by Row Level Security.</p>
        <button className="btn" onClick={onChangeProject}>
          Change Supabase project
        </button>
      </section>
    </div>
  )
}
