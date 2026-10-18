import { useLayoutEffect, useRef, useState } from 'react'
import { addDays, parseDate, shortDate, today, weekStart } from '../lib/dates'

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

// How many week-columns fit: the width divided by the target square size from theme.css.
function useFittedWeeks() {
  const ref = useRef<HTMLDivElement>(null)
  const [weeks, setWeeks] = useState(17)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const css = getComputedStyle(el)
      const px = (name: string) => parseFloat(css.getPropertyValue(name)) || 0
      const cell = px('--heat-cell-target') || 16
      const gap = px('--heat-gap')
      const label = px('--heat-label')
      setWeeks(Math.max(4, Math.floor((el.clientWidth - label) / (cell + gap))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, weeks }
}

// GitHub-style contribution calendar: one column per week (Mon at the top), one small square
// per day, greener = more sets. Shows as many weeks as fill the width, ending this week.
export function Heatmap({
  values,
  onTap,
  unit = 'set',
}: {
  values: Map<string, number>
  onTap?: (date: string) => void
  unit?: string
}) {
  const { ref, weeks } = useFittedWeeks()
  const end = today()
  const first = addDays(weekStart(end), -7 * (weeks - 1))
  const cells: (string | null)[] = []
  for (let i = 0; i < weeks * 7; i++) cells.push(addDays(first, i))
  let max = 0
  for (const d of cells) if (d) max = Math.max(max, values.get(d) ?? 0)
  const level = (v: number) => (v <= 0 || !max ? 0 : Math.max(1, Math.ceil((4 * v) / max)))

  // Month name above the first week that starts in that month (and above week 1).
  const months = Array.from({ length: weeks }, (_, w) => {
    const day = cells.slice(w * 7, w * 7 + 7).find(Boolean)
    if (!day) return ''
    const prevDay = w ? cells.slice((w - 1) * 7, w * 7).find(Boolean) : null
    const m = parseDate(day).getMonth()
    return !prevDay || parseDate(prevDay).getMonth() !== m ? parseDate(day).toLocaleDateString(undefined, { month: 'short' }) : ''
  })

  // weeks share the full width; squares stay square via aspect-ratio
  const cols = { gridTemplateColumns: `var(--heat-label) repeat(${weeks}, minmax(0, 1fr))` }
  const label = (d: string) => `${shortDate(d)}: ${values.get(d) ?? 0} ${unit}${values.get(d) === 1 ? '' : 's'}`

  return (
    <div className="heatmap-wrap" ref={ref}>
      <div className="heatmap heatmap-months" style={cols} aria-hidden>
        <span />
        {months.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
      <div className="heatmap" style={cols}>
        {DAY_LABELS.map((l, i) => (
          <span key={`l${i}`} className="heatmap-day" style={{ gridColumn: 1, gridRow: i + 1 }} aria-hidden>
            {l}
          </span>
        ))}
        {cells.map((d, i) => {
          const pos = { gridColumn: Math.floor(i / 7) + 2, gridRow: (i % 7) + 1 }
          if (!d || d > end) return <span key={`p${i}`} className="cell pad" style={pos} />
          return (
            <button
              key={d}
              type="button"
              className={`cell l${level(values.get(d) ?? 0)}${d === end ? ' today' : ''}`}
              style={pos}
              aria-label={label(d)}
              title={label(d)}
              disabled={!onTap}
              onClick={() => onTap?.(d)}
            />
          )
        })}
      </div>
      <div className="heatmap-legend" aria-hidden>
        <span className="grow">Since {shortDate(first)}</span>
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`cell l${l}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
