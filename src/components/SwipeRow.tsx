import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

const ACTION_WIDTH = 76
const OPEN_EVENT = 'gym:swipe-open'

export type SwipeAction = { label: string; icon?: ReactNode; onClick: () => void; tone?: 'delete' }

// A row that reveals action buttons when swiped left. Tapping the row calls onTap
// (or closes it if open). Only one row is open at a time.
export function SwipeRow({ actions, onTap, children }: { actions: SwipeAction[]; onTap: () => void; children: ReactNode }) {
  const id = useId()
  const width = actions.length * ACTION_WIDTH
  const [open, setOpen] = useState(false)
  const [dragX, setDragX] = useState<number | null>(null)
  const drag = useRef<{ x: number; y: number; base: number; horizontal: boolean | null; current: number } | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    const onOtherOpen = (e: Event) => (e as CustomEvent<string>).detail !== id && setOpen(false)
    window.addEventListener(OPEN_EVENT, onOtherOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOtherOpen)
  }, [id])

  function setOpenState(next: boolean) {
    setOpen(next)
    if (next) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, base: open ? -width : 0, horizontal: null, current: open ? -width : 0 }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (d.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      d.horizontal = Math.abs(dx) > Math.abs(dy)
      if (d.horizontal) (e.currentTarget as Element).setPointerCapture(e.pointerId)
    }
    if (d.horizontal) {
      d.current = Math.min(0, Math.max(-width, d.base + dx))
      setDragX(d.current)
    }
  }

  const onPointerEnd = () => {
    const d = drag.current
    drag.current = null
    if (!d?.horizontal) return
    suppressClick.current = true
    setOpenState(d.current < -width / 2)
    setDragX(null)
  }

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (open) setOpenState(false)
    else onTap()
  }

  const x = dragX ?? (open ? -width : 0)

  return (
    <div className="swipe">
      <div className="swipe-actions" style={{ width }} aria-hidden={!open}>
        {actions.map((a) => (
          <button
            key={a.label}
            className={`swipe-action${a.tone ? ` ${a.tone}` : ''}`}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOpenState(false)
              a.onClick()
            }}
          >
            {a.icon}
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      <div
        className={`swipe-content${dragX === null ? ' settle' : ''}`}
        style={{ transform: `translateX(${x}px)` }}
        role="button"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={onClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onTap())}
      >
        {children}
      </div>
    </div>
  )
}
