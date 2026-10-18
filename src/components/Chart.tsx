import { useState } from 'react'
import { shortDate } from '../lib/dates'

export type Point = { date: string; value: number }

const W = 340
const H = 150
const PAD = { top: 10, right: 8, bottom: 22, left: 36 }

// Small single-series chart (line or bars) in inline SVG. Tap or drag to read a point;
// the readout above the plot shows the latest point until then.
export function Chart({
  points,
  kind,
  format,
  label,
}: {
  points: Point[]
  kind: 'line' | 'bar'
  format: (v: number) => string
  label: string
}) {
  const [active, setActive] = useState<number | null>(null)
  if (points.length === 0) return <p className="hint">Not enough data yet.</p>

  const values = points.map((p) => p.value)
  const max = Math.max(...values)
  const min = kind === 'bar' ? 0 : Math.min(...values)
  const lo = kind === 'bar' ? 0 : min - (max - min || max || 1) * 0.1
  const hi = max + (max - lo || 1) * 0.08
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const n = points.length
  const slot = plotW / n
  const x = (i: number) => (kind === 'bar' ? PAD.left + slot * (i + 0.5) : PAD.left + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1)))
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH
  const baseY = PAD.top + plotH
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => (kind === 'bar' && v === lo ? 0 : v))

  const shown = active ?? n - 1
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    setActive(best)
  }

  const barW = Math.max(2, Math.min(18, slot - 2))
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('')

  return (
    <figure className="chart">
      <figcaption className="chart-readout">
        <span className="muted">{label}</span>
        <span>
          <strong>{format(points[shown].value)}</strong> <span className="muted">· {shortDate(points[shown].date)}</span>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}: ${points.length} points, latest ${format(points[n - 1].value)}`}
        onPointerDown={pick}
        onPointerMove={(e) => e.buttons && pick(e)}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="chart-axis" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {Math.abs(t) >= 10 ? Math.round(t).toLocaleString() : Math.round(t * 10) / 10}
            </text>
          </g>
        ))}
        <text className="chart-axis" x={x(0)} y={H - 4} textAnchor={kind === 'bar' || n === 1 ? 'middle' : 'start'}>
          {shortDate(points[0].date)}
        </text>
        {n > 1 && (
          <text className="chart-axis" x={x(n - 1)} y={H - 4} textAnchor={kind === 'bar' ? 'middle' : 'end'}>
            {shortDate(points[n - 1].date)}
          </text>
        )}
        <line className="chart-cross" x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={baseY} />
        {kind === 'line' ? (
          <>
            <path className="chart-line" d={path} />
            {points.map((p, i) => (
              <circle key={i} className={`chart-dot${i === shown ? ' active' : ''}`} cx={x(i)} cy={y(p.value)} r={i === shown ? 4.5 : 2.5} />
            ))}
          </>
        ) : (
          points.map((p, i) => {
            const h = Math.max(1, baseY - y(p.value))
            return (
              <rect
                key={i}
                className={`chart-bar${i === shown ? ' active' : ''}`}
                x={x(i) - barW / 2}
                y={baseY - h}
                width={barW}
                height={h}
                rx={Math.min(3, barW / 2)}
              />
            )
          })
        )}
      </svg>
    </figure>
  )
}
