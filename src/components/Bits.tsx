import type { ReactNode } from 'react'
import { useIndex } from '../lib/derive'
import type { Muscle } from '../lib/types'
import { BackIcon } from './Icons'

// Pinned page header. `back` is a hash to go to (or history back when 'history').
export function PageHeader({ title, back, right, children }: { title: ReactNode; back?: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <header className="sticky-head">
      <div className="page-head">
        {back && (
          <a
            className="back"
            href={back === 'history' ? '#/' : back}
            aria-label="Back"
            onClick={(e) => {
              if (back === 'history' && window.history.length > 1) {
                e.preventDefault()
                window.history.back()
              }
            }}
          >
            <BackIcon />
          </a>
        )}
        <div className="grow page-title">{title}</div>
        {right}
      </div>
      {children}
    </header>
  )
}

// 1–5 stars. Tapping the current value clears it.
export function Stars({ value, onChange, small }: { value: number | null; onChange?: (v: number | null) => void; small?: boolean }) {
  if (!onChange) {
    if (!value) return null
    return (
      <span className="stars-static" aria-label={`${value} of 5`}>
        {'★'.repeat(value)}
        <span className="star-off">{'★'.repeat(5 - value)}</span>
      </span>
    )
  }
  return (
    <div className={`stars${small ? ' small' : ''}`} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={value && n <= value ? 'on' : ''}
          onClick={() => onChange(value === n ? null : n)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function MuscleTag({ muscle, secondary, onClick }: { muscle: Muscle; secondary?: boolean; onClick?: () => void }) {
  const style = { '--tag-color': muscle.color } as React.CSSProperties
  const cls = `tag${secondary ? ' secondary' : ''}`
  if (onClick) {
    return (
      <button type="button" className={cls} style={style} onClick={onClick}>
        {muscle.name}
      </button>
    )
  }
  return (
    <a className={cls} style={style} href={`#/muscle/${muscle.id}`}>
      {muscle.name}
    </a>
  )
}

// Primary muscle first, then secondary ones (lighter).
export function MuscleTags({ exerciseId }: { exerciseId: string }) {
  const ix = useIndex()
  const ex = ix.exercise.get(exerciseId)
  if (!ex) return null
  const primary = ex.primary_muscle_id ? ix.muscle.get(ex.primary_muscle_id) : undefined
  const secondary = (ix.secondaryOf.get(exerciseId) ?? []).map((id) => ix.muscle.get(id)).filter((m): m is Muscle => !!m)
  if (!primary && !secondary.length) return null
  return (
    <div className="tags">
      {primary && <MuscleTag muscle={primary} />}
      {secondary.map((m) => (
        <MuscleTag key={m.id} muscle={m} secondary />
      ))}
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}
