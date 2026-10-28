import { useState, type CSSProperties } from 'react'
import { PageHeader } from '../components/Bits'
import { SearchSelect } from '../components/SearchSelect'
import { mergeExercises } from '../lib/actions'
import { byName, useIndex } from '../lib/derive'
import { shortDate } from '../lib/dates'
import { getData } from '../lib/store'

// Merge two exercises that are really the same thing (e.g. a machine logged under two names).
// Everything from "Merge" moves into "Into"; the first one is hidden, not deleted.
export function MergeExercises({ from }: { from?: string }) {
  const ix = useIndex()
  const [sourceId, setSourceId] = useState<string | null>(from && ix.exercise.has(from) ? from : null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [name, setName] = useState('')

  const all = getData()!.logs // deleted days included: they move too
  const count = (id: string) => all.filter((l) => l.exercise_id === id).length
  const options = (exclude: string | null) =>
    ix.data.exercises
      .filter((e) => e.id !== exclude)
      .sort(byName)
      .map((e) => {
        const m = e.primary_muscle_id ? ix.muscle.get(e.primary_muscle_id) : undefined
        const last = ix.logsOfExercise.get(e.id)?.[0]
        const n = ix.logsOfExercise.get(e.id)?.length ?? 0
        const sub = [e.archived ? 'hidden' : '', n ? `${n}×` : '', last ? shortDate(ix.logDate(last)) : ''].filter(Boolean).join(' · ')
        return { id: e.id, label: e.name, color: m?.color, sub }
      })

  const source = sourceId ? ix.exercise.get(sourceId) : undefined
  const target = targetId ? ix.exercise.get(targetId) : undefined
  const pickTarget = (id: string) => {
    setTargetId(id)
    setName(ix.exercise.get(id)?.name ?? '')
  }
  const swap = () => {
    setSourceId(targetId)
    setTargetId(sourceId)
    if (source) setName(source.name)
  }

  let preview: { moving: number; total: number; first?: string; last?: string; both: number } | null = null
  if (source && target) {
    const dates = (id: string) => new Set((ix.logsOfExercise.get(id) ?? []).map((l) => ix.logDate(l)))
    const a = dates(source.id)
    const b = dates(target.id)
    const merged = [...new Set([...a, ...b])].sort()
    preview = {
      moving: count(source.id),
      total: count(source.id) + count(target.id),
      first: merged[0],
      last: merged[merged.length - 1],
      both: [...a].filter((d) => b.has(d)).length,
    }
  }

  const merge = () => {
    if (!source || !target || !preview) return
    const finalName = name.trim() || target.name
    if (!confirm(`Merge "${source.name}" into "${finalName}"? ${preview.moving} entr${preview.moving === 1 ? 'y moves' : 'ies move'} over and "${source.name}" is hidden. You can undo right after.`)) return
    mergeExercises(source.id, target.id, finalName)
    window.location.replace(`#/exercise/${target.id}`)
  }

  return (
    <div className="page">
      <PageHeader back="history" title={<h1>Merge exercises</h1>} />
      <p className="hint">For one exercise logged under two names. Its whole history moves into the other, and the leftover is hidden (not deleted).</p>
      <section className="section card card-pad">
        <div className="field">
          <span>Merge this</span>
          <SearchSelect options={options(targetId)} value={sourceId} placeholder="Choose an exercise" onPick={setSourceId} />
        </div>
        <div className="merge-swap">
          <button type="button" className="btn btn-sm" onClick={swap} disabled={!source || !target}>
            ⇅ Swap
          </button>
        </div>
        <div className="field">
          <span>Into</span>
          <SearchSelect options={options(sourceId)} value={targetId} placeholder="Choose the one to keep" onPick={pickTarget} />
        </div>
        {source && target && (
          <div className="field">
            <span>Name after merge</span>
            <input className="input" aria-label="Name after merge" value={name} onChange={(e) => setName(e.target.value)} placeholder={target.name} />
            <div className="chips">
              {[target.name, source.name].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`chip${name.trim() === n ? ' on' : ''}`}
                  style={{ '--tag-color': 'var(--accent)' } as CSSProperties}
                  onClick={() => setName(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {source && target && preview && (
        <section className="section card card-pad merge-preview">
          <p>
            <strong>{preview.moving}</strong> entr{preview.moving === 1 ? 'y' : 'ies'} move from <strong>{source.name}</strong> to{' '}
            <strong>{name.trim() || target.name}</strong>, which will have <strong>{preview.total}</strong> in total
            {preview.first && preview.last ? ` (${shortDate(preview.first)} – ${shortDate(preview.last)})` : ''}.
          </p>
          {preview.both > 0 && (
            <p className="muted">
              {preview.both} day{preview.both === 1 ? ' has' : 's have'} both, so {preview.both === 1 ? 'it' : 'they'} will show two entries of it.
            </p>
          )}
          {source.notes?.trim() && <p className="muted">Machine notes from {source.name} are added to the kept exercise.</p>}
          <button type="button" className="btn btn-primary btn-block btn-big" onClick={merge}>
            Merge
          </button>
        </section>
      )}
    </div>
  )
}
