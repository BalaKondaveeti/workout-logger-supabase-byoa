import { useLayoutEffect, useRef, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { useIndex } from '../lib/derive'
import type { Muscle } from '../lib/types'
import { BackIcon } from './Icons'

// Pinned page header. `back` is a hash to go to (or history back when 'history').
export function PageHeader({
  title,
  back,
  onBack,
  right,
  children,
}: {
  title: ReactNode
  back?: string
  onBack?: () => void // custom back (the link still has `back` as its href)
  right?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="sticky-head">
      <div className="page-head">
        {back && (
          <a
            className="back"
            href={back === 'history' ? '#/' : back}
            aria-label="Back"
            onClick={(e) => {
              if (onBack) {
                e.preventDefault()
                onBack()
                return
              }
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

export function MuscleTag({ muscle, onClick }: { muscle: Muscle; onClick?: () => void }) {
  const style = { '--tag-color': muscle.color } as React.CSSProperties
  const cls = 'tag'
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

// The exercise's muscle as a tag.
export function MuscleTags({ exerciseId }: { exerciseId: string }) {
  const ix = useIndex()
  const ex = ix.exercise.get(exerciseId)
  const primary = ex?.primary_muscle_id ? ix.muscle.get(ex.primary_muscle_id) : undefined
  if (!primary) return null
  return (
    <div className="tags">
      <MuscleTag muscle={primary} />
    </div>
  )
}

export function Stat({
  label,
  value,
  sub,
  highlight,
  tone,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  highlight?: boolean
  tone?: 'warn' | 'alert'
}) {
  return (
    <div className={`stat${highlight ? ' highlight' : ''}${tone ? ` tone-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

// A textarea that grows to show its whole text (no inner scrolling), at least `rows` tall.
export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`
  }
  useLayoutEffect(fit, [props.value])
  useLayoutEffect(() => {
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return <textarea {...props} ref={ref} className={`${props.className ?? ''} auto-grow`} />
}
