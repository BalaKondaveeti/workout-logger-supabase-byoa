import { addDays, parseDate, shortDate, today, weekStart } from '../lib/dates'

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

// GitHub-style contribution calendar: one column per week (Mon at the top), one square per
// day, greener = more sets. No numbers, just the squares.
export function Heatmap({
  days,
  values,
  onTap,
  unit = 'set',
  size = 'md',
}: {
  days: number
  values: Map<string, number>
  onTap?: (date: string) => void
  unit?: string
  size?: 'md' | 'lg'
}) {
  const end = today()
  const start = addDays(end, -(days - 1))
  const first = weekStart(start)
  const cells: (string | null)[] = []
  for (let d = first; d <= end; d = addDays(d, 1)) cells.push(d < start ? null : d)
  while (cells.length % 7) cells.push(null) // rest of the current week
  const weeks = cells.length / 7
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

  const cols = { gridTemplateColumns: `var(--heat-label) repeat(${weeks}, var(--heat-cell))` }
  const label = (d: string) => `${shortDate(d)}: ${values.get(d) ?? 0} ${unit}${values.get(d) === 1 ? '' : 's'}`

  return (
    <div className={`heatmap-wrap heat-${size}`}>
      <div className="heatmap heatmap-months" style={cols} aria-hidden>
        <span />
        {months.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
      <div className="heatmap" style={{ ...cols, gridTemplateRows: 'repeat(7, var(--heat-cell))' }}>
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
        <span className="grow" />
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`cell l${l}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
