import { addDays, parseDate, shortDate, today, weekStart } from '../lib/dates'

// GitHub-style activity squares. `weeks-as-rows` reads like a calendar (Mon–Sun across),
// `weeks-as-columns` is the classic contribution strip. Darker = more sets.
export function Heatmap({
  days,
  values,
  onTap,
  layout = 'weeks-as-columns',
  unit = 'set',
}: {
  days: number
  values: Map<string, number>
  onTap?: (date: string) => void
  layout?: 'weeks-as-rows' | 'weeks-as-columns'
  unit?: string
}) {
  const end = today()
  const start = addDays(end, -(days - 1))
  const first = weekStart(start)
  const cells: (string | null)[] = []
  for (let d = first; d <= end; d = addDays(d, 1)) cells.push(d < start ? null : d)
  const weeks = Math.ceil(cells.length / 7)
  let max = 0
  for (const d of cells) if (d) max = Math.max(max, values.get(d) ?? 0)
  const level = (v: number) => (v <= 0 || !max ? 0 : Math.max(1, Math.ceil((4 * v) / max)))

  const rows = layout === 'weeks-as-rows'
  const style = rows
    ? { gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }
    : { gridTemplateRows: 'repeat(7, auto)', gridTemplateColumns: `repeat(${weeks}, minmax(0, var(--cell-max)))` }

  return (
    <div className="heatmap-wrap">
      {rows && (
        <div className="heatmap heatmap-head" style={style} aria-hidden>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
      )}
      <div className={`heatmap ${rows ? 'rows' : 'columns'}`} style={style}>
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              className={`cell l${level(values.get(d) ?? 0)}${d === end ? ' today' : ''}`}
              aria-label={`${shortDate(d)}: ${values.get(d) ?? 0} ${unit}s`}
              title={`${shortDate(d)}: ${values.get(d) ?? 0} ${unit}s`}
              disabled={!onTap}
              onClick={() => onTap?.(d)}
            >
              {rows && <span>{parseDate(d).getDate()}</span>}
            </button>
          ) : (
            <span key={`pad${i}`} className="cell pad" />
          ),
        )}
      </div>
      <div className="heatmap-legend" aria-hidden>
        <span>{shortDate(start)}</span>
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
