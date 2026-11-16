import { useState } from 'react'
import { PageHeader } from '../components/Bits'
import { addDays, durationMinutes, hhmm, longDate, prettyDuration, prettySeconds, prettyTime, timeOf, today } from '../lib/dates'
import { useIndex, type Index } from '../lib/derive'
import { setTiming } from '../lib/stats'
import type { Day, GymSet, Log } from '../lib/types'
import { fmtSet } from '../lib/units'

// Export a date range as CSV (one row per set) or as plain text to paste into an AI chat.

type Entry = { log: Log; sets: GymSet[] }
type DayRow = { day: Day; entries: Entry[] }

function collect(ix: Index, from: string, to: string): DayRow[] {
  return ix.data.days
    .filter((d) => d.date >= from && d.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      day,
      entries: (ix.logsOfDay.get(day.id) ?? []).map((log) => ({ log, sets: ix.setsOfLog.get(log.id) ?? [] })),
    }))
}

const weightOf = (s: GymSet) => (s.weight === null ? '' : String(s.weight))
const oneLine = (t: string | null | undefined) => (t ?? '').trim().replace(/\s*\n\s*/g, ' / ')

function csvCell(v: string | number | boolean | null | undefined) {
  const t = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

export function buildCsv(ix: Index, rows: DayRow[]) {
  const head = [
    'date', 'weekday', 'split', 'check_in', 'check_out', 'pre_workout', 'day_rating', 'day_notes',
    'exercise_order', 'exercise', 'muscle', 'exercise_rating', 'exercise_notes', 'machine_notes',
    'set', 'weight', 'unit', 'reps', 'each_arm', 'side', 'set_note', 'set_time',
  ]
  const out = [head.join(',')]
  for (const { day, entries } of rows) {
    const split = day.type_id ? (ix.dayType.get(day.type_id)?.name ?? '') : ''
    const dayCols = [
      day.date,
      new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
      split,
      hhmm(day.check_in),
      hhmm(day.check_out),
      day.pre_workout ? 'yes' : '',
      day.rating ?? '',
      day.notes ?? '',
    ]
    if (!entries.length) out.push([...dayCols, ...Array(head.length - dayCols.length).fill('')].map(csvCell).join(','))
    entries.forEach(({ log, sets }, i) => {
      const ex = ix.exercise.get(log.exercise_id)
      const m = ex?.primary_muscle_id ? ix.muscle.get(ex.primary_muscle_id)?.name : ''
      const exCols = [i + 1, ex?.name ?? 'Unknown', m ?? '', log.rating ?? '', log.notes ?? '', ex?.notes ?? '']
      const setRows = sets.length ? sets : [null]
      setRows.forEach((s, j) => {
        const setCols = s
          ? [j + 1, weightOf(s), s.unit, s.reps ?? '', s.per_arm ? 'yes' : '', s.side ?? '', s.note ?? '', s.done_at ? timeOf(s.done_at) : '']
          : ['', '', '', '', '', '', '', '']
        out.push([...dayCols, ...exCols, ...setCols].map(csvCell).join(','))
      })
    })
  }
  return out.join('\r\n') + '\r\n'
}

export function buildText(ix: Index, rows: DayRow[], from: string, to: string) {
  const lines: string[] = []
  lines.push(`Gym log, ${longDate(from)} to ${longDate(to)}: ${rows.length} gym day${rows.length === 1 ? '' : 's'}.`)
  lines.push('Weights as logged (kg or lb). "each arm" = weight per arm. L/R = one-arm set. Ratings out of 5.')

  const used = new Set<string>()
  for (const { day, entries } of rows) {
    lines.push('')
    const head = [longDate(day.date)]
    if (day.type_id) head.push(ix.dayType.get(day.type_id)?.name ?? '')
    if (day.check_in || day.check_out) {
      const dur = durationMinutes(day.check_in, day.check_out)
      head.push(`${prettyTime(day.check_in) || '?'}–${prettyTime(day.check_out) || '?'}${dur !== null ? ` (${prettyDuration(dur)})` : ''}`)
    }
    if (day.pre_workout) head.push('pre-workout')
    if (day.rating) head.push(`day rating ${day.rating}/5`)
    lines.push(`## ${head.filter(Boolean).join(' · ')}`)
    if (day.notes?.trim()) lines.push(`Day notes: ${oneLine(day.notes)}`)
    if (!entries.length) lines.push('(no exercises logged)')
    entries.forEach(({ log, sets }, i) => {
      const ex = ix.exercise.get(log.exercise_id)
      if (ex) used.add(ex.id)
      const m = ex?.primary_muscle_id ? ix.muscle.get(ex.primary_muscle_id)?.name : null
      const bits = [`${i + 1}. ${ex?.name ?? 'Unknown exercise'}${m ? ` (${m})` : ''}`]
      if (log.rating) bits.push(`rating ${log.rating}/5`)
      lines.push(bits.join(' · '))
      const t = setTiming(sets)
      lines.push(
        `   Sets: ${sets.length ? sets.map((s) => fmtSet(s, 'logged')).join(', ') : 'none'}${
          t ? ` · ${prettySeconds(t.durationSec)} total, ${prettySeconds(t.avgRestSec)} avg rest` : ''
        }`,
      )
      if (log.notes?.trim()) lines.push(`   Notes: ${oneLine(log.notes)}`)
      sets.forEach((s, j) => {
        if (s.note?.trim()) lines.push(`   Set ${j + 1} (${fmtSet(s, 'logged')}) note: ${oneLine(s.note)}`)
      })
    })
  }

  const machine = [...used].map((id) => ix.exercise.get(id)!).filter((e) => e.notes?.trim())
  if (machine.length) {
    lines.push('', '## Machine notes (setup per exercise)')
    machine.sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => lines.push(`- ${e.name}: ${oneLine(e.notes)}`))
  }
  return lines.join('\n') + '\n'
}

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const PRESETS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: 0 },
]

export function Export() {
  const ix = useIndex()
  const now = today()
  const first = [...ix.dates].sort()[0] ?? now
  const [from, setFrom] = useState(addDays(now, -29))
  const [to, setTo] = useState(now)
  const [copied, setCopied] = useState('')

  const lo = from <= to ? from : to
  const hi = from <= to ? to : from
  const rows = collect(ix, lo, hi)
  const entries = rows.reduce((n, r) => n + r.entries.length, 0)
  const sets = rows.reduce((n, r) => n + r.entries.reduce((m, e) => m + e.sets.length, 0), 0)
  const text = rows.length ? buildText(ix, rows, lo, hi) : ''
  const fileBase = `gym-log_${lo}_to_${hi}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('Copied — paste it into your AI chat.')
    } catch {
      setCopied('Couldn’t copy automatically. Select the text below and copy it.')
    }
    window.setTimeout(() => setCopied(''), 4000)
  }

  return (
    <div className="page">
      <PageHeader back="#/menu" title={<h1>Export data</h1>} />
      <section className="section card card-pad">
        <div className="segmented" role="radiogroup" aria-label="Quick range">
          {PRESETS.map((p) => {
            const f = p.days ? addDays(now, -(p.days - 1)) : first
            return (
              <button key={p.label} role="radio" aria-checked={from === f && to === now} onClick={() => (setFrom(f), setTo(now))}>
                {p.label}
              </button>
            )
          })}
        </div>
        <div className="grid-2">
          <label className="field">
            <span>From</span>
            <input className="input" type="date" value={from} max={now} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>To</span>
            <input className="input" type="date" value={to} max={now} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>
        <p className="hint">
          {rows.length
            ? `${rows.length} gym day${rows.length === 1 ? '' : 's'} · ${entries} exercise entr${entries === 1 ? 'y' : 'ies'} · ${sets} set${sets === 1 ? '' : 's'}`
            : 'No gym days in this range.'}
        </p>
      </section>

      <section className="section card card-pad export-block">
        <h2>Text for AI</h2>
        <p className="hint">Day by day with splits, times, ratings, every note (day, exercise, set) and your machine notes.</p>
        <button type="button" className="btn btn-primary btn-block btn-big" disabled={!text} onClick={copy}>
          Copy text
        </button>
        {copied && <p className="hint export-copied">{copied}</p>}
        <button type="button" className="btn btn-block" disabled={!text} onClick={() => download(`${fileBase}.txt`, text, 'text/plain;charset=utf-8')}>
          Download .txt
        </button>
        {text && <textarea className="input export-preview" readOnly value={text} aria-label="Export preview" rows={10} />}
      </section>

      <section className="section card card-pad export-block">
        <h2>Spreadsheet (CSV)</h2>
        <p className="hint">One row per set with date, split, times, exercise, muscle, weight, unit, reps, each arm, side, set time and all notes. Opens in Excel, Numbers or Google Sheets.</p>
        <button
          type="button"
          className="btn btn-block btn-big"
          disabled={!rows.length}
          onClick={() => download(`${fileBase}.csv`, '﻿' + buildCsv(ix, rows), 'text/csv;charset=utf-8')}
        >
          Download CSV
        </button>
      </section>
    </div>
  )
}
